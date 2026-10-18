// Package catalog owns the versioned source and series definitions.
package catalog

import (
	_ "embed"
	"encoding/json"
	"margem/backend/internal/platform/canonical"
)

const NormalizationVersion = "mvp-1"

//go:embed series.json
var Definition []byte

// Spec mirrors the existing catalogue, including explicit null bounds.
type Spec struct {
	ID             string            `json:"id"`
	Indicator      string            `json:"indicator"`
	Source         string            `json:"source"`
	Dataset        string            `json:"dataset"`
	Variable       string            `json:"variable"`
	Unit           string            `json:"unit"`
	Frequency      string            `json:"frequency"`
	Method         string            `json:"method"`
	Classification map[string]string `json:"classification"`
	Minimum        *string           `json:"minimum"`
	Maximum        *string           `json:"maximum"`
	First          string            `json:"first"`
	Last           string            `json:"last"`
	TemporalBasis  string            `json:"temporal_basis"`
}

var Sources = []string{"ibge", "bcb", "anp", "dieese", "fjp"}
var CadenceHours = map[string]int{"ibge": 24, "bcb": 24, "anp": 168, "dieese": 24, "fjp": 168}
var Series []Spec
var ByID map[string]Spec
var Version string

func init() {
	if e := json.Unmarshal(Definition, &Series); e != nil {
		panic(e)
	}
	ByID = make(map[string]Spec, len(Series))
	for _, s := range Series {
		ByID[s.ID] = s
	}
	var definitions any
	if e := canonical.Decode(Definition, &definitions); e != nil {
		panic(e)
	}
	var e error
	Version, e = canonical.Digest([]any{NormalizationVersion, definitions})
	if e != nil {
		panic(e)
	}
}
