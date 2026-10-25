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

func workTimeSnapshot() publications.Snapshot {
	s := publications.Snapshot{Publication: strings.Repeat("a", 64), Manifest: publications.Manifest{Catalog: publications.CurrentCatalog()}, Nodes: map[string]publications.Node{}}
	for i, series := range []string{"cv4", "minimum-nominal"} {
		spec := catalog.ByID[series]
		value, geography := "750", "BR-city-3550308"
		if i == 1 {
			value, geography = "1500", "BR"
		}
		x := indicators.Input{ID: strings.Repeat(string(rune('b'+i)), 64), Series: series, Geography: geography, Start: "2025-01-01", End: "2025-01-31", Value: &value, Status: "observed", Context: map[string]any{"unit": spec.Unit, "method": spec.Method, "frequency": spec.Frequency, "temporal_basis": spec.TemporalBasis, "composition": "regional", "method_segment": "partnership-2025"}}
		s.Nodes[x.ID] = publications.Node{Input: x, Origins: []publications.Origin{}}
		s.Manifest.Scope = append(s.Manifest.Scope, publications.Slot{Series: series, Geography: geography, Start: x.Start, End: x.End, ID: x.ID})
	}
	return s
}
func TestWorkTimeHTTP(t *testing.T) {
	for _, tc := range []struct{ name, mutation, status, reason, minutes string }{
		{"computed", "", "computed", "", "6600"},
		{"zero cost", "zero", "computed", "", "0"},
		{"minute carry", "carry", "computed", "", "60"},
		{"tie up to even", "tie-up", "computed", "", "2"},
		{"tie down to even", "tie-down", "computed", "", "4"},
		{"denominator zero", "denominator", "not_computed", "invalid_price_or_denominator", ""},
		{"negative price", "negative", "not_computed", "invalid_price_or_denominator", ""},
		{"pending", "pending", "not_computed", "endpoint_unavailable", ""},
		{"missing minimum", "missing", "not_computed", "input_unavailable:nominal", ""},
		{"previous minimum", "previous", "not_computed", "reference_not_covered", ""},
		{"wrong method", "method", "not_computed", "incompatible_metadata:basket", ""},
		{"wrong unit", "unit", "not_computed", "incompatible_metadata:basket", ""},
		{"source mismatch", "mismatch", "not_computed", "published_work_time_mismatch", ""},
		{"no coverage", "uncovered", "not_computed", "endpoint_not_covered", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := workTimeSnapshot()
			b, n := s.Nodes[strings.Repeat("b", 64)], s.Nodes[strings.Repeat("c", 64)]
			switch tc.mutation {
			case "zero":
				v := "0"
				b.Input.Value = &v
			case "carry":
				v := "6.81"
				b.Input.Value = &v
			case "tie-up", "tie-down":
				cost, nominal := "0.025", "220"
				if tc.mutation == "tie-down" {
					cost = "0.075"
				}
				b.Input.Value, n.Input.Value = &cost, &nominal
			case "denominator":
				v := "0"
				n.Input.Value = &v
			case "negative":
				v := "-1"
				b.Input.Value = &v
			case "pending":
				s.Manifest.Scope[0].ID = ""
				s.Manifest.Scope[0].Status = "pending_recalculation"
			case "missing":
				n.Input.Status = "missing"
				n.Input.Value = nil
			case "previous":
				s.Manifest.Scope[1].Start = "2024-12-01"
				s.Manifest.Scope[1].End = "2024-12-31"
			case "method":
				b.Input.Context["method"] = "wrong"
			case "unit":
				b.Input.Context["unit"] = "USD/basket"
			case "mismatch":
				b.Input.Context["published_work_time"] = "120h00m"
			case "uncovered":
				s.Manifest.Scope = nil
			}
			s.Nodes[b.Input.ID] = b
			s.Nodes[n.Input.ID] = n
			h := New(reader{s})
			path := "/api/v1/work-time?publication=" + s.Publication + "&series=cv4&geography=BR-city-3550308&from=2025-01-01&to=2025-01-31"
			w := httptest.NewRecorder()
			h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
			var body struct {
				Publication string `json:"publication"`
				Data        struct {
					Status, Reason string
					RoundedMinutes string `json:"rounded_minutes"`
					Hours, Share   indicators.Evaluation
					Price, Income  *point
				}
			}
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			d := body.Data
			if w.Code != 200 || body.Publication != s.Publication || d.Status != tc.status || d.Reason != tc.reason || d.RoundedMinutes != tc.minutes {
				t.Fatal(w.Code, w.Body.String())
			}
			if d.Status == "computed" {
				if d.Price.Node.Input.ID != b.Input.ID || d.Income.Node.Input.ID != n.Input.ID || d.Hours.Request.Version != "1" || d.Share.Request.Version != "1" || d.Hours.Request.Inputs["nominal"] != n.Input.ID {
					t.Fatal(d)
				}
				if tc.mutation == "" && (*d.Hours.Output.Value != "110" || *d.Share.Output.Value != "50") {
					t.Fatal(d)
				}
			}
			first := w.Header().Get("ETag")
			if first == "" || w.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
				t.Fatal(w.Header())
			}
			req := httptest.NewRequest("GET", path, nil)
			req.Header.Set("If-None-Match", first)
			cached := httptest.NewRecorder()
			h.ServeHTTP(cached, req)
			if cached.Code != 304 {
				t.Fatal(cached.Code)
			}
		})
	}
}
func TestWorkTimeRejectsInvalidSelection(t *testing.T) {
	s := workTimeSnapshot()
	h := New(reader{s})
	for _, query := range []string{"series=gasoline&geography=BR&from=2025-01-01&to=2025-01-31", "series=cv4&from=2025-01-01&to=2025-01-31", "series=cv4&geography=BR&from=2025-02-30&to=2025-03-31", "series=cv4&geography=BR", "series=cv4&series=cv5&geography=BR&from=2025-01-01&to=2025-01-31"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/work-time?publication="+s.Publication+"&"+query, nil))
		if w.Code != 400 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
}
