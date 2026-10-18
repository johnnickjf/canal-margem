package main

import (
	"context"
	"log/slog"
	"margem/backend/internal/app"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	os.Exit(app.Run(ctx, os.Args[1:], os.Stdout, os.Stderr))
}
