package api

import (
	"context"
	"encoding/json"
	"margem/backend/internal/publications"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"margem/backend/internal/calculator"
)

func TestCalculatorHTTP(t *testing.T) {
	for _, mode := range []string{"observed", "missing", "wrong-month", "wrong-geography", "incompatible", "zero-income", "deficit"} {
		t.Run(mode, func(t *testing.T) {
			snapshot := workTimeSnapshot()
			profile := calculator.Profile{Income: "3000", Members: 3, Housing: "1000", Transport: "250.25", Other: "749.75", IncomeChange: "500", LaborIncome: "1500", MonthlyHours: "200"}
			switch mode {
			case "missing":
				snapshot.Manifest.Scope[0].ID = ""
				snapshot.Manifest.Scope[0].Status = "pending_recalculation"
			case "wrong-month":
				snapshot.Manifest.Scope[0].Start = "2024-12-01"
			case "wrong-geography":
				snapshot.Manifest.Scope[0].Geography = "other"
			case "incompatible":
				node := snapshot.Nodes[strings.Repeat("b", 64)]
				node.Input.Context["unit"] = "USD"
				snapshot.Nodes[node.Input.ID] = node
			case "zero-income":
				profile.Income, profile.LaborIncome, profile.MonthlyHours = "0", "", ""
			case "deficit":
				profile.Housing = "4000"
			}
			request := calculatorRequest{Publication: snapshot.Publication, Version: calculator.Version, Geography: "BR-city-3550308", Month: "2025-01", Profile: profile}
			body, _ := json.Marshal(request)
			r := httptest.NewRequest("POST", "/api/v1/calculator", strings.NewReader(string(body)))
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("If-None-Match", "*")
			w := httptest.NewRecorder()
			New(reader{snapshot}).ServeHTTP(w, r)
			var result struct {
				Publication string
				Data        calculatorResult
			}
			if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("ETag") != "" || result.Publication != snapshot.Publication {
				t.Fatal(w.Code, w.Header(), w.Body.String())
			}
			d := result.Data
			if d.Version != calculator.Version || d.Baseline.Expenses == "" || d.Scenario.Income == "" || len(d.Formulas) != 7 {
				t.Fatal(d)
			}
			if mode == "observed" {
				if d.Baseline.Remaining != "1000" || d.Baseline.PerPerson != "1000" || d.Scenario.Remaining != "1500" || *d.BasketShare != "25" || *d.BasketHours != "100" || d.Price.Node.Input.ID != strings.Repeat("b", 64) {
					t.Fatal(d)
				}
			}
			if mode == "zero-income" && (d.Baseline.ExpenseShare != nil || d.BasketShare != nil || d.BasketHours != nil || d.Baseline.Remaining != "-2000") {
				t.Fatal(d)
			}
			if mode == "deficit" && d.Baseline.Remaining != "-2000" {
				t.Fatal(d)
			}
			if mode == "missing" || mode == "wrong-month" || mode == "wrong-geography" || mode == "incompatible" {
				if d.ReferenceStatus != "not_computed" || d.ReferenceReason == "" || d.BasketHours != nil || d.BasketShare != nil || d.Baseline.Remaining != "1000" {
					t.Fatal(d)
				}
			}
		})
	}
}
func TestCalculatorRejectsInvalidAndProtectsTransport(t *testing.T) {
	snapshot := workTimeSnapshot()
	valid := `{"publication":"` + snapshot.Publication + `","version":"profile-v1","geography":"BR-city-3550308","month":"2025-01","profile":{"income":"3000","members":3,"housing":"1000","transport":"250.25","other":"749.75","income_change":"500"}}`
	for _, body := range []string{strings.Replace(valid, `"members":3`, `"members":0`, 1), strings.Replace(valid, `"3000"`, `"-1"`, 1), strings.Replace(valid, `"3000"`, `"1e3"`, 1), strings.Replace(valid, `"3000"`, `3000`, 1), strings.Replace(valid, `"500"`, `"-3001"`, 1), strings.Replace(valid, `"500"`, `"0.001"`, 1), strings.Replace(valid, `"2025-01"`, `"2025-13"`, 1), strings.Replace(valid, `"profile-v1"`, `"unknown"`, 1), strings.Replace(valid, `"income":"3000"`, `"income":"3000","secret":"x"`, 1), valid + `{}`, strings.Repeat("x", 4097), "null"} {
		h := New(reader{snapshot})
		w := httptest.NewRecorder()
		r := httptest.NewRequest("POST", "/api/v1/calculator", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		h.ServeHTTP(w, r)
		if w.Code != 400 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal(body, w.Code, w.Body.String())
		}
	}
	h := New(reader{snapshot})
	for _, method := range []string{"GET", "HEAD"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(method, "/api/v1/calculator", nil))
		if w.Code != 405 {
			t.Fatal(w.Code)
		}
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("OPTIONS", "/api/v1/calculator", nil))
	if w.Code != 204 || w.Header().Get("Access-Control-Allow-Methods") != "POST, OPTIONS" || w.Header().Get("Access-Control-Allow-Headers") != "Content-Type" {
		t.Fatal(w.Header())
	}
	r := httptest.NewRequest("POST", "/api/v1/calculator", strings.NewReader(valid))
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 415 {
		t.Fatal(w.Code)
	}
	// Chunked requests are bounded by MaxBytesReader too.
	r = httptest.NewRequest("POST", "/api/v1/calculator", strings.NewReader(strings.Repeat(" ", 4097)+valid))
	r.ContentLength = -1
	r.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal(w.Code)
	}
}

type pinnedCalculatorReader struct{ reader }

func (r pinnedCalculatorReader) Resolve(context.Context, time.Time) (publications.Activation, error) {
	panic("calculator must never resolve current")
}
func (r pinnedCalculatorReader) Snapshot(ctx context.Context, id string) (publications.Snapshot, error) {
	if id != r.snapshot.Publication {
		return publications.Snapshot{}, publications.Fail("context_expired", "edição retirada")
	}
	return r.snapshot, nil
}
func TestCalculatorDoesNotReplaceExpiredEdition(t *testing.T) {
	snapshot := workTimeSnapshot()
	h := New(pinnedCalculatorReader{reader{snapshot}})
	for _, id := range []string{snapshot.Publication, strings.Repeat("e", 64)} {
		body := `{"publication":"` + id + `","version":"profile-v1","geography":"BR-city-3550308","month":"2025-01","profile":{"income":"0","members":1,"housing":"0","transport":"0","other":"0","income_change":"0"}}`
		r := httptest.NewRequest("POST", "/api/v1/calculator", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		expected := 200
		if id != snapshot.Publication {
			expected = 410
		}
		if w.Code != expected || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal(w.Code, w.Body.String())
		}
	}
}
