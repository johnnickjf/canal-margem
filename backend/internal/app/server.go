package app

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"margem/backend/internal/api"
	"margem/backend/internal/publications"
)

func snapshotCache(store publications.ProjectionStore) (*publications.SnapshotCache, error) {
	enabled := true
	if value := os.Getenv("API_SNAPSHOT_CACHE"); value != "" {
		var err error
		enabled, err = strconv.ParseBool(value)
		if err != nil {
			return nil, errors.New("API_SNAPSHOT_CACHE deve ser true ou false")
		}
	}
	if !enabled {
		return nil, nil
	}
	return publications.NewSnapshotCache(store, publications.MaxProjection, time.Minute), nil
}

func serve(ctx context.Context, reader api.Reader, stdout io.Writer) error {
	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	listener, e := net.Listen("tcp", addr)
	if e != nil {
		return e
	}
	server := &http.Server{Handler: api.New(reader), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	shutdownDone := make(chan struct{})
	finished := make(chan struct{})
	defer close(finished)
	go func() {
		select {
		case <-ctx.Done():
			shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if e := server.Shutdown(shutdown); e != nil {
				server.Close()
			}
			close(shutdownDone)
		case <-finished:
		}
	}()
	json.NewEncoder(stdout).Encode(map[string]any{"status": "listening", "address": listener.Addr().String()})
	e = server.Serve(listener)
	if errors.Is(e, http.ErrServerClosed) {
		<-shutdownDone
		return nil
	}
	return e
}
