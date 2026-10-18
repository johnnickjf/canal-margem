package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"

	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/publications"
)

type cursor struct {
	Context string `json:"context"`
	Offset  int    `json:"offset"`
}

func parseQuery(r *http.Request) (url.Values, error) {
	values, e := url.ParseQuery(r.URL.RawQuery)
	if e != nil {
		return nil, publications.Fail("invalid_request", "query inválida")
	}
	return values, nil
}
func page[T any](r *http.Request, publication string, items []T) ([]T, string, error) {
	values := r.URL.Query()
	limit := 50
	if s := values.Get("limit"); s != "" {
		n, e := strconv.Atoi(s)
		if e != nil || n < 1 || n > 200 {
			return nil, "", publications.Fail("invalid_request", "limit deve estar entre 1 e 200")
		}
		limit = n
	}
	values.Del("cursor")
	values.Set("limit", strconv.Itoa(limit))
	fp, _ := canonical.Digest([]any{"api-v1", r.URL.Path, publication, values.Encode(), "ascending"})
	offset := 0
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		b, e := base64.RawURLEncoding.DecodeString(raw)
		if e != nil || len(b) > 512 {
			return nil, "", publications.Fail("invalid_request", "cursor inválido")
		}
		var c cursor
		if e = json.Unmarshal(b, &c); e != nil {
			return nil, "", publications.Fail("invalid_request", "cursor inválido")
		}
		if c.Context != fp {
			return nil, "", publications.Fail("cursor_context_mismatch", "cursor pertence a outro contexto")
		}
		if c.Offset < 0 || c.Offset > len(items) {
			return nil, "", publications.Fail("invalid_request", "posição do cursor inválida")
		}
		offset = c.Offset
	}
	end := min(offset+limit, len(items))
	next := ""
	if end < len(items) {
		b, _ := canonical.Bytes(cursor{fp, end})
		next = base64.RawURLEncoding.EncodeToString(b)
	}
	return items[offset:end], next, nil
}
