package app

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"margem/backend/internal/publications"
)

type serverReader struct{}

func (serverReader) Resolve(context.Context, time.Time) (publications.Activation, error) {
	return publications.Activation{}, nil
}
func (serverReader) Snapshot(context.Context, string) (publications.Snapshot, error) {
	return publications.Snapshot{}, nil
}
func TestServerStartsAndShutsDown(t *testing.T) {
	t.Setenv("API_ADDR", "127.0.0.1:0")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	read, write := io.Pipe()
	defer read.Close()
	defer write.Close()
	done := make(chan error, 1)
	go func() { done <- serve(ctx, serverReader{}, write) }()
	var address struct {
		Address string `json:"address"`
	}
	if e := json.NewDecoder(read).Decode(&address); e != nil {
		t.Fatal(e)
	}
	client := http.Client{Timeout: time.Second}
	r, e := client.Get("http://" + address.Address + "/healthz")
	if e != nil {
		t.Fatal(e)
	}
	r.Body.Close()
	if r.StatusCode != 200 {
		t.Fatal(r.StatusCode)
	}
	cancel()
	select {
	case e := <-done:
		if e != nil {
			t.Fatal(e)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("server did not shut down")
	}
}

func TestSnapshotCacheConfiguration(t *testing.T) {
	for _, value := range []string{"", "true", "false", "invalid"} {
		t.Setenv("API_SNAPSHOT_CACHE", value)
		cache, err := snapshotCache(nil)
		if (err != nil) != (value == "invalid") || (cache != nil) != (value == "" || value == "true") {
			t.Fatalf("%q: cache=%v err=%v", value, cache, err)
		}
	}
}
