package integration

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"margem/backend/internal/api"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/publications"
)

type countedProjections struct {
	publications.ProjectionStore
	loads atomic.Int32
}

func (s *countedProjections) LoadProjection(ctx context.Context, key, sha string, size int64) ([]byte, error) {
	s.loads.Add(1)
	return s.ProjectionStore.LoadProjection(ctx, key, sha, size)
}

func TestSnapshotCachePublicationIsolation(t *testing.T) {
	pool, scenario, commands, queries := publicationSetup(t)
	store := &countedProjections{ProjectionStore: queries.Store}
	queries.Cache = publications.NewSnapshotCache(store, publications.MaxProjection, time.Minute)
	batch := scenario.run(t)
	slots := scopeFor(t, pool, batch.Batch)
	first := prepare(t, commands, slots, 0)
	if _, err := commands.Activate(ctx, activation(first, 0)); err != nil {
		t.Fatal(err)
	}
	handler := api.New(queries)
	path := "/api/v1/series/vf1?publication=" + first.Publication
	cold, warm := get(handler, path), get(handler, path)
	expectStatus(t, cold, 200)
	expectStatus(t, warm, 200)
	if cold.Body.String() != warm.Body.String() || cold.Header().Get("ETag") != warm.Header().Get("ETag") || store.loads.Load() != 1 {
		t.Fatal("cache changed bytes/ETag or repeated S3 read", store.loads.Load())
	}
	second := prepare(t, commands, slots, 1)
	// Even preloading valid bytes cannot make a prepared publication public.
	if _, err := queries.Cache.Load(ctx, second.Projection, second.SHA256, second.Bytes); err != nil {
		t.Fatal(err)
	}
	if _, err := queries.Snapshot(ctx, second.Publication); err == nil {
		t.Fatal("cache bypassed activation check")
	} else {
		var failure *publications.Error
		if !errors.As(err, &failure) || failure.Code != "not_found" {
			t.Fatal(err)
		}
	}
	if _, err := commands.Activate(ctx, activation(second, 1)); err != nil {
		t.Fatal(err)
	}
	current, err := queries.Resolve(ctx, time.Time{})
	if err != nil || current.Publication != second.Publication || current.Generation != 2 {
		t.Fatal("activation alias was cached", current, err)
	}
	expectStatus(t, get(handler, path), 200) // pinned edition survives activation
	public := commands.Store.(*objectstore.S3)
	if _, err := public.Client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &public.Bucket, Key: &first.Projection}); err != nil {
		t.Fatal(err)
	}
	// Warm, verified bytes remain usable for their finite TTL. A cold/expired
	// cache must report the missing edition instead of substituting the new one.
	expectStatus(t, get(handler, path), 200)
	queries.Cache = publications.NewSnapshotCache(store, publications.MaxProjection, time.Minute)
	missing := get(api.New(queries), path)
	expectStatus(t, missing, 503)
	if missing.Header().Get("Cache-Control") != "no-store" || missing.Header().Get("ETag") != "" {
		t.Fatal(missing.Header())
	}
}
