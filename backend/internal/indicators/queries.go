package indicators

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/postgres"
	"time"
)

type Queries struct{ Pool *pgxpool.Pool }
type Receipt struct {
	ID           string     `json:"id"`
	CalculatedAt time.Time  `json:"calculated_at"`
	Evaluation   Evaluation `json:"evaluation"`
}

func read(ctx context.Context, db *postgres.Queries, id string) (Receipt, error) {
	row, e := db.EngineEvaluation(ctx, id)
	if e != nil {
		return Receipt{}, e
	}
	var ev Evaluation
	if e = json.Unmarshal(row.Result, &ev); e != nil {
		return Receipt{}, e
	}
	ev.Output.ID = row.ID
	return Receipt{row.ID, row.CalculatedAt.Time, ev}, nil
}
func (q Queries) Get(ctx context.Context, id string) (Receipt, error) {
	return read(ctx, postgres.New(q.Pool), id)
}
func resolve(ctx context.Context, db *postgres.Queries, id string) (Input, bool, error) {
	row, e := db.EngineNormalizedInput(ctx, id)
	if e == nil {
		var metadata map[string]any
		if e = json.Unmarshal(row.Context, &metadata); e != nil {
			return Input{}, false, e
		}
		var value *string
		if row.Status == "observed" {
			value = &row.ValueText
		}
		return Input{id, row.Series, row.StartDate.Time.Format(period.Layout), row.EndDate.Time.Format(period.Layout), row.Geography, value, row.Status, metadata}, false, nil
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		return Input{}, false, e
	}
	r, e := read(ctx, db, id)
	return r.Evaluation.Output, true, e
}
