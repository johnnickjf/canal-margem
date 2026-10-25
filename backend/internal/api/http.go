// Package api serves only immutable, previously activated Margem publications.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/publications"
)

type Reader interface {
	Resolve(context.Context, time.Time) (publications.Activation, error)
	Snapshot(context.Context, string) (publications.Snapshot, error)
}
type API struct {
	Reader  Reader
	Rate    int
	mu      sync.Mutex
	clients map[string]window
	slots   chan struct{}
}
type window struct {
	at    time.Time
	count int
}
type envelope struct {
	Publication     string `json:"publication"`
	CatalogRevision string `json:"catalog_revision"`
	Data            any    `json:"data"`
	NextCursor      string `json:"next_cursor,omitempty"`
}
type errorBody struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func New(reader Reader) http.Handler {
	a := &API{Reader: reader, Rate: 120, clients: map[string]window{}, slots: make(chan struct{}, 8)}
	return a.Handler()
}
func (a *API) Handler() http.Handler {
	if a.clients == nil {
		a.clients = map[string]window{}
	}
	if a.slots == nil {
		a.slots = make(chan struct{}, 8)
	}
	r := chi.NewRouter()
	r.Use(a.guard)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		a.write(w, r, map[string]string{"status": "ok"}, false)
	})
	r.Get("/api/v1/publications/current", a.current)
	r.Get("/api/v1/themes", a.read)
	r.Get("/api/v1/themes/{slug}", a.read)
	r.Get("/api/v1/indicators", a.read)
	r.Get("/api/v1/indicators/{slug}", a.read)
	r.Get("/api/v1/indicators/{slug}/series", a.read)
	r.Get("/api/v1/series/{series}", a.read)
	r.Get("/api/v1/sources/{source}", a.read)
	r.Get("/api/v1/comparisons", a.read)
	r.Get("/api/v1/work-time", a.read)
	r.Post("/api/v1/calculator", a.calculate)
	r.Get("/api/v1/observations/{id}", a.read)
	r.Get("/api/v1/publications/{publication}", a.read)
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		a.fail(w, publications.Fail("not_found", "rota inexistente"))
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Allow", "GET, HEAD, OPTIONS")
		if r.URL.Path == "/api/v1/calculator" {
			w.Header().Set("Allow", "POST, OPTIONS")
		}
		a.failStatus(w, 405, "method_not_allowed", "método não permitido")
	})
	return r
}
func (a *API) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w = headWriter{w}
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Expose-Headers", "ETag, Age, Retry-After")
		defer func() {
			if recover() != nil {
				a.failStatus(w, 500, "internal_error", "falha interna")
			}
		}()
		calculatorPost := r.Method == http.MethodPost && r.URL.Path == "/api/v1/calculator"
		if len(r.RequestURI) > 4096 || (!calculatorPost && (r.ContentLength > 0 || r.ContentLength < 0)) || (calculatorPost && r.ContentLength > 4096) {
			a.failStatus(w, 400, "invalid_request", "requisição excede limites ou contém corpo")
			return
		}
		if !a.allow(r.RemoteAddr) {
			w.Header().Set("Retry-After", "60")
			a.failStatus(w, 429, "rate_limited", "limite de requisições atingido")
			return
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "If-None-Match")
			if r.URL.Path == "/api/v1/calculator" {
				w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			}
			w.WriteHeader(204)
			return
		}
		select {
		case a.slots <- struct{}{}:
			defer func() { <-a.slots }()
		default:
			w.Header().Set("Retry-After", "1")
			a.failStatus(w, 503, "temporarily_unavailable", "capacidade temporariamente ocupada")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		r = r.WithContext(ctx)
		if r.Method == http.MethodHead {
			clone := r.Clone(ctx)
			clone.Method = http.MethodGet
			r = clone
		}
		next.ServeHTTP(w, r)
	})
}

type headWriter struct{ http.ResponseWriter }

func (w headWriter) Write(b []byte) (int, error) { return len(b), nil }
func (a *API) allow(remote string) bool {
	ip, _, e := net.SplitHostPort(remote)
	if e != nil {
		ip = remote
	}
	now := time.Now()
	a.mu.Lock()
	defer a.mu.Unlock()
	for key, value := range a.clients {
		if now.Sub(value.at) >= time.Minute {
			delete(a.clients, key)
		}
	}
	value, exists := a.clients[ip]
	if !exists {
		if len(a.clients) >= 10000 {
			return false
		}
		value.at = now
	}
	if a.Rate > 0 && value.count >= a.Rate {
		return false
	}
	value.count++
	a.clients[ip] = value
	return true
}
func (a *API) fail(w http.ResponseWriter, e error) {
	var domain *publications.Error
	if errors.As(e, &domain) {
		status := map[string]int{"invalid_request": 400, "not_found": 404, "not_covered": 404, "ambiguous_selection": 409, "conflict": 409, "cursor_context_mismatch": 400, "context_expired": 410, "temporarily_unavailable": 503}[domain.Code]
		if status == 0 {
			status = 422
		}
		a.failStatus(w, status, domain.Code, domain.Message)
		return
	}
	a.failStatus(w, 503, "temporarily_unavailable", "publicação temporariamente indisponível")
}
func (a *API) failStatus(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Del("ETag")
	body := errorBody{}
	body.Error.Code = code
	body.Error.Message = message
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
func (a *API) write(w http.ResponseWriter, r *http.Request, data any, immutable bool) {
	body, e := canonical.Bytes(data)
	if e != nil {
		a.fail(w, e)
		return
	}
	if r.Context().Err() != nil {
		a.fail(w, r.Context().Err())
		return
	}
	if immutable {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	// Authenticated requests bypass shared cache even on public resources.
	if r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" {
		w.Header().Set("Cache-Control", "no-store")
	}
	etag := `"` + canonical.Hash(body) + `"`
	w.Header().Set("ETag", etag)
	for _, candidate := range strings.Split(r.Header.Get("If-None-Match"), ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == "*" || strings.TrimPrefix(candidate, "W/") == etag {
			w.WriteHeader(304)
			return
		}
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.Write(body)
}
func parameters(r *http.Request, allowed ...string) error {
	values, e := parseQuery(r)
	if e != nil {
		return e
	}
	known := map[string]bool{}
	for _, key := range allowed {
		known[key] = true
	}
	for key, entries := range values {
		if !known[key] || len(entries) != 1 || entries[0] == "" {
			return publications.Fail("invalid_request", fmt.Sprintf("parâmetro inválido: %s", key))
		}
	}
	return nil
}
func (a *API) current(w http.ResponseWriter, r *http.Request) {
	if e := parameters(r, "at"); e != nil {
		a.fail(w, e)
		return
	}
	at := time.Time{}
	var e error
	if value := r.URL.Query().Get("at"); value != "" {
		at, e = time.Parse(time.RFC3339Nano, value)
		if e != nil || at.After(time.Now()) {
			a.fail(w, publications.Fail("invalid_request", "at exige instante passado com fuso"))
			return
		}
	}
	activation, e := a.Reader.Resolve(r.Context(), at)
	if e != nil {
		a.fail(w, e)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=0, s-maxage=60, must-revalidate")
	a.write(w, r, activation, false)
}
