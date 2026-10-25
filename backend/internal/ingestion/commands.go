package ingestion

import (
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"margem/backend/internal/catalog"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
	"time"
)

type Result struct {
	Source string `json:"source"`
	Status string `json:"status"`
	*observations.Acceptance
	Error string `json:"error,omitempty"`
}
type Commands struct {
	Pool           *pgxpool.Pool
	Store          objectstore.Store
	Sources        map[string]Source
	FetcherFactory func(*pgx.Conn, objectstore.Store, pgtype.UUID) Fetcher
}

func Failure(err error) string {
	var quality *observations.QualityError
	if errors.As(err, &quality) {
		return quality.Error()
	}
	if errors.Is(err, context.Canceled) {
		return "cancelled"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	return fmt.Sprintf("%T", err)
}

func (c Commands) Run(ctx context.Context, source string, w period.Window, force bool) (result Result, err error) {
	result = Result{Source: source}
	started := time.Now()
	defer func() {
		status := result.Status
		if err != nil {
			status = "failed"
		}
		fields := []any{"source", source, "status", status, "duration_ms", time.Since(started).Milliseconds()}
		if result.Acceptance != nil {
			fields = append(fields, "run", result.Acceptance.Run, "batch", result.Acceptance.Batch, "observations", result.Acceptance.Observations, "changed", result.Acceptance.Changed)
		}
		if err != nil {
			fields = append(fields, "error", Failure(err))
			slog.Error("pipeline job finalizado", fields...)
			return
		}
		slog.Info("pipeline job finalizado", fields...)
	}()
	index := -1
	for i, s := range catalog.Sources {
		if s == source {
			index = i
		}
	}
	if index < 0 {
		return result, observations.Invalid("fonte desconhecida")
	}
	jobs := c.Sources
	if jobs == nil {
		jobs = Sources
	}
	job := jobs[source]
	if job == nil {
		return result, observations.Invalid("adaptador ausente")
	}
	slog.Info("pipeline job iniciado", "source", source, "window_start", w.Start.Format(period.Layout), "window_end", w.End.Format(period.Layout), "forced", force)
	session, e := c.Pool.Acquire(ctx)
	if e != nil {
		return result, e
	}
	db := session.Conn()
	locked := false
	discard := false
	lock := int64(740710 + index)
	defer func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if locked {
			var ok bool
			if e := db.QueryRow(cleanup, "SELECT pg_advisory_unlock($1)", lock).Scan(&ok); e != nil || !ok {
				discard = true
			}
		}
		if discard {
			session.Hijack().Close(cleanup)
		} else {
			session.Release()
		}
	}()
	if e = db.QueryRow(ctx, "SELECT pg_try_advisory_lock($1)", lock).Scan(&locked); e != nil {
		return result, e
	}
	if !locked {
		result.Status = "busy"
		return result, nil
	}
	q := postgres.New(db)
	if e = q.FailOrphanedRuns(ctx, source); e != nil {
		return result, e
	}
	if !force {
		recent, e := q.RecentRunExists(ctx, postgres.RecentRunExistsParams{Source: source, Catalog: catalog.Version, WindowStart: postgres.Date(w.Start), WindowEnd: postgres.Date(w.End), Hours: int32(catalog.CadenceHours[source])})
		if e != nil {
			return result, e
		}
		if recent {
			result.Status = "not-due"
			return result, nil
		}
	}
	run := postgres.NewUUID()
	if e = q.CreateRun(ctx, postgres.CreateRunParams{ID: run, Source: source, Catalog: catalog.Version, WindowStart: postgres.Date(w.Start), WindowEnd: postgres.Date(w.End)}); e != nil {
		return result, e
	}
	defer func() {
		if err == nil {
			return
		}
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		message := Failure(err)
		if len(message) > 1000 {
			message = message[:1000]
		}
		if e := q.FailRun(cleanup, postgres.FailRunParams{ID: run, Error: postgres.Text(message)}); e != nil {
			slog.Error("falha ao registrar término do job", "source", source)
			discard = true
			return
		}
		if e := recordEvent(cleanup, db, run, "failed", map[string]any{"error": message}); e != nil {
			slog.Error("falha ao registrar evento do job", "source", source)
		}
	}()
	if e = recordEvent(ctx, db, run, "started", map[string]any{"source": source}); e != nil {
		return result, e
	}
	var f Fetcher
	if c.FetcherFactory != nil {
		f = c.FetcherFactory(db, c.Store, run)
	} else {
		f = NewHTTPFetcher(db, c.Store, run)
	}
	if closer, ok := f.(interface{ Close() }); ok {
		defer closer.Close()
	}
	rows, e := job(ctx, f, w)
	if e != nil {
		return result, e
	}
	for _, o := range rows {
		s, ok := catalog.ByID[o.Series]
		if !ok || s.Source != source {
			return result, observations.Invalid("série não pertence à fonte do job")
		}
	}
	accepted, e := (observations.Commands{DB: db, Store: c.Store}).Accept(ctx, run, source, w, rows)
	if e != nil {
		return result, e
	}
	result.Status = "succeeded"
	result.Acceptance = &accepted
	return result, nil
}
func (c Commands) Tick(ctx context.Context, w period.Window) []Result {
	results := make([]Result, 0, len(catalog.Sources))
	for _, source := range catalog.Sources {
		r, e := c.Run(ctx, source, w, false)
		if e != nil {
			r = Result{Source: source, Status: "failed", Error: Failure(e)}
		}
		results = append(results, r)
	}
	return results
}
