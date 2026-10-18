package integration

import (
	"context"
	"margem/backend/internal/catalog"
	"margem/backend/internal/ingestion"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/postgres"
	"testing"
	"time"
)

func TestPartialRunDoesNotSuppressReconciliation(t *testing.T) {
	for _, dates := range [][2]string{{"2012-01-01", "2025-02-28"}, {"2025-01-01", "2025-03-31"}} {
		t.Run(dates[0]+"/"+dates[1], func(t *testing.T) {
			pool, store := setup(t)
			s := newScenario(pool, store)
			s.run(t)
			// Keep the fixture's two monthly observations within the wider job window.
			original := s.commands.Sources["bcb"]
			s.commands.Sources["bcb"] = func(ctx context.Context, f ingestion.Fetcher, _ period.Window) ([]observations.Observation, error) {
				return original(ctx, f, s.window)
			}
			w, _ := period.NewWindow(dates[0], dates[1], time.Now())
			r, e := s.commands.Run(ctx, "bcb", w, false)
			if e != nil || r.Status != "succeeded" {
				t.Fatal(r, e)
			}
			r, e = s.commands.Run(ctx, "bcb", w, false)
			if e != nil || r.Status != "not-due" || s.calls != 2 {
				t.Fatal(r, e, s.calls)
			}
		})
	}
}

func TestCadenceAllowsAdvancingEndDate(t *testing.T) {
	pool, _ := setup(t)
	started := time.Now().UTC().Add(-48 * time.Hour)
	start, _ := period.Date("2012-01-01")
	end, _ := period.Date(started.Format(period.Layout))
	if _, e := pool.Exec(ctx, "INSERT INTO ops.run(id,source,catalog,status,window_start,window_end,started_at) VALUES ($1,'anp',$2,'failed',$3,$4,$5)", postgres.NewUUID(), catalog.Version, start, end, started); e != nil {
		t.Fatal(e)
	}
	args := postgres.RecentRunExistsParams{Source: "anp", Catalog: catalog.Version, WindowStart: postgres.Date(start), WindowEnd: postgres.Date(time.Now().UTC()), Hours: 168}
	q := postgres.New(pool)
	if recent, e := q.RecentRunExists(ctx, args); e != nil || !recent {
		t.Fatal(recent, e)
	}
	args.Hours = 24
	if recent, e := q.RecentRunExists(ctx, args); e != nil || recent {
		t.Fatal(recent, e)
	}
	args.Hours = 168
	args.Catalog = "other-catalog"
	if recent, e := q.RecentRunExists(ctx, args); e != nil || recent {
		t.Fatal(recent, e)
	}
	args.Catalog = catalog.Version
	if _, e := pool.Exec(ctx, "UPDATE ops.run SET window_end=window_end-1"); e != nil {
		t.Fatal(e)
	}
	if recent, e := q.RecentRunExists(ctx, args); e != nil || recent {
		t.Fatal(recent, e)
	}
}

func TestHealthRetainsSeriesHistoryAfterPartialRun(t *testing.T) {
	pool, store := setup(t)
	s := newScenario(pool, store)
	read := func(now time.Time) ingestion.HealthSource {
		t.Helper()
		h, e := (ingestion.Queries{Pool: pool, Now: func() time.Time { return now }}).Health(ctx)
		if e != nil {
			t.Fatal(e)
		}
		for _, source := range h.Sources {
			if source.Source == "bcb" {
				return source
			}
		}
		t.Fatal("BCB ausente")
		return ingestion.HealthSource{}
	}
	if h := read(s.window.End); h.Healthy || len(h.MissingSeries) != 3 {
		t.Fatal(h)
	}
	s.run(t)
	if h := read(s.window.End); h.Healthy || len(h.MissingSeries) != 2 {
		t.Fatal(h)
	}
	original := s.commands.Sources["bcb"]
	s.commands.Sources["bcb"] = func(ctx context.Context, f ingestion.Fetcher, w period.Window) ([]observations.Observation, error) {
		rows, e := original(ctx, f, w)
		if e != nil {
			return nil, e
		}
		all := append([]observations.Observation{}, rows...)
		for _, id := range []string{"vf2", "minimum-nominal"} {
			for _, o := range rows {
				start, _ := period.Date(o.Start)
				end, _ := period.Date(o.End)
				copy, e := observations.New(catalog.ByID[id], start, end, *o.Value, o.Locator, nil, o.Geography, o.Artifacts)
				if e != nil {
					return nil, e
				}
				all = append(all, copy)
			}
		}
		return all, nil
	}
	s.run(t)
	if h := read(s.window.End); !h.Healthy || len(h.Coverage) != 3 || len(h.MissingSeries) != 0 {
		t.Fatal(h)
	}
	s.commands.Sources["bcb"] = original
	s.body = []byte(`[{"data":"01/01/2025","valor":"24"}]`)
	s.window, _ = period.NewWindow("2025-01-01", "2025-01-31", time.Now())
	s.run(t)
	now, _ := period.Date("2025-02-28")
	h := read(now)
	if !h.Healthy || len(h.Coverage) != 3 {
		t.Fatal(h)
	}
	for _, c := range h.Coverage {
		if c.FirstPeriod != "2025-01-01" || c.LastPeriod != "2025-02-28" || c.Observations != 2 {
			t.Fatal(c)
		}
	}
	s.commands.Sources["bcb"] = func(ctx context.Context, f ingestion.Fetcher, w period.Window) ([]observations.Observation, error) {
		rows, e := original(ctx, f, w)
		if e != nil {
			return nil, e
		}
		rows[0].Value = nil
		rows[0].Status = "missing"
		return rows, nil
	}
	s.run(t)
	h = read(now)
	for _, c := range h.Coverage {
		if c.Series == "vf1" && (c.Unavailable != 1 || c.Observations != 2) {
			t.Fatal(c)
		}
	}
	h = read(now.AddDate(0, 0, 91))
	if h.Healthy || len(h.StaleSeries) != 2 || len(h.MissingSeries) != 0 {
		t.Fatal(h)
	}
}
