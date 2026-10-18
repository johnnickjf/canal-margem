package postgres

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/catalog"
	"margem/backend/internal/platform/canonical"
	"os"
	"time"
)

//go:embed 001.sql
var Migration []byte

//go:generate go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate -f ../../../sqlc.yaml
func Open(ctx context.Context) (*pgxpool.Pool, error) {
	cfg, e := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if e != nil {
		return nil, fmt.Errorf("configuração PostgreSQL inválida")
	}
	cfg.ConnConfig.ConnectTimeout = 10 * time.Second
	p, e := pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		return nil, e
	}
	if e = p.Ping(ctx); e != nil {
		p.Close()
		return nil, e
	}
	return p, nil
}
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, e := pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	for _, q := range []string{"SELECT pg_advisory_xact_lock(740700)", "CREATE SCHEMA IF NOT EXISTS ops", "CREATE TABLE IF NOT EXISTS ops.migration(id text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())"} {
		if _, e = tx.Exec(ctx, q); e != nil {
			return e
		}
	}
	var sha string
	e = tx.QueryRow(ctx, "SELECT sha256 FROM ops.migration WHERE id='001'").Scan(&sha)
	if e != nil && !errors.Is(e, pgx.ErrNoRows) {
		return e
	}
	if e == nil && sha != canonical.Hash(Migration) {
		return fmt.Errorf("migração 001 alterada após aplicação")
	}
	if errors.Is(e, pgx.ErrNoRows) {
		if _, e = tx.Exec(ctx, string(Migration)); e != nil {
			return e
		}
		if _, e = tx.Exec(ctx, "INSERT INTO ops.migration(id,sha256) VALUES ('001',$1)", canonical.Hash(Migration)); e != nil {
			return e
		}
	}
	if _, e = tx.Exec(ctx, "INSERT INTO ops.catalog(id,definition) VALUES ($1,$2) ON CONFLICT DO NOTHING", catalog.Version, catalog.Definition); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
