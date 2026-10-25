package api

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestFixedWindowsExpireWithoutExtendingOnAccess(t *testing.T) {
	a := &API{Rate: 2}
	a.Handler()
	now := time.Now()
	if !a.allowAt("a", now) || !a.allowAt("b", now.Add(time.Second)) || !a.allowAt("a", now.Add(59*time.Second)) || a.allowAt("a", now.Add(59*time.Second)) {
		t.Fatal("incorrect fixed-window limit")
	}
	if !a.allowAt("a", now.Add(time.Minute)) || len(a.clients) != 2 || a.windows.Len() != 2 {
		t.Fatal("first window did not expire")
	}
	if !a.allowAt("a", now.Add(61*time.Second)) || len(a.clients) != 1 || a.windows.Len() != 1 {
		t.Fatal("second window did not expire independently")
	}
}

func TestClientCapacityAndConcurrentRateLimit(t *testing.T) {
	a := &API{Rate: 120}
	a.Handler()
	now := time.Now()
	for i := range 10000 {
		if !a.allowAt(fmt.Sprint(i), now) {
			t.Fatal("premature client capacity limit")
		}
	}
	if a.allowAt("overflow", now) || len(a.clients) != 10000 || a.windows.Len() != 10000 {
		t.Fatal("client table is not bounded")
	}
	if !a.allowAt("new", now.Add(time.Minute)) || len(a.clients) != 1 || a.windows.Len() != 1 {
		t.Fatal("expired capacity was not reclaimed")
	}
	var accepted atomic.Int32
	var wg sync.WaitGroup
	for range 200 {
		wg.Go(func() {
			if a.allowAt("parallel", now.Add(time.Minute)) {
				accepted.Add(1)
			}
		})
	}
	wg.Wait()
	if accepted.Load() != 120 {
		t.Fatal("concurrent limit", accepted.Load())
	}
}
