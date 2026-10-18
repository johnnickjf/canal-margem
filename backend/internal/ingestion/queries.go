package ingestion

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/catalog"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/postgres"
	"time"
)

type Coverage struct {
	Series       string `json:"series"`
	FirstPeriod  string `json:"first_period"`
	LastPeriod   string `json:"last_period"`
	Observations int64  `json:"observations"`
	Unavailable  int64  `json:"unavailable"`
}
type HealthSource struct {
	Source        string     `json:"source"`
	Healthy       bool       `json:"healthy"`
	Latest        any        `json:"latest"`
	LastSuccess   any        `json:"last_success"`
	Coverage      []Coverage `json:"coverage"`
	StaleSeries   []string   `json:"stale_series"`
	MissingSeries []string   `json:"missing_series"`
}
type Health struct {
	Healthy bool           `json:"healthy"`
	Sources []HealthSource `json:"sources"`
}
type Queries struct {
	Pool *pgxpool.Pool
	Now  func() time.Time
}

func (q Queries) Health(ctx context.Context) (Health, error) {
	now := time.Now()
	if q.Now != nil {
		now = q.Now()
	}
	today, _ := period.Date(now.Format(period.Layout))
	result := Health{Healthy: true, Sources: []HealthSource{}}
	db := postgres.New(q.Pool)
	for _, source := range catalog.Sources {
		s := HealthSource{Source: source, Coverage: []Coverage{}, StaleSeries: []string{}, MissingSeries: []string{}}
		latest, e := db.LatestRun(ctx, source)
		if e != nil && !errors.Is(e, pgx.ErrNoRows) {
			return result, e
		}
		hasLatest := e == nil
		if hasLatest {
			s.Latest = map[string]any{"id": postgres.UUIDString(latest.ID), "status": latest.Status, "started_at": latest.StartedAt, "finished_at": latest.FinishedAt, "error": latest.Error, "observations": latest.Observations, "changed": latest.Changed}
		}
		success, e := db.LatestSuccessfulRun(ctx, source)
		if e != nil && !errors.Is(e, pgx.ErrNoRows) {
			return result, e
		}
		if e == nil {
			s.LastSuccess = map[string]any{"finished_at": success.FinishedAt, "batch": success.Batch}
		}
		coverage, e := db.AcceptedSourceCoverage(ctx, postgres.AcceptedSourceCoverageParams{Source: source, Catalog: catalog.Version})
		if e != nil {
			return result, e
		}
		present := map[string]bool{}
		for _, c := range coverage {
			s.Coverage = append(s.Coverage, Coverage{c.Series, c.FirstPeriod.Time.Format(period.Layout), c.LastPeriod.Time.Format(period.Layout), c.Observations, c.Unavailable})
			spec, ok := catalog.ByID[c.Series]
			if !ok {
				return result, errors.New("série aceita ausente no catálogo")
			}
			present[c.Series] = true
			if spec.Last != "9999-12-31" {
				continue
			}
			limit := map[string]int{"weekly": 21, "monthly": 90, "quarterly": 200, "annual": 1100}[spec.Frequency]
			if spec.ID == "vf1" {
				limit = 120
			}
			if today.Sub(c.LastPeriod.Time) > time.Duration(limit)*24*time.Hour {
				s.StaleSeries = append(s.StaleSeries, c.Series)
			}
		}
		for _, spec := range catalog.Series {
			if spec.Source == source && spec.First <= today.Format(period.Layout) && !present[spec.ID] {
				s.MissingSeries = append(s.MissingSeries, spec.ID)
			}
		}

		fresh, e := db.RecentSuccessExists(ctx, postgres.RecentSuccessExistsParams{Source: source, Hours: int32(catalog.CadenceHours[source] * 2)})
		if e != nil {
			return result, e
		}
		s.Healthy = fresh && hasLatest && latest.Status != "failed" && len(s.StaleSeries) == 0 && len(s.MissingSeries) == 0
		result.Healthy = result.Healthy && s.Healthy
		result.Sources = append(result.Sources, s)
	}
	return result, nil
}
