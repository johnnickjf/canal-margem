package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"margem/backend/internal/indicators"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/publications"
)

// These benchmarks isolate CPU/allocations. They do not model PostgreSQL, S3,
// network latency, production traffic, or a CDN.
func BenchmarkRateLimiter(b *testing.B) {
	for _, clients := range []int{1, 1000, 10000} {
		b.Run(fmt.Sprint(clients), func(b *testing.B) {
			a := &API{}
			a.Handler()
			for i := range clients {
				if !a.allow(fmt.Sprintf("192.0.%d.%d:1234", i/256, i%256)) {
					b.Fatal("client rejected")
				}
			}
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				if !a.allow("192.0.0.0:1234") {
					b.Fatal("client rejected")
				}
			}
		})
	}
}

type projectionReader struct {
	body []byte
}

func (r projectionReader) Resolve(context.Context, time.Time) (publications.Activation, error) {
	return publications.Activation{}, nil
}
func (r projectionReader) Snapshot(_ context.Context, _ string) (publications.Snapshot, error) {
	// Include the current full-projection integrity and decoding cost, but no I/O.
	_ = canonical.Hash(r.body)
	var snapshot publications.Snapshot
	err := json.Unmarshal(r.body, &snapshot)
	return snapshot, err
}

func (r projectionReader) SaveProjection(context.Context, string, []byte) error { return nil }
func (r projectionReader) LoadProjection(_ context.Context, _, sha string, size int64) ([]byte, error) {
	if canonical.Hash(r.body) != sha || int64(len(r.body)) != size {
		return nil, fmt.Errorf("invalid fixture")
	}
	return r.body, nil
}

type cachedProjectionReader struct {
	projectionReader
	sha   string
	cache *publications.SnapshotCache
}

func (r cachedProjectionReader) Snapshot(ctx context.Context, _ string) (publications.Snapshot, error) {
	return r.cache.Load(ctx, "fixture", r.sha, int64(len(r.body)))
}

func performanceSnapshot(b *testing.B, count int) publications.Snapshot {
	b.Helper()
	s := publications.Snapshot{Publication: strings.Repeat("a", 64), Manifest: publications.Manifest{Catalog: publications.CurrentCatalog()}, Nodes: map[string]publications.Node{}}
	value := "700.25"
	for i := range count {
		id := fmt.Sprintf("%064x", i)
		date := time.Date(2012+i/324, time.Month(1+(i/27)%12), 1, 0, 0, 0, 0, time.UTC)
		start, end := date.Format("2006-01-02"), date.AddDate(0, 1, -1).Format("2006-01-02")
		geography := fmt.Sprintf("capital-%02d", i%27)
		s.Manifest.Scope = append(s.Manifest.Scope, publications.Slot{Series: "cv4", Geography: geography, Start: start, End: end, ID: id})
		s.Nodes[id] = publications.Node{Input: indicators.Input{ID: id, Series: "cv4", Geography: geography, Start: start, End: end, Value: &value, Status: "valid", Context: map[string]any{"unit": "BRL/basket", "method": "fixture/1", "frequency": "monthly"}}, Origins: []publications.Origin{{URL: "https://example.test/fixture", SHA256: strings.Repeat("b", 64)}}}
	}
	return s
}

func BenchmarkPublicationAPI(b *testing.B) {
	for _, count := range []int{100, 6375, 20000} {
		snapshot := performanceSnapshot(b, count)
		body, err := json.Marshal(snapshot)
		if err != nil || len(body) > publications.MaxProjection {
			b.Fatalf("invalid fixture: %d bytes, %v", len(body), err)
		}
		for _, decode := range []bool{false, true} {
			name := fmt.Sprintf("slots=%d/decode=%t", count, decode)
			b.Run(name, func(b *testing.B) {
				var source Reader = reader{snapshot}
				if decode {
					source = projectionReader{body: body}
				}
				h := (&API{Reader: source}).Handler() // no per-IP rate cap for CPU measurement
				r := httptest.NewRequest("GET", "/api/v1/series/cv4?publication="+snapshot.Publication+"&geography=capital-00&limit=50", nil)
				b.ReportAllocs()
				for b.Loop() {
					w := httptest.NewRecorder()
					h.ServeHTTP(w, r)
					if w.Code != 200 {
						b.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
					}
				}
				b.ReportMetric(float64(len(body)), "projection-bytes")
			})
		}
	}
}

func BenchmarkCachedPublicationAPI(b *testing.B) {
	for _, count := range []int{100, 6375, 20000} {
		snapshot := performanceSnapshot(b, count)
		body, err := json.Marshal(snapshot)
		if err != nil || len(body) > publications.MaxProjection {
			b.Fatal("invalid fixture", err)
		}
		for _, cold := range []bool{false, true} {
			b.Run(fmt.Sprintf("slots=%d/cold=%t", count, cold), func(b *testing.B) {
				r := cachedProjectionReader{projectionReader: projectionReader{body: body}, sha: canonical.Hash(body)}
				r.cache = publications.NewSnapshotCache(r.projectionReader, publications.MaxProjection, time.Hour)
				if _, err := r.Snapshot(context.Background(), snapshot.Publication); err != nil {
					b.Fatal(err)
				}
				a := &API{Reader: r}
				h := a.Handler()
				req := httptest.NewRequest("GET", "/api/v1/series/cv4?publication="+snapshot.Publication+"&geography=capital-00&limit=50", nil)
				b.ReportAllocs()
				b.ResetTimer()
				for b.Loop() {
					if cold {
						r.cache = publications.NewSnapshotCache(r.projectionReader, publications.MaxProjection, time.Hour)
						a.Reader = r
					}
					w := httptest.NewRecorder()
					h.ServeHTTP(w, req)
					if w.Code != 200 {
						b.Fatal(w.Code)
					}
				}
				b.ReportMetric(float64(len(body)), "projection-bytes")
			})
		}
	}
}
