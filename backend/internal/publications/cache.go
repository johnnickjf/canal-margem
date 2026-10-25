package publications

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// SnapshotCache retains verified, decoded public projections, never user profiles
// or activation aliases. Returned snapshots are borrowed and MUST NOT be mutated.
// The budget counts serialized bytes, not Go heap usage. At most two decoded
// snapshots are retained; in-flight requests can temporarily exceed that budget.
type SnapshotCache struct {
	store     ProjectionStore
	budget    int64
	ttl       time.Duration
	mu        sync.Mutex
	entries   map[projectionKey]*cachedSnapshot
	flights   map[projectionKey]*snapshotFlight
	bytes     int64
	clock     func() time.Time
	hits      atomic.Uint64
	misses    atomic.Uint64
	coalesced atomic.Uint64
	errors    atomic.Uint64
}

type CacheStats struct {
	Hits, Misses, Coalesced, Errors uint64
	Entries                         int
	SerializedBytes                 int64
}

type projectionKey struct {
	key, sha string
	size     int64
}
type cachedSnapshot struct {
	snapshot      Snapshot
	expires, used time.Time
}
type snapshotFlight struct {
	done     chan struct{}
	snapshot Snapshot
	err      error
}

func NewSnapshotCache(store ProjectionStore, budget int64, ttl time.Duration) *SnapshotCache {
	return &SnapshotCache{store: store, budget: budget, ttl: ttl, entries: map[projectionKey]*cachedSnapshot{}, flights: map[projectionKey]*snapshotFlight{}, clock: time.Now}
}

// Load must be called only after checking that the publication was activated.
// A failed/canceled load is never retained. Waiters may cancel independently;
// canceling the first caller also cancels the shared load, allowing a later retry.
func (c *SnapshotCache) Load(ctx context.Context, key, sha string, size int64) (Snapshot, error) {
	if err := ctx.Err(); err != nil {
		return Snapshot{}, err
	}
	if size < 1 || size > MaxProjection {
		return Snapshot{}, fmt.Errorf("projeção excede limite")
	}
	k := projectionKey{key, sha, size}
	c.mu.Lock()
	now := c.clock()
	for id, entry := range c.entries {
		if !now.Before(entry.expires) {
			delete(c.entries, id)
			c.bytes -= id.size
		}
	}
	if entry := c.entries[k]; entry != nil {
		entry.used = now
		c.hits.Add(1)
		c.mu.Unlock()
		return entry.snapshot, nil
	}
	if flight := c.flights[k]; flight != nil {
		c.coalesced.Add(1)
		c.mu.Unlock()
		select {
		case <-ctx.Done():
			return Snapshot{}, ctx.Err()
		case <-flight.done:
			return flight.snapshot, flight.err
		}
	}
	flight := &snapshotFlight{done: make(chan struct{})}
	c.flights[k] = flight
	c.misses.Add(1)
	c.mu.Unlock()

	flight.snapshot, flight.err = loadSnapshot(ctx, c.store, key, sha, size)
	if err := ctx.Err(); err != nil {
		flight.snapshot, flight.err = Snapshot{}, err
	}
	if flight.err != nil {
		c.errors.Add(1)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if flight.err == nil && c.ttl > 0 && size <= c.budget {
		for len(c.entries) >= 2 || c.bytes+size > c.budget {
			var oldest projectionKey
			var used time.Time
			for id, entry := range c.entries {
				if used.IsZero() || entry.used.Before(used) {
					oldest, used = id, entry.used
				}
			}
			delete(c.entries, oldest)
			c.bytes -= oldest.size
		}
		now = c.clock()
		c.entries[k] = &cachedSnapshot{snapshot: flight.snapshot, expires: now.Add(c.ttl), used: now}
		c.bytes += size
	}
	delete(c.flights, k)
	close(flight.done)
	return flight.snapshot, flight.err
}

func (c *SnapshotCache) Stats() CacheStats {
	c.mu.Lock()
	stats := CacheStats{
		Hits:            c.hits.Load(),
		Misses:          c.misses.Load(),
		Coalesced:       c.coalesced.Load(),
		Errors:          c.errors.Load(),
		Entries:         len(c.entries),
		SerializedBytes: c.bytes,
	}
	c.mu.Unlock()
	return stats
}

func loadSnapshot(ctx context.Context, store ProjectionStore, key, sha string, size int64) (Snapshot, error) {
	if store == nil {
		return Snapshot{}, Fail("temporarily_unavailable", "armazenamento não configurado")
	}
	body, err := store.LoadProjection(ctx, key, sha, size)
	if err != nil {
		return Snapshot{}, err
	}
	var snapshot Snapshot
	err = json.Unmarshal(body, &snapshot)
	return snapshot, err
}
