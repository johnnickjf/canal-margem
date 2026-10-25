package ingestion

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"io"
	"log/slog"
	"margem/backend/internal/observations"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var allowedHosts = map[string]bool{"servicodados.ibge.gov.br": true, "api.bcb.gov.br": true, "ftp.ibge.gov.br": true, "www.gov.br": true, "www.dieese.org.br": true, "fjp.mg.gov.br": true, "docs.google.com": true, "drive.google.com": true, "drive.usercontent.google.com": true, "sheets.google.com": true}

func allowedURL(raw string) bool {
	u, e := url.Parse(raw)
	return e == nil && u.Scheme == "https" && u.User == nil && (u.Port() == "" || u.Port() == "443") && (allowedHosts[u.Hostname()] || strings.HasSuffix(u.Hostname(), "-sheets.googleusercontent.com"))
}

type HTTPFetcher struct {
	DB     *pgx.Conn
	Store  objectstore.Store
	Run    pgtype.UUID
	Client *http.Client
	Wait   func(context.Context, time.Duration) error
}

func NewHTTPFetcher(db *pgx.Conn, store objectstore.Store, run pgtype.UUID) *HTTPFetcher {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = (&net.Dialer{Timeout: 15 * time.Second}).DialContext
	return &HTTPFetcher{DB: db, Store: store, Run: run, Client: &http.Client{Timeout: 60 * time.Second, Transport: transport, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}, Wait: func(ctx context.Context, d time.Duration) error {
		t := time.NewTimer(d)
		defer t.Stop()
		select {
		case <-t.C:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}}
}
func (f *HTTPFetcher) Close() { f.Client.CloseIdleConnections() }
func recordEvent(ctx context.Context, db postgres.DBTX, run pgtype.UUID, event string, detail map[string]any) error {
	b, e := canonical.Bytes(detail)
	if e != nil {
		return e
	}
	if e = postgres.New(db).CreateEvent(ctx, postgres.CreateEventParams{Run: run, Event: event, Detail: b}); e != nil {
		return e
	}
	slog.Info("pipeline", "run", postgres.UUIDString(run), "event", event, "detail", detail)
	return nil
}
func (f *HTTPFetcher) recordFetchFailure(ctx context.Context, url string, attempt int, started time.Time, cause error) error {
	return recordEvent(ctx, f.DB, f.Run, "fetch_failed", map[string]any{
		"url": url, "attempt": attempt, "duration_ms": time.Since(started).Milliseconds(), "error": Failure(cause),
	})
}
func (f *HTTPFetcher) capture(ctx context.Context, u string, status int, headers map[string]string, body []byte) error {
	sha, key, e := f.Store.Save(ctx, body)
	if e != nil {
		return e
	}
	b, e := canonical.Bytes(headers)
	if e != nil {
		return e
	}
	tx, e := f.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	q := postgres.New(tx)
	if e = q.CreateRawObject(ctx, postgres.CreateRawObjectParams{Sha256: sha, Key: key, Bytes: int64(len(body))}); e != nil {
		return e
	}
	if e = q.CreateCapture(ctx, postgres.CreateCaptureParams{ID: postgres.NewUUID(), Run: f.Run, Object: sha, Url: u, Status: int32(status), Headers: b}); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (f *HTTPFetcher) Get(ctx context.Context, u string) ([]byte, error) {
	for attempt := 0; attempt < 3; attempt++ {
		body, retry, e := f.attempt(ctx, u, attempt+1)
		if e == nil {
			return body, nil
		}
		if !retry {
			return nil, e
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if e = recordEvent(ctx, f.DB, f.Run, "retry", map[string]any{"url": u, "attempt": attempt + 1}); e != nil {
			return nil, e
		}
		if attempt == 2 {
			return nil, observations.Invalid("fonte indisponível após 3 tentativas: %s", u)
		}
		if e = f.Wait(ctx, time.Second*time.Duration(1<<attempt)); e != nil {
			return nil, e
		}
	}
	return nil, observations.Invalid("fonte indisponível")
}
func (f *HTTPFetcher) attempt(ctx context.Context, original string, attempt int) ([]byte, bool, error) {
	current := original
	for range 6 {
		if !allowedURL(current) {
			return nil, false, observations.Invalid("URL fora das fontes")
		}
		req, e := http.NewRequestWithContext(ctx, http.MethodGet, current, nil)
		if e != nil {
			return nil, false, e
		}
		req.Header.Set("User-Agent", "MargemPipeline/0.1")
		started := time.Now()
		response, e := f.Client.Do(req)
		if e != nil {
			if recordErr := f.recordFetchFailure(ctx, current, attempt, started, e); recordErr != nil {
				return nil, false, recordErr
			}
			var netErr net.Error
			return nil, errors.As(e, &netErr), e
		}
		body, e := io.ReadAll(io.LimitReader(response.Body, 64<<20+1))
		response.Body.Close()
		if e != nil {
			if recordErr := f.recordFetchFailure(ctx, current, attempt, started, e); recordErr != nil {
				return nil, false, recordErr
			}
			return nil, true, e
		}
		if len(body) > 64<<20 {
			e = observations.Invalid("resposta excede 64 MiB")
			if recordErr := f.recordFetchFailure(ctx, current, attempt, started, e); recordErr != nil {
				return nil, false, recordErr
			}
			return nil, false, e
		}
		headers := map[string]string{}
		for _, k := range []string{"content-type", "etag", "last-modified", "location"} {
			if v := response.Header.Get(k); v != "" {
				headers[k] = v
			}
		}
		if e = f.capture(ctx, current, response.StatusCode, headers, body); e != nil {
			return nil, false, e
		}
		if e = recordEvent(ctx, f.DB, f.Run, "fetch", map[string]any{"url": current, "status": response.StatusCode, "bytes": len(body), "attempt": attempt, "duration_ms": time.Since(started).Milliseconds()}); e != nil {
			return nil, false, e
		}
		status := response.StatusCode
		if status == 301 || status == 302 || status == 303 || status == 307 || status == 308 {
			base, _ := url.Parse(current)
			loc, e := url.Parse(response.Header.Get("Location"))
			if e != nil || response.Header.Get("Location") == "" {
				return nil, false, observations.Invalid("redirect inválido")
			}
			current = base.ResolveReference(loc).String()
			continue
		}
		if status == 429 || status >= 500 {
			return nil, true, observations.Invalid("HTTP %d", status)
		}
		if status < 200 || status >= 300 {
			return nil, false, observations.Invalid("HTTP %d: %s", status, current)
		}
		return body, false, nil
	}
	return nil, false, observations.Invalid("redirecionamentos em excesso")
}
