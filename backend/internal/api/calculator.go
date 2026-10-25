package api

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"regexp"
	"time"

	"github.com/shopspring/decimal"
	"margem/backend/internal/calculator"
	"margem/backend/internal/catalog"
)

type calculatorRequest struct {
	Publication string             `json:"publication"`
	Version     string             `json:"version"`
	Geography   string             `json:"geography"`
	Month       string             `json:"month"`
	Profile     calculator.Profile `json:"profile"`
}
type calculatorResult struct {
	calculator.Result
	Geography       string `json:"geography"`
	Month           string `json:"month"`
	ReferenceStatus string `json:"reference_status"`
	ReferenceReason string `json:"reference_reason,omitempty"`
	Price           *point `json:"price,omitempty"`
}

func (a *API) calculate(w http.ResponseWriter, r *http.Request) {
	// This response contains a personal scenario. Never pass it through public cache/ETag.
	w.Header().Set("Cache-Control", "no-store")
	if err := parameters(r); err != nil {
		a.fail(w, err)
		return
	}
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" {
		a.failStatus(w, 415, "invalid_request", "use application/json")
		return
	}
	var req calculatorRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		a.failStatus(w, 400, "invalid_request", "corpo JSON inválido ou maior que 4096 bytes")
		return
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		a.failStatus(w, 400, "invalid_request", "envie um único objeto JSON")
		return
	}
	month, err := time.Parse("2006-01", req.Month)
	if err != nil || req.Version != calculator.Version || !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(req.Publication) || len(req.Geography) == 0 || len(req.Geography) > 100 {
		a.failStatus(w, 400, "invalid_request", "informe publicação, profile-v1, geografia e mês YYYY-MM")
		return
	}
	if err := calculator.Validate(req.Profile); err != nil {
		a.failStatus(w, 400, "invalid_request", err.Error())
		return
	}
	snapshot, err := a.Reader.Snapshot(r.Context(), req.Publication)
	if err != nil {
		a.fail(w, err)
		return
	}
	result := calculatorResult{Geography: req.Geography, Month: req.Month, ReferenceStatus: "not_computed", ReferenceReason: "endpoint_not_covered"}
	var price *decimal.Decimal
	for _, p := range points(snapshot, "cv4", req.Geography) {
		if p.Start != month.Format(time.DateOnly) || p.End != month.AddDate(0, 1, -1).Format(time.DateOnly) {
			continue
		}
		result.Price = &p
		result.ReferenceReason = "endpoint_unavailable"
		if p.Status != "observed" || p.Node == nil || p.Node.Input.Value == nil {
			break
		}
		input := p.Node.Input
		spec := catalog.ByID["cv4"]
		compatible := input.Series == "cv4" && input.Geography == p.Geography && input.Start == p.Start && input.End == p.End
		for key, expected := range map[string]string{"unit": spec.Unit, "method": spec.Method, "frequency": spec.Frequency, "temporal_basis": spec.TemporalBasis} {
			compatible = compatible && input.Context[key] == expected
		}
		cost, err := decimal.NewFromString(*input.Value)
		if !compatible || err != nil || cost.IsNegative() {
			result.ReferenceReason = "incompatible_reference"
			break
		}
		price = &cost
		result.ReferenceStatus, result.ReferenceReason = "observed", ""
		break
	}
	result.Result, err = calculator.Evaluate(req.Profile, price)
	if err != nil {
		a.fail(w, err)
		return
	}
	if r.Context().Err() != nil {
		a.fail(w, r.Context().Err())
		return
	}
	json.NewEncoder(w).Encode(envelope{Publication: req.Publication, CatalogRevision: snapshot.Manifest.Catalog.Revision, Data: result})
}
