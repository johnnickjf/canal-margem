// Package publications owns immutable public selections and channel activation.
package publications

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"
	"time"

	"margem/backend/internal/catalog"
	"margem/backend/internal/indicators"
	"margem/backend/internal/platform/canonical"
)

const MaxProjection = 16 * 1024 * 1024

var hashPattern = regexp.MustCompile(`^[a-f0-9]{64}$`)

type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string        { return e.Message }
func Fail(code, message string) error { return &Error{code, message} }

type ProjectionStore interface {
	SaveProjection(context.Context, string, []byte) error
	LoadProjection(context.Context, string, string, int64) ([]byte, error)
}
type RawVerifier interface {
	Verify(context.Context, string, string, int64) error
}

type Theme struct {
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	Question string `json:"question"`
}
type Indicator struct {
	ID          string `json:"id"`
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Question    string `json:"question"`
	Definition  string `json:"definition"`
	Theme       string `json:"theme"`
	Role        string `json:"role"`
	Limitations string `json:"limitations"`
}
type Source struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	URL  string `json:"url"`
}
type Catalog struct {
	Revision       string                  `json:"revision"`
	SourceRevision string                  `json:"source_revision"`
	Themes         []Theme                 `json:"themes"`
	Indicators     []Indicator             `json:"indicators"`
	Sources        []Source                `json:"sources"`
	Series         []catalog.Spec          `json:"series"`
	Formulas       []indicators.Definition `json:"formulas"`
}

//go:embed indicators.json
var indicatorDefinitions []byte

func CurrentCatalog() Catalog {
	c := Catalog{SourceRevision: catalog.Version, Series: catalog.Series, Formulas: indicators.Definitions(), Themes: []Theme{
		{"trabalho-e-renda", "Trabalho e renda", "O trabalho permite viver melhor?"}, {"custo-de-vida", "Custo de vida", "Quanto custa viver no Brasil?"}, {"vida-financeira", "Vida financeira", "Quanto da renda sobra?"}, {"qualidade-de-vida", "Qualidade de vida", "Como vivemos?"}, {"economia-e-estado", "Economia e Estado", "Como a economia afeta a vida material?"},
	}, Sources: []Source{{"ibge", "IBGE", "https://www.ibge.gov.br/"}, {"bcb", "Banco Central do Brasil", "https://www.bcb.gov.br/"}, {"anp", "ANP", "https://www.gov.br/anp/"}, {"dieese", "Conab/DIEESE", "https://www.dieese.org.br/analisecestabasica/"}, {"fjp", "Fundação João Pinheiro", "https://fjp.mg.gov.br/"}, {"margem", "Margem — cálculos derivados", "https://margem.com.br/"}}}
	if e := json.Unmarshal(indicatorDefinitions, &c.Indicators); e != nil {
		panic(e)
	}
	// Hash all interpretation metadata, not only the source catalog.
	c.Revision, _ = canonical.Digest(c)
	return c
}

type Slot struct {
	Series    string `json:"series"`
	Geography string `json:"geography"`
	Start     string `json:"start"`
	End       string `json:"end"`
	ID        string `json:"id,omitempty"`
	Status    string `json:"status,omitempty"`
	Reason    string `json:"reason,omitempty"`
}

func (s Slot) Key() string { return s.Series + "/" + s.Geography + "/" + s.Start + "/" + s.End }

type PrepareRequest struct {
	Actor           string    `json:"actor"`
	Key             string    `json:"key"`
	BaseActivation  int64     `json:"base_activation"`
	DataCutoff      time.Time `json:"data_cutoff"`
	SelectionReason string    `json:"selection_reason"`
	Scope           []Slot    `json:"scope"`
}
type Manifest struct {
	Version         string    `json:"version"`
	Catalog         Catalog   `json:"catalog"`
	BaseActivation  int64     `json:"base_activation"`
	DataCutoff      time.Time `json:"data_cutoff"`
	SelectionReason string    `json:"selection_reason"`
	Scope           []Slot    `json:"scope"`
	Dependencies    []string  `json:"dependencies"`
}
type Origin struct {
	URL         string    `json:"url"`
	SHA256      string    `json:"sha256"`
	RetrievedAt time.Time `json:"retrieved_at"`
}
type Node struct {
	Input      indicators.Input       `json:"observation"`
	AcceptedAt time.Time              `json:"accepted_at"`
	Origins    []Origin               `json:"origins"`
	Evaluation *indicators.Evaluation `json:"evaluation,omitempty"`
	Locator    string                 `json:"locator,omitempty"`
}
type Snapshot struct {
	Publication string          `json:"publication"`
	Manifest    Manifest        `json:"manifest"`
	Nodes       map[string]Node `json:"nodes"`
}
type Prepared struct {
	Publication     string `json:"publication"`
	CatalogRevision string `json:"catalog_revision"`
	Projection      string `json:"projection"`
	SHA256          string `json:"sha256"`
	Bytes           int64  `json:"bytes"`
}
type ActivateRequest struct {
	Actor              string `json:"actor"`
	Key                string `json:"key"`
	Publication        string `json:"publication"`
	ExpectedGeneration int64  `json:"expected_generation"`
	Reason             string `json:"reason"`
	Return             bool   `json:"return"`
}
type Activation struct {
	Generation         int64     `json:"generation"`
	Publication        string    `json:"publication"`
	PreviousActivation int64     `json:"previous_activation"`
	ActivatedAt        time.Time `json:"activated_at"`
	CatalogRevision    string    `json:"catalog_revision"`
	DataCutoff         time.Time `json:"data_cutoff"`
}

func Decode(body []byte, target any) error {
	if len(body) > MaxProjection {
		return Fail("invalid_request", "manifesto excede 16 MiB")
	}
	d := json.NewDecoder(bytes.NewReader(body))
	d.DisallowUnknownFields()
	if e := d.Decode(target); e != nil {
		return Fail("invalid_request", e.Error())
	}
	if e := d.Decode(&struct{}{}); e != io.EOF {
		return Fail("invalid_request", "conteúdo após JSON")
	}
	return nil
}
func identity(actor, key string) error {
	if len(actor) < 1 || len(actor) > 200 || len(key) < 1 || len(key) > 200 {
		return Fail("invalid_request", "actor e key exigem de 1 a 200 bytes")
	}
	return nil
}
func normalized(r PrepareRequest) (PrepareRequest, error) {
	if e := identity(r.Actor, r.Key); e != nil {
		return r, e
	}
	if r.BaseActivation < 0 || r.DataCutoff.IsZero() || r.DataCutoff.After(time.Now()) || len(r.Scope) == 0 || len(r.Scope) > 20000 || len(r.SelectionReason) < 1 || len(r.SelectionReason) > 2000 {
		return r, Fail("invalid_request", "corte, base, escopo ou justificativa inválidos")
	}
	r.DataCutoff = r.DataCutoff.UTC()
	r.Scope = append([]Slot(nil), r.Scope...)
	sort.Slice(r.Scope, func(i, j int) bool { return r.Scope[i].Key() < r.Scope[j].Key() })
	for i, s := range r.Scope {
		start, e := time.Parse("2006-01-02", s.Start)
		end, e2 := time.Parse("2006-01-02", s.End)
		if e != nil || e2 != nil || end.Before(start) || s.Geography == "" || s.Series == "" || len(s.Geography) > 100 || len(s.Series) > 100 || i > 0 && s.Key() == r.Scope[i-1].Key() {
			return r, Fail("invalid_request", "recorte inválido ou duplicado")
		}
		if s.ID != "" {
			if !hashPattern.MatchString(s.ID) || s.Status != "" || s.Reason != "" {
				return r, Fail("invalid_request", "seleção de ID inválida")
			}
		} else if (s.Status != "not_covered" && s.Status != "pending_recalculation") || s.Reason == "" || len(s.Reason) > 2000 {
			return r, Fail("invalid_request", "item sem observação exige estado e motivo")
		}
		if _, ok := catalog.ByID[s.Series]; !ok && s.Series != "tr2" && s.Series != "cv5" && s.Series != "price-income" && !(strings.HasPrefix(s.Series, "derived:") && hashPattern.MatchString(strings.TrimPrefix(s.Series, "derived:"))) {
			return r, Fail("invalid_request", fmt.Sprintf("série desconhecida: %s", s.Series))
		}
	}
	return r, nil
}

// SeriesID preserves semantic identities for generic engine outputs.
func SeriesID(n Node) string {
	if n.Evaluation != nil {
		switch n.Evaluation.Request.Calculation {
		case "tr2", "cv5", "price-income":
			return n.Evaluation.Request.Calculation
		}
	}
	return n.Input.Series
}
