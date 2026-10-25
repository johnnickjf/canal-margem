package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strconv"

	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/publications"
)

type historyCursor struct {
	Context string `json:"context"`
	Before  int64  `json:"before"`
}

func (a *API) history(w http.ResponseWriter, r *http.Request) {
	values, err := parseQuery(r)
	if err != nil {
		a.fail(w, err)
		return
	}
	for key, entries := range values {
		if (key != "limit" && key != "cursor") || len(entries) != 1 || entries[0] == "" {
			a.fail(w, publications.Fail("invalid_request", "parâmetro inválido: "+key))
			return
		}
	}
	limit := 50
	if raw := values.Get("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 200 {
			a.fail(w, publications.Fail("invalid_request", "limit deve estar entre 1 e 200"))
			return
		}
	}
	fingerprint, _ := canonical.Digest([]any{"api-v1-publication-history", limit, "generation-desc"})
	before := int64(0)
	if raw := values.Get("cursor"); raw != "" {
		body, decodeErr := base64.RawURLEncoding.DecodeString(raw)
		var cursor historyCursor
		if decodeErr != nil || len(body) > 512 || json.Unmarshal(body, &cursor) != nil || cursor.Context != fingerprint || cursor.Before < 1 {
			a.fail(w, publications.Fail("invalid_request", "cursor inválido"))
			return
		}
		before = cursor.Before
	}
	items, err := a.Reader.History(r.Context(), before, limit+1)
	if err != nil {
		a.fail(w, err)
		return
	}
	next := ""
	if len(items) > limit {
		items = items[:limit]
		body, _ := canonical.Bytes(historyCursor{Context: fingerprint, Before: items[len(items)-1].Generation})
		next = base64.RawURLEncoding.EncodeToString(body)
	}
	w.Header().Set("Cache-Control", "public, max-age=0, s-maxage=60, must-revalidate")
	a.write(w, r, historyEnvelope{Data: items, NextCursor: next}, false)
}
