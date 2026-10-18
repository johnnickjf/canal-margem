package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"margem/backend/internal/indicators"
	"margem/backend/internal/publications"
)

type reader struct{ snapshot publications.Snapshot }

func (r reader) Resolve(context.Context, time.Time) (publications.Activation, error) {
	return publications.Activation{Generation: 1, Publication: r.snapshot.Publication}, nil
}
func (r reader) Snapshot(context.Context, string) (publications.Snapshot, error) {
	return r.snapshot, nil
}
func TestTransportLimitsAndCache(t *testing.T) {
	id := strings.Repeat("a", 64)
	h := New(reader{publications.Snapshot{Publication: id, Manifest: publications.Manifest{Catalog: publications.CurrentCatalog()}, Nodes: map[string]publications.Node{}}})
	path := "/api/v1/themes?publication=" + id
	request := httptest.NewRequest("GET", path, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, request)
	if w.Code != 200 || w.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatal(w.Code, w.Header(), w.Body.String())
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "*" || w.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Fatal(w.Header())
	}
	preflight := httptest.NewRequest("OPTIONS", path, nil)
	preflight.Header.Set("Origin", "https://example.test")
	preflight.Header.Set("Access-Control-Request-Headers", "If-None-Match")
	preflightResponse := httptest.NewRecorder()
	h.ServeHTTP(preflightResponse, preflight)
	if preflightResponse.Code != 204 || preflightResponse.Header().Get("Access-Control-Allow-Headers") != "If-None-Match" {
		t.Fatal(preflightResponse)
	}
	headError := httptest.NewRecorder()
	h.ServeHTTP(headError, httptest.NewRequest("HEAD", "/missing", nil))
	if headError.Code != 404 || headError.Body.Len() != 0 {
		t.Fatal(headError)
	}
	etag := w.Header().Get("ETag")
	if etag == "" {
		t.Fatal("no etag")
	}
	for _, method := range []string{"GET", "HEAD"} {
		r := httptest.NewRequest(method, path, nil)
		r.Header.Set("If-None-Match", "W/"+etag)
		w = httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 304 || w.Body.Len() != 0 {
			t.Fatal(method, w.Code, w.Body.String())
		}
	}
	for _, header := range []string{"Authorization", "Cookie"} {
		r := httptest.NewRequest("GET", path, nil)
		r.Header.Set(header, "present")
		w = httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal(w.Header())
		}
	}
	for _, method := range []string{"POST", "DELETE", "PATCH"} {
		w = httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(method, path, nil))
		if w.Code != 405 || !strings.Contains(w.Body.String(), "method_not_allowed") {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("HEAD", path, nil))
	if w.Code != 200 || w.Body.Len() != 0 || w.Header().Get("Content-Length") == "" {
		t.Fatal(w)
	}
	for _, bad := range []string{"/api/v2/themes", "/missing"} {
		w = httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", bad, nil))
		if w.Code != 404 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal(w)
		}
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", path+"&q="+strings.Repeat("x", 4096), nil))
	if w.Code != 400 {
		t.Fatal(w)
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", path, strings.NewReader("body")))
	if w.Code != 400 {
		t.Fatal(w)
	}
}
func TestRateLimiterDoesNotTrustForwardingHeaders(t *testing.T) {
	a := &API{Reader: reader{}, Rate: 1}
	h := a.Handler()
	for i := range 2 {
		r := httptest.NewRequest("GET", "/healthz", nil)
		r.Header.Set("X-Forwarded-For", strings.Repeat("1", i+1))
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		want := 200
		if i == 1 {
			want = 429
		}
		if w.Code != want {
			t.Fatal(w.Code, w.Body.String())
		}
		if i == 1 && (w.Header().Get("Retry-After") == "" || w.Header().Get("Cache-Control") != "no-store") {
			t.Fatal(w.Header())
		}
	}
}
func TestAbuseConcurrencyLimit(t *testing.T) {
	a := &API{Reader: reader{}, slots: make(chan struct{}, 1)}
	a.slots <- struct{}{}
	h := a.Handler()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/healthz", nil))
	if w.Code != http.StatusServiceUnavailable {
		t.Fatal(w.Code)
	}
}
func TestAmbiguityAndWholePeriods(t *testing.T) {
	id := strings.Repeat("a", 64)
	snapshot := publications.Snapshot{Publication: id, Manifest: publications.Manifest{Catalog: publications.CurrentCatalog(), Scope: []publications.Slot{
		{Series: "cv4", Geography: "capital-a", Start: "2025-01-01", End: "2025-01-31", Status: "not_covered", Reason: "gap"},
		{Series: "cv4", Geography: "capital-b", Start: "2025-01-01", End: "2025-01-31", Status: "not_covered", Reason: "gap"},
		{Series: "tr4", Geography: "BR", Start: "2025-01-01", End: "2025-03-31", ID: "quarter"},
	}}, Nodes: map[string]publications.Node{"quarter": {Input: indicators.Input{ID: "quarter", Series: "tr4", Start: "2025-01-01", End: "2025-03-31", Geography: "BR", Status: "missing"}}}}
	h := New(reader{snapshot})
	for _, path := range []string{"/api/v1/indicators/cesta-basica", "/api/v1/series/cv4"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path+"?publication="+id, nil))
		if w.Code != 409 || !strings.Contains(w.Body.String(), "ambiguous_selection") {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/series/tr4?publication="+id+"&from=2025-02-01&to=2025-03-31", nil))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestTransformedIndicatorSeriesPreservesIntermediateCalculation(t *testing.T) {
	for _, tc := range []struct {
		calculation, slug, inputSeries, inputSlug string
	}{
		{"tr2", "salario-minimo-real", "inpc-index", "tr2-input"},
		{"cv5", "tempo-por-cesta", "cv4", "cesta-basica"},
		{"price-income", "tempo-por-cesta", "cv4", "cesta-basica"},
	} {
		t.Run(tc.calculation, func(t *testing.T) {
			id := strings.Repeat("a", 64)
			series := "derived:" + strings.Repeat("b", 64)
			inputs := map[string]string{"basket": "input", "nominal": "input"}
			if tc.calculation == "tr2" {
				inputs = map[string]string{"base_index": "input", "current_index": "input", "nominal": "input"}
			}
			snapshot := publications.Snapshot{Publication: id, Manifest: publications.Manifest{
				Catalog: publications.CurrentCatalog(),
				Scope:   []publications.Slot{{Series: series, Geography: "BR", Start: "2025-01-01", End: "2025-01-31", ID: "rebase"}},
			}, Nodes: map[string]publications.Node{
				"rebase": {Input: indicators.Input{Series: series}, Evaluation: &indicators.Evaluation{Request: indicators.Request{
					Calculation: "rebase", Inputs: map[string]string{"current": "difference", "base": "difference"},
				}}},
				"difference": {Input: indicators.Input{Series: "derived:difference"}, Evaluation: &indicators.Evaluation{Request: indicators.Request{
					Calculation: "difference", Inputs: map[string]string{"current": "intermediate", "previous": "intermediate"},
				}}},
				"intermediate": {Input: indicators.Input{Series: "derived:intermediate"}, Evaluation: &indicators.Evaluation{Request: indicators.Request{
					Calculation: tc.calculation, Inputs: inputs,
				}}},
				"input": {Input: indicators.Input{Series: tc.inputSeries}},
			}}
			h := New(reader{snapshot})
			for _, slug := range []string{tc.slug, tc.inputSlug} {
				w := httptest.NewRecorder()
				h.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/indicators/"+slug+"/series?publication="+id, nil))
				if w.Code != 200 || strings.Contains(w.Body.String(), series) != (slug == tc.slug) {
					t.Fatalf("transformed %s classified incorrectly for %s: HTTP %d %s", tc.calculation, slug, w.Code, w.Body.String())
				}
			}
		})
	}
}
