package observations

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
)

type integrityStore map[string]error

func (s integrityStore) Save(context.Context, []byte) (string, string, error) {
	panic("não usado")
}
func (s integrityStore) Verify(_ context.Context, key, _ string, _ int64) error {
	return s[key]
}

func TestVerifyObjectsReportsOnlyKnownIntegrityFailures(t *testing.T) {
	objects := []postgres.RawObject{
		{Key: "one", Sha256: "sha-one", Bytes: 10},
		{Key: "two", Sha256: "sha-two", Bytes: 20},
		{Key: "three", Sha256: "sha-three", Bytes: 30},
	}
	store := integrityStore{"one": fmt.Errorf("wrapped: %w", objectstore.ErrMissing), "two": objectstore.ErrCorrupt}
	result, err := verifyObjects(context.Background(), store, objects)
	var integrity *IntegrityError
	if !errors.As(err, &integrity) || result.Status != "failed" || result.Objects != 1 || result.Bytes != 30 || result.FailedObjects != 2 || len(result.Failures) != 2 {
		t.Fatalf("resultado inesperado: %+v, %v", result, err)
	}
	if result.Failures[0] != (IntegrityIssue{SHA256: "sha-one", Reason: "missing"}) || result.Failures[1] != (IntegrityIssue{SHA256: "sha-two", Reason: "corrupt"}) {
		t.Fatalf("diagnóstico inesperado: %+v", result.Failures)
	}
	store["one"] = errors.New("erro de credenciais ou conexão")
	if _, err = verifyObjects(context.Background(), store, objects); err == nil || errors.As(err, &integrity) {
		t.Fatalf("falha operacional não pode ser informada como ausência: %v", err)
	}
}

func TestVerifyObjectsBoundsTheListButCountsAllFailures(t *testing.T) {
	objects := make([]postgres.RawObject, maxIntegrityIssues+1)
	store := integrityStore{}
	for i := range objects {
		key := fmt.Sprint(i)
		objects[i] = postgres.RawObject{Key: key, Sha256: key}
		store[key] = objectstore.ErrMissing
	}
	result, err := verifyObjects(context.Background(), store, objects)
	if err == nil || result.FailedObjects != len(objects) || len(result.Failures) != maxIntegrityIssues {
		t.Fatalf("diagnóstico não limitado: %+v, %v", result, err)
	}
}
