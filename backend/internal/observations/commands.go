package observations

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"margem/backend/internal/catalog"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
	"sort"
)

type Acceptance struct {
	Run          string `json:"run"`
	Batch        string `json:"batch"`
	Observations int    `json:"observations"`
	Changed      int    `json:"changed"`
}
type Commands struct {
	DB    *pgx.Conn
	Store objectstore.Store
}

func (c Commands) Accept(ctx context.Context, run pgtype.UUID, source string, w period.Window, rows []Observation) (Acceptance, error) {
	result := Acceptance{}
	if e := Validate(rows); e != nil {
		return result, e
	}
	q := postgres.New(c.DB)
	captures, e := q.GetRunCaptures(ctx, run)
	if e != nil {
		return result, e
	}
	if len(captures) == 0 {
		return result, Invalid("lote sem raw")
	}
	byHash := map[string]pgtype.UUID{}
	for _, cap := range captures {
		if cap.Status >= 200 && cap.Status < 300 {
			byHash[cap.Sha256] = cap.CaptureID
		}
		if e = c.Store.Verify(ctx, cap.Key, cap.Sha256, cap.Bytes); e != nil {
			return result, e
		}
	}
	ids := make([]string, len(rows))
	for i, o := range rows {
		for _, h := range o.Artifacts {
			if !byHash[h].Valid {
				return result, Invalid("referência raw não capturada neste run")
			}
		}
		ids[i], e = o.ID()
		if e != nil {
			return result, e
		}
	}
	sorted := append([]string{}, ids...)
	sort.Strings(sorted)
	batch, e := canonical.Digest([]any{source, catalog.Version, w.Start.Format(period.Layout), w.End.Format(period.Layout), sorted})
	if e != nil {
		return result, e
	}
	tx, e := c.DB.Begin(ctx)
	if e != nil {
		return result, e
	}
	defer tx.Rollback(ctx)
	q = q.WithTx(tx)
	record, e := q.LockRun(ctx, run)
	if e != nil {
		return result, e
	}
	if record.Status != "running" || record.Source != source || record.Catalog != catalog.Version || !record.WindowStart.Time.Equal(w.Start) || !record.WindowEnd.Time.Equal(w.End) {
		return result, Invalid("execução incompatível com o lote")
	}
	previous, e := q.LatestSuccessfulRun(ctx, source)
	if e != nil && !errors.Is(e, pgx.ErrNoRows) {
		return result, e
	}
	prior := map[string]bool{}
	if e == nil {
		old, e := q.BatchObservationIDs(ctx, previous.Batch.String)
		if e != nil {
			return result, e
		}
		for _, id := range old {
			prior[id] = true
		}
	}
	if e = q.CreateBatch(ctx, postgres.CreateBatchParams{ID: batch, Source: source, Catalog: catalog.Version, WindowStart: postgres.Date(w.Start), WindowEnd: postgres.Date(w.End)}); e != nil {
		return result, e
	}
	changed := 0
	for i, o := range rows {
		if !prior[ids[i]] {
			changed++
		}
		a, e := period.Date(o.Start)
		if e != nil {
			return result, e
		}
		z, e := period.Date(o.End)
		if e != nil {
			return result, e
		}
		var value pgtype.Numeric
		if o.Value != nil {
			if e = value.Scan(*o.Value); e != nil {
				return result, e
			}
		}
		context, e := canonical.Bytes(o.Context)
		if e != nil {
			return result, e
		}
		if e = q.CreateObservation(ctx, postgres.CreateObservationParams{ID: ids[i], Series: o.Series, StartDate: postgres.Date(a), EndDate: postgres.Date(z), Geography: o.Geography, Value: value, Status: o.Status, Context: context, Locator: o.Locator}); e != nil {
			return result, e
		}
		if e = q.CreateMember(ctx, postgres.CreateMemberParams{Batch: batch, Observation: ids[i]}); e != nil {
			return result, e
		}
	}
	if e = q.CreateReceipt(ctx, postgres.CreateReceiptParams{Run: run, Batch: batch}); e != nil {
		return result, e
	}
	for i, o := range rows {
		for _, h := range o.Artifacts {
			if e = q.CreateProvenance(ctx, postgres.CreateProvenanceParams{Run: run, Observation: ids[i], Capture: byHash[h]}); e != nil {
				return result, e
			}
		}
	}
	if e = q.SucceedRun(ctx, postgres.SucceedRunParams{ID: run, Batch: postgres.Text(batch), Observations: pgtype.Int4{Int32: int32(len(rows)), Valid: true}, Changed: pgtype.Int4{Int32: int32(changed), Valid: true}}); e != nil {
		return result, e
	}
	detail, e := canonical.Bytes(map[string]any{"batch": batch, "observations": len(rows), "changed": changed})
	if e != nil {
		return result, e
	}
	if e = q.CreateEvent(ctx, postgres.CreateEventParams{Run: run, Event: "accepted", Detail: detail}); e != nil {
		return result, e
	}
	if e = tx.Commit(ctx); e != nil {
		return result, e
	}
	return Acceptance{Run: postgres.UUIDString(run), Batch: batch, Observations: len(rows), Changed: changed}, nil
}
