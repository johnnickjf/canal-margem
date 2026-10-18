package publications

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/platform/postgres"
)

type Queries struct {
	Pool  *pgxpool.Pool
	Store ProjectionStore
}

func (q Queries) Resolve(ctx context.Context, at time.Time) (Activation, error) {
	if at.IsZero() {
		at = time.Now().UTC()
	}
	a, e := postgres.New(q.Pool).ResolvePublication(ctx, stamp(at))
	if errors.Is(e, pgx.ErrNoRows) {
		return Activation{}, Fail("not_covered", "canal sem publicação neste instante")
	}
	if e != nil {
		return Activation{}, e
	}
	return Activation{a.Generation, a.Publication, a.PreviousActivation, a.ActivatedAt.Time, a.CatalogRevision, a.DataCutoff.Time}, nil
}
func (q Queries) Snapshot(ctx context.Context, id string) (Snapshot, error) {
	if !hashPattern.MatchString(id) {
		return Snapshot{}, Fail("invalid_request", "ID de publicação inválido")
	}
	p, e := postgres.New(q.Pool).PublicPublication(ctx, id)
	if errors.Is(e, pgx.ErrNoRows) {
		return Snapshot{}, Fail("not_found", "publicação não disponível no canal")
	}
	if e != nil {
		return Snapshot{}, e
	}
	if q.Store == nil {
		return Snapshot{}, Fail("temporarily_unavailable", "armazenamento não configurado")
	}
	b, e := q.Store.LoadProjection(ctx, p.ProjectionKey, p.ProjectionSha256, p.ProjectionBytes)
	if e != nil {
		return Snapshot{}, e
	}
	var snapshot Snapshot
	if e = json.Unmarshal(b, &snapshot); e != nil {
		return Snapshot{}, e
	}
	return snapshot, nil
}
