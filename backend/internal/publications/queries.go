package publications

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/platform/postgres"
)

type Queries struct {
	Pool  *pgxpool.Pool
	Store ProjectionStore
	Cache *SnapshotCache
}

func (q Queries) SnapshotCacheStats() (CacheStats, bool) {
	if q.Cache == nil {
		return CacheStats{}, false
	}
	return q.Cache.Stats(), true
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

// Snapshot returns a read-only view. With Cache configured its maps, slices and
// pointers may be shared by concurrent requests; callers must not mutate them.
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
	if q.Cache != nil {
		return q.Cache.Load(ctx, p.ProjectionKey, p.ProjectionSha256, p.ProjectionBytes)
	}
	return loadSnapshot(ctx, q.Store, p.ProjectionKey, p.ProjectionSha256, p.ProjectionBytes)
}
