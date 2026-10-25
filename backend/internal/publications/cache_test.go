package publications

import (
	"context"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"margem/backend/internal/platform/canonical"
)

type cacheStore struct {
	body  []byte
	calls atomic.Int32
	load  func(context.Context) error
}

func (*cacheStore) SaveProjection(context.Context, string, []byte) error { return nil }
func (s *cacheStore) LoadProjection(ctx context.Context, key, sha string, size int64) ([]byte, error) {
	s.calls.Add(1)
	if s.load != nil {
		if err := s.load(ctx); err != nil {
			return nil, err
		}
	}
	if int64(len(s.body)) != size || canonical.Hash(s.body) != sha {
		return nil, errors.New("corrupt projection")
	}
	return s.body, nil
}

func TestSnapshotCacheBudgetExpiryAndIdentity(t *testing.T) {
	body := []byte(`{"publication":"fixture","nodes":{}}`)
	store := &cacheStore{body: body}
	size, sha := int64(len(body)), canonical.Hash(body)
	c := NewSnapshotCache(store, 2*size, time.Minute)
	now := time.Now()
	c.clock = func() time.Time { return now }
	load := func(key, hash string, bytes int64) {
		t.Helper()
		s, err := c.Load(context.Background(), key, hash, bytes)
		if err != nil || s.Publication != "fixture" {
			t.Fatal(s, err)
		}
	}
	load("a", sha, size)
	load("b", sha, size)
	now = now.Add(time.Second)
	load("a", sha, size) // a is most recently used; b must be evicted
	load("c", sha, size)
	if store.calls.Load() != 3 || c.bytes != 2*size || len(c.entries) != 2 {
		t.Fatal("cache budget", store.calls.Load(), c.bytes, len(c.entries))
	}
	load("b", sha, size)
	if store.calls.Load() != 4 {
		t.Fatal("LRU did not evict b")
	}
	if _, err := c.Load(context.Background(), "b", strings.Repeat("0", 64), size); err == nil {
		t.Fatal("hash was not part of cache identity")
	}
	if _, err := c.Load(context.Background(), "b", sha, size+1); err == nil {
		t.Fatal("size was not part of cache identity")
	}
	now = now.Add(time.Minute)
	load("b", sha, size)
	if store.calls.Load() != 7 || len(c.entries) != 1 {
		t.Fatal("TTL must expire even on hits", store.calls.Load(), len(c.entries))
	}
	now = now.Add(time.Minute)
	store.load = func(context.Context) error { return errors.New("missing object") }
	if _, err := c.Load(context.Background(), "b", sha, size); err == nil || len(c.entries) != 0 {
		t.Fatal("served expired bytes on storage failure")
	}
	store.load = nil
	// Too-large objects and a disabled cache still load, but are not retained.
	for _, budget := range []int64{0, size - 1} {
		c := NewSnapshotCache(store, budget, time.Minute)
		for range 2 {
			if _, err := c.Load(context.Background(), "x", sha, size); err != nil {
				t.Fatal(err)
			}
		}
		if len(c.entries) != 0 || c.bytes != 0 {
			t.Fatal("retained an oversized object")
		}
	}
}

func TestSnapshotCacheCoalescesAndWaiterCanCancel(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	store := &cacheStore{body: []byte(`{"publication":"fixture"}`), load: func(ctx context.Context) error {
		close(started)
		select {
		case <-release:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}}
	c := NewSnapshotCache(store, 1024, time.Minute)
	load := func(ctx context.Context) error {
		_, err := c.Load(ctx, "x", canonical.Hash(store.body), int64(len(store.body)))
		return err
	}
	leader := make(chan error, 1)
	go func() { leader <- load(context.Background()) }()
	<-started
	ctx, cancel := context.WithCancel(context.Background())
	waiter := make(chan error, 1)
	go func() { waiter <- load(ctx) }()
	cancel()
	if err := <-waiter; !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			if err := load(context.Background()); err != nil {
				t.Error(err)
			}
		})
	}
	close(release)
	if err := <-leader; err != nil {
		t.Fatal(err)
	}
	wg.Wait()
	if store.calls.Load() != 1 || len(c.flights) != 0 {
		t.Fatal("duplicate loads or leaked flight", store.calls.Load())
	}
}

func TestSnapshotCacheNeverRetainsErrors(t *testing.T) {
	for _, body := range []string{`invalid JSON`, `{"publication":"fixture"}`} {
		store := &cacheStore{body: []byte(body)}
		c := NewSnapshotCache(store, 1024, time.Minute)
		if strings.HasPrefix(body, "{") {
			store.load = func(context.Context) error { return context.Canceled }
		}
		for range 2 {
			if _, err := c.Load(context.Background(), "x", canonical.Hash(store.body), int64(len(store.body))); err == nil {
				t.Fatal("error accepted")
			}
		}
		if store.calls.Load() != 2 || len(c.entries) != 0 || len(c.flights) != 0 {
			t.Fatal("cached error or leaked flight")
		}
		store.body, store.load = []byte(`{"publication":"recovered"}`), nil
		if _, err := c.Load(context.Background(), "x", canonical.Hash(store.body), int64(len(store.body))); err != nil {
			t.Fatal("could not retry", err)
		}
	}
}

func TestSnapshotCacheEntryLimitAndCanceledLeader(t *testing.T) {
	store := &cacheStore{body: []byte(`{"publication":"fixture"}`)}
	c := NewSnapshotCache(store, MaxProjection, time.Minute)
	for _, key := range []string{"a", "b", "c"} {
		if _, err := c.Load(context.Background(), key, canonical.Hash(store.body), int64(len(store.body))); err != nil {
			t.Fatal(err)
		}
	}
	if len(c.entries) != 2 {
		t.Fatal("entry count not bounded", len(c.entries))
	}
	ctx, cancel := context.WithCancel(context.Background())
	// Even a store that returns success after cancellation cannot warm the cache.
	store.load = func(context.Context) error { cancel(); return nil }
	if _, err := c.Load(ctx, "canceled", canonical.Hash(store.body), int64(len(store.body))); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if len(c.flights) != 0 || len(c.entries) != 2 {
		t.Fatal("retained canceled load")
	}
	if _, err := c.Load(context.Background(), "oversized", "hash", MaxProjection+1); err == nil {
		t.Fatal("oversized projection accepted")
	}
}
