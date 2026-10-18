// Package observations owns accepted values, content identities and quality rules.
package observations

import (
	"fmt"
	"github.com/shopspring/decimal"
	"margem/backend/internal/catalog"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"regexp"
	"strings"
	"time"
)

type QualityError struct{ Message string }

func (e *QualityError) Error() string          { return e.Message }
func Invalid(format string, args ...any) error { return &QualityError{fmt.Sprintf(format, args...)} }

var decimalPattern = regexp.MustCompile(`^-?\d+(?:\.\d+)?$`)

func Decimal(text string, comma bool) (string, error) {
	text = strings.TrimSpace(text)
	if comma {
		text = strings.ReplaceAll(strings.ReplaceAll(text, ".", ""), ",", ".")
	}
	if !decimalPattern.MatchString(text) {
		return "", Invalid("decimal inválido: %q", text)
	}
	d, e := decimal.NewFromString(text)
	if e != nil {
		return "", Invalid("decimal inválido")
	}
	return d.String(), nil
}

type Observation struct {
	Series    string         `json:"series"`
	Start     string         `json:"start"`
	End       string         `json:"end"`
	Geography string         `json:"geography"`
	Value     *string        `json:"value"`
	Status    string         `json:"status"`
	Context   map[string]any `json:"context"`
	Locator   string         `json:"locator"`
	Artifacts []string       `json:"-"`
}

func (o Observation) ID() (string, error) {
	// Maps sort keys, matching Python sort_keys, unlike struct field ordering.
	return canonical.Digest(map[string]any{"series": o.Series, "start": o.Start, "end": o.End, "geography": o.Geography, "value": o.Value, "status": o.Status, "context": o.Context, "locator": o.Locator})
}
func New(spec catalog.Spec, start, end time.Time, value, locator string, context map[string]any, geography string, artifacts []string) (Observation, error) {
	if geography == "" {
		geography = "BR"
	}
	o := Observation{Series: spec.ID, Start: start.Format(period.Layout), End: end.Format(period.Layout), Geography: geography, Locator: locator, Artifacts: artifacts, Context: map[string]any{"normalization_version": catalog.NormalizationVersion, "unit": spec.Unit, "frequency": spec.Frequency, "method": spec.Method, "temporal_basis": spec.TemporalBasis}}
	for k, v := range context {
		o.Context[k] = v
	}
	switch value {
	case "...":
		o.Status = "missing"
	case "..":
		o.Status = "not_applicable"
	case "X":
		o.Status = "suppressed"
	default:
		if value == "-" {
			value = "0"
		}
		v, e := Decimal(value, false)
		if e != nil {
			return o, e
		}
		d, _ := decimal.NewFromString(v)
		if spec.Unit == "%" && d.LessThan(decimal.NewFromInt(-100)) {
			return o, Invalid("%s: percentual abaixo de -100", spec.ID)
		}
		for _, bound := range []struct {
			v   *string
			min bool
		}{{spec.Minimum, true}, {spec.Maximum, false}} {
			if bound.v == nil {
				continue
			}
			b, e := decimal.NewFromString(*bound.v)
			if e != nil {
				return o, e
			}
			if bound.min && d.LessThan(b) || !bound.min && d.GreaterThan(b) {
				return o, Invalid("%s: valor fora do domínio", spec.ID)
			}
		}
		o.Status = "observed"
		o.Value = &v
	}
	return o, nil
}
func Validate(rows []Observation, required ...string) error {
	if len(rows) == 0 {
		return Invalid("lote vazio")
	}
	seen := map[string]bool{}
	series := map[string]bool{}
	for _, o := range rows {
		key := o.Series + "/" + o.Start + "/" + o.End + "/" + o.Geography
		if seen[key] {
			return Invalid("observações duplicadas no lote")
		}
		seen[key] = true
		series[o.Series] = true
		s, e := period.Date(o.Start)
		if e != nil {
			return Invalid("data inicial inválida")
		}
		t, e := period.Date(o.End)
		if e != nil || t.Before(s) {
			return Invalid("período inválido")
		}
		if o.Status != "observed" && o.Status != "missing" && o.Status != "not_applicable" && o.Status != "suppressed" {
			return Invalid("estado inválido")
		}
		if (o.Value != nil) != (o.Status == "observed") {
			return Invalid("estado/valor incompatíveis")
		}
		if o.Value != nil {
			if _, e := Decimal(*o.Value, false); e != nil {
				return e
			}
		}
		if o.Locator == "" || o.Context["method"] == nil || o.Context["method"] == "" || len(o.Artifacts) == 0 {
			return Invalid("proveniência ausente")
		}
	}
	for _, s := range required {
		if !series[s] {
			return Invalid("série obrigatória ausente: %s", s)
		}
	}
	return nil
}
