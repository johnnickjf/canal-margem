package observations

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
)

type Queries struct {
	Pool  *pgxpool.Pool
	Store objectstore.Store
}
type Integrity struct {
	Status  string `json:"status"`
	Objects int    `json:"objects"`
	Bytes   int64  `json:"bytes"`
}

func (q Queries) Verify(ctx context.Context) (Integrity, error) {
	result := Integrity{}
	db := postgres.New(q.Pool)
	objects, e := db.AllRawObjects(ctx)
	if e != nil {
		return result, e
	}
	for _, o := range objects {
		if e = q.Store.Verify(ctx, o.Key, o.Sha256, o.Bytes); e != nil {
			return result, e
		}
		result.Bytes += o.Bytes
	}
	orphans, e := db.CountOrphanedObservations(ctx)
	if e != nil {
		return result, e
	}
	if orphans != 0 {
		return result, Invalid("observações aceitas sem vínculo de captura")
	}
	result.Status = "verified"
	result.Objects = len(objects)
	return result, nil
}
