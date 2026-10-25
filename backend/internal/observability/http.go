// Package observability exposes bounded-cardinality HTTP and process metrics.
package observability

import (
	"fmt"
	"net/http"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

var latencyBuckets = [...]float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

type requestKey struct {
	method string
	route  string
	status string
}

type requestSample struct {
	count    uint64
	duration float64
	buckets  [len(latencyBuckets)]uint64
}

type Metrics struct {
	started  time.Time
	mu       sync.Mutex
	requests map[requestKey]requestSample
}

type CacheStats struct {
	Hits, Misses, Coalesced, Errors uint64
	Entries                         int
	SerializedBytes                 int64
}

func New() *Metrics {
	return &Metrics{started: time.Now(), requests: map[requestKey]requestSample{}}
}

func (m *Metrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		started := time.Now()
		wrapped := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		defer func() {
			m.observe(requestKey{method: methodLabel(r.Method), route: routeLabel(r.URL.Path), status: statusClass(wrapped.status)}, time.Since(started))
		}()
		next.ServeHTTP(wrapped, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (w *statusWriter) WriteHeader(status int) {
	if w.wrote {
		return
	}
	w.status = status
	w.wrote = true
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(body []byte) (int, error) {
	if !w.wrote {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(body)
}

func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (m *Metrics) observe(key requestKey, elapsed time.Duration) {
	seconds := elapsed.Seconds()
	m.mu.Lock()
	sample := m.requests[key]
	sample.count++
	sample.duration += seconds
	for i, boundary := range latencyBuckets {
		if seconds <= boundary {
			sample.buckets[i]++
		}
	}
	m.requests[key] = sample
	m.mu.Unlock()
}

func (m *Metrics) Handler(cache func() (CacheStats, bool)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		m.Write(w, cache)
	})
}

func (m *Metrics) Write(w http.ResponseWriter, cache func() (CacheStats, bool)) {
	m.mu.Lock()
	snapshot := make(map[requestKey]requestSample, len(m.requests))
	for key, sample := range m.requests {
		snapshot[key] = sample
	}
	m.mu.Unlock()

	keys := make([]requestKey, 0, len(snapshot))
	for key := range snapshot {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		a, b := keys[i], keys[j]
		if a.route != b.route {
			return a.route < b.route
		}
		if a.method != b.method {
			return a.method < b.method
		}
		return a.status < b.status
	})

	fmt.Fprintln(w, "# HELP margem_http_requests_total HTTP requests by bounded route, method and status class.")
	fmt.Fprintln(w, "# TYPE margem_http_requests_total counter")
	for _, key := range keys {
		sample := snapshot[key]
		fmt.Fprintf(w, "margem_http_requests_total{method=%q,route=%q,status=%q} %d\n", key.method, key.route, key.status, sample.count)
	}
	fmt.Fprintln(w, "# HELP margem_http_request_duration_seconds HTTP request duration in seconds.")
	fmt.Fprintln(w, "# TYPE margem_http_request_duration_seconds histogram")
	for _, key := range keys {
		sample := snapshot[key]
		for i, boundary := range latencyBuckets {
			fmt.Fprintf(w, "margem_http_request_duration_seconds_bucket{method=%q,route=%q,status=%q,le=%q} %d\n", key.method, key.route, key.status, fmt.Sprint(boundary), sample.buckets[i])
		}
		fmt.Fprintf(w, "margem_http_request_duration_seconds_bucket{method=%q,route=%q,status=%q,le=\"+Inf\"} %d\n", key.method, key.route, key.status, sample.count)
		fmt.Fprintf(w, "margem_http_request_duration_seconds_sum{method=%q,route=%q,status=%q} %g\n", key.method, key.route, key.status, sample.duration)
		fmt.Fprintf(w, "margem_http_request_duration_seconds_count{method=%q,route=%q,status=%q} %d\n", key.method, key.route, key.status, sample.count)
	}

	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)
	fmt.Fprintln(w, "# HELP margem_process_uptime_seconds Process uptime in seconds.")
	fmt.Fprintln(w, "# TYPE margem_process_uptime_seconds gauge")
	fmt.Fprintf(w, "margem_process_uptime_seconds %g\n", time.Since(m.started).Seconds())
	fmt.Fprintln(w, "# HELP margem_go_goroutines Number of current goroutines.")
	fmt.Fprintln(w, "# TYPE margem_go_goroutines gauge")
	fmt.Fprintf(w, "margem_go_goroutines %d\n", runtime.NumGoroutine())
	fmt.Fprintln(w, "# HELP margem_go_heap_alloc_bytes Bytes of allocated Go heap objects.")
	fmt.Fprintln(w, "# TYPE margem_go_heap_alloc_bytes gauge")
	fmt.Fprintf(w, "margem_go_heap_alloc_bytes %d\n", memory.HeapAlloc)

	if cache != nil {
		if stats, ok := cache(); ok {
			fmt.Fprintln(w, "# HELP margem_snapshot_cache_requests_total Snapshot cache requests by result.")
			fmt.Fprintln(w, "# TYPE margem_snapshot_cache_requests_total counter")
			fmt.Fprintf(w, "margem_snapshot_cache_requests_total{result=\"hit\"} %d\n", stats.Hits)
			fmt.Fprintf(w, "margem_snapshot_cache_requests_total{result=\"miss\"} %d\n", stats.Misses)
			fmt.Fprintf(w, "margem_snapshot_cache_requests_total{result=\"coalesced\"} %d\n", stats.Coalesced)
			fmt.Fprintf(w, "margem_snapshot_cache_requests_total{result=\"error\"} %d\n", stats.Errors)
			fmt.Fprintln(w, "# HELP margem_snapshot_cache_entries Current retained snapshot count.")
			fmt.Fprintln(w, "# TYPE margem_snapshot_cache_entries gauge")
			fmt.Fprintf(w, "margem_snapshot_cache_entries %d\n", stats.Entries)
			fmt.Fprintln(w, "# HELP margem_snapshot_cache_serialized_bytes Current serialized bytes retained by snapshot cache.")
			fmt.Fprintln(w, "# TYPE margem_snapshot_cache_serialized_bytes gauge")
			fmt.Fprintf(w, "margem_snapshot_cache_serialized_bytes %d\n", stats.SerializedBytes)
		}
	}
}

func methodLabel(method string) string {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodPost, http.MethodOptions:
		return method
	default:
		return "other"
	}
}

func statusClass(status int) string {
	if status < 100 || status > 599 {
		return "other"
	}
	return fmt.Sprintf("%dxx", status/100)
}

func routeLabel(path string) string {
	switch path {
	case "/healthz", "/readyz", "/api/v1/publications/current", "/api/v1/themes", "/api/v1/indicators", "/api/v1/comparisons", "/api/v1/work-time", "/api/v1/calculator":
		return path
	}
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 4 && parts[0] == "api" && parts[1] == "v1" {
		switch parts[2] {
		case "themes":
			return "/api/v1/themes/{slug}"
		case "indicators":
			return "/api/v1/indicators/{slug}"
		case "series":
			return "/api/v1/series/{series}"
		case "sources":
			return "/api/v1/sources/{source}"
		case "observations":
			return "/api/v1/observations/{id}"
		case "publications":
			return "/api/v1/publications/{publication}"
		}
	}
	if len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "indicators" && parts[4] == "series" {
		return "/api/v1/indicators/{slug}/series"
	}
	return "not_found"
}
