package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"margem/backend/internal/catalog"
	"margem/backend/internal/indicators"
	"margem/backend/internal/publications"
)

func TestMaterialAssessment(t *testing.T) {
	for _, tc := range []struct{ series, previous, current, status, direction string }{
		{"tr4", "8", "7", "improved", "down"},
		{"tr4", "7", "8", "worsened", "up"},
		{"tr2", "1400", "1500", "improved", "up"},
		{"cv5", "100", "110", "worsened", "up"},
		{"qv1", "10.00", "10", "stable", "flat"},
		{"tr4", "0.000000000000000002", "0.000000000000000001", "improved", "down"},
		{"cv1-monthly", "0.4", "0.2", "context_required", "down"},
		{"derived:transformation", "4", "3", "context_required", "down"},
	} {
		t.Run(tc.series+tc.status, func(t *testing.T) {
			a := materialAssessment(tc.series, &tc.previous, &tc.current)
			if a.Status != tc.status || a.Direction != tc.direction || a.Version != "material-v1" || a.Rule == "" {
				t.Fatal(a)
			}
		})
	}
}

func TestComparisonHTTP(t *testing.T) {
	for _, tc := range []struct{ name, mutation, calculation, status, reason, assessment string }{
		{"computed", "", "difference", "computed", "", "improved"},
		{"relative", "", "relative-change", "computed", "", "improved"},
		{"stable", "equal", "difference", "computed", "", "stable"},
		{"worsened", "higher", "difference", "computed", "", "worsened"},
		{"missing", "missing", "difference", "not_comparable", "input_unavailable:current", "insufficient_data"},
		{"pending", "pending", "difference", "not_comparable", "endpoint_unavailable", "insufficient_data"},
		{"base changed", "base", "difference", "not_comparable", "not_comparable", "insufficient_data"},
		{"uncovered", "uncovered", "difference", "not_comparable", "endpoint_not_covered", "insufficient_data"},
		{"method break", "method", "difference", "not_comparable", "incompatible_metadata:current", "insufficient_data"},
		{"zero base", "zero", "relative-change", "not_comparable", "nonpositive_denominator", "insufficient_data"},
		{"zero difference", "zero", "difference", "computed", "", "worsened"},
		{"ambiguous", "ambiguous", "difference", "not_comparable", "ambiguous_endpoints", "insufficient_data"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			id := strings.Repeat("a", 64)
			previous, current := "8", "7"
			if tc.mutation == "zero" {
				previous = "0"
			}
			if tc.mutation == "equal" {
				current = previous
			}
			if tc.mutation == "higher" {
				current = "9"
			}
			context := func() map[string]any {
				spec := catalog.ByID["tr4"]
				return map[string]any{"unit": spec.Unit, "frequency": spec.Frequency, "method": spec.Method, "temporal_basis": spec.TemporalBasis}
			}
			p := indicators.Input{ID: strings.Repeat("b", 64), Series: "tr4", Geography: "BR", Start: "2024-01-01", End: "2024-03-31", Status: "observed", Value: &previous, Context: context()}
			c := indicators.Input{ID: strings.Repeat("c", 64), Series: "tr4", Geography: "BR", Start: "2025-01-01", End: "2025-03-31", Status: "observed", Value: &current, Context: context()}
			if tc.mutation == "method" {
				c.Context["method"] = "test/2"
			}
			if tc.mutation == "base" {
				c.Context["monetary_base"] = "changed-base"
			}
			if tc.mutation == "missing" {
				c.Status = "missing"
				c.Value = nil
			}
			scope := []publications.Slot{
				{Series: p.Series, Geography: p.Geography, Start: p.Start, End: p.End, ID: p.ID},
				{Series: c.Series, Geography: c.Geography, Start: c.Start, End: c.End, ID: c.ID},
			}
			if tc.mutation == "pending" {
				scope[1].ID = ""
				scope[1].Status = "pending_recalculation"
				scope[1].Reason = "Input revisado"
			}
			if tc.mutation == "uncovered" {
				scope = scope[:1]
			}
			if tc.mutation == "ambiguous" {
				scope = append(scope, publications.Slot{Series: p.Series, Geography: p.Geography, Start: p.Start, End: "2024-06-30", Status: "not_covered"})
			}
			snapshot := publications.Snapshot{Publication: id, Manifest: publications.Manifest{Catalog: publications.CurrentCatalog(), Scope: scope}, Nodes: map[string]publications.Node{p.ID: {Input: p}, c.ID: {Input: c}}}
			h := New(reader{snapshot})
			path := "/api/v1/comparisons?publication=" + id + "&series=tr4&geography=BR&from=2024-01-01&to=2025-03-31&calculation=" + tc.calculation + "&version=2&assessment=material-v1"
			w := httptest.NewRecorder()
			h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
			var body struct {
				Publication string `json:"publication"`
				Data        struct {
					Status     string     `json:"status"`
					Reason     string     `json:"reason"`
					Assessment assessment `json:"assessment"`
				} `json:"data"`
			}
			if e := json.Unmarshal(w.Body.Bytes(), &body); e != nil {
				t.Fatal(e)
			}
			if w.Code != 200 || body.Publication != id || body.Data.Status != tc.status || body.Data.Reason != tc.reason || body.Data.Assessment.Status != tc.assessment {
				t.Fatal(w.Code, w.Body.String())
			}
			if tc.mutation == "" && tc.calculation == "difference" && !strings.Contains(w.Body.String(), `"unit":"percentage_points"`) {
				t.Fatal(w.Body.String())
			}
			for _, badPath := range []string{strings.Replace(path, "assessment=material-v1", "assessment=unknown", 1), path + "&from=2025-03-31"} {
				bad := httptest.NewRecorder()
				h.ServeHTTP(bad, httptest.NewRequest("GET", badPath, nil))
				if bad.Code != 400 {
					t.Fatal(bad.Code, bad.Body.String())
				}
			}
		})
	}
}
