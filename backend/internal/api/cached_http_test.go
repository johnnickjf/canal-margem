package api

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"margem/backend/internal/calculator"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/publications"
)

func TestConcurrentHandlersPreserveCachedSnapshotAndProfilePrivacy(t *testing.T) {
	snapshot := workTimeSnapshot()
	body, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	r := cachedProjectionReader{projectionReader: projectionReader{body: body}, sha: canonical.Hash(body)}
	r.cache = publications.NewSnapshotCache(r.projectionReader, publications.MaxProjection, time.Minute)
	shared, err := r.Snapshot(context.Background(), snapshot.Publication)
	if err != nil {
		t.Fatal(err)
	}
	before, _ := canonical.Digest(shared)
	h := (&API{Reader: r}).Handler()
	paths := []string{
		"/api/v1/themes", "/api/v1/indicators",
		"/api/v1/indicators/cesta-basica", "/api/v1/indicators/cesta-basica/series",
		"/api/v1/series/cv4?geography=BR-city-3550308",
		"/api/v1/work-time?series=cv4&geography=BR-city-3550308&from=2025-01-01&to=2025-01-31",
		"/api/v1/comparisons?series=cv4&geography=BR-city-3550308&from=2025-01-01&to=2025-01-31&calculation=difference&version=2",
		"/api/v1/calculator",
	}
	var wg sync.WaitGroup
	for _, path := range paths {
		wg.Go(func() {
			for range 10 {
				method, payload := "GET", ""
				target := path
				if path == "/api/v1/calculator" {
					profile, _ := json.Marshal(calculatorRequest{Publication: snapshot.Publication, Version: calculator.Version, Month: "2025-01", Geography: "BR-city-3550308", Profile: calculator.Profile{Income: "3000", Members: 3, Housing: "1000", Transport: "250", Other: "750", IncomeChange: "500"}})
					method, payload = "POST", string(profile)
				} else {
					separator := "?"
					if strings.Contains(target, "?") {
						separator = "&"
					}
					target += separator + "publication=" + snapshot.Publication
				}
				req := httptest.NewRequest(method, target, strings.NewReader(payload))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()
				h.ServeHTTP(w, req)
				if w.Code != 200 {
					t.Errorf("%s: HTTP %d: %s", path, w.Code, w.Body.String())
				}
				if method == "POST" && (w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("ETag") != "") {
					t.Error("cached personal response")
				}
			}
		})
	}
	wg.Wait()
	after, _ := canonical.Digest(shared)
	if before != after {
		t.Fatal("handler mutated the shared publication")
	}
}
