package observations

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
)

type Queries struct {
	Pool  *pgxpool.Pool
	Store objectstore.Store
}
type Integrity struct {
	Status        string           `json:"status"`
	Objects       int              `json:"objects"`
	Bytes         int64            `json:"bytes"`
	FailedObjects int              `json:"failed_objects,omitempty"`
	Failures      []IntegrityIssue `json:"failures,omitempty"`
}

type IntegrityIssue struct {
	SHA256 string `json:"sha256"`
	Reason string `json:"reason"`
}

type IntegrityError struct{}

func (*IntegrityError) Error() string { return "integridade de objetos raw falhou" }

// Bound diagnostic output while still reporting the total number of failed objects.
const maxIntegrityIssues = 100

func verifyObjects(ctx context.Context, store objectstore.Store, objects []postgres.RawObject) (Integrity, error) {
	result := Integrity{}
	for _, o := range objects {
		e := store.Verify(ctx, o.Key, o.Sha256, o.Bytes)
		if e != nil {
			reason := ""
			switch {
			case errors.Is(e, objectstore.ErrMissing):
				reason = "missing"
			case errors.Is(e, objectstore.ErrCorrupt):
				reason = "corrupt"
			default:
				return result, e
			}
			result.FailedObjects++
			if len(result.Failures) < maxIntegrityIssues {
				result.Failures = append(result.Failures, IntegrityIssue{SHA256: o.Sha256, Reason: reason})
			}
			continue
		}
		result.Objects++
		result.Bytes += o.Bytes
	}
	if result.FailedObjects > 0 {
		result.Status = "failed"
		return result, &IntegrityError{}
	}
	return result, nil
}

func (q Queries) Verify(ctx context.Context) (Integrity, error) {
	result := Integrity{}
	db := postgres.New(q.Pool)
	objects, e := db.AllRawObjects(ctx)
	if e != nil {
		return result, e
	}
	result, e = verifyObjects(ctx, q.Store, objects)
	if e != nil {
		return result, e
	}
	orphans, e := db.CountOrphanedObservations(ctx)
	if e != nil {
		return result, e
	}
	if orphans != 0 {
		return result, Invalid("observações aceitas sem vínculo de captura")
	}
	result.Status = "verified"
	return result, nil
}
