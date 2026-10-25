// Package app is the composition root: transports call module commands or queries.
package app

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"margem/backend/internal/indicators"
	"margem/backend/internal/ingestion"
	"margem/backend/internal/legacy"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
	"margem/backend/internal/publications"
	"os"
	"time"
)

func Run(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 || args[0] == "--help" || args[0] == "-h" {
		fmt.Fprintln(stdout, "Margem — dados e API\nComandos: serve | prepare --manifest ARQUIVO | activate --manifest ARQUIVO | current | formulas | calculate --manifest ARQUIVO | calculation --id ID | migrate | run --source FONTE [--from DATA --to DATA] | tick [--from DATA --to DATA] | status | monitor | verify | import-poc --root DIRETÓRIO")
		if len(args) == 0 {
			return 2
		}
		return 0
	}
	command := args[0]
	if command == "formulas" && len(args) == 1 {
		json.NewEncoder(stdout).Encode(indicators.Definitions())
		return 0
	}
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	flags.SetOutput(stderr)
	manifest, id := "", ""
	start, end, source, root := "2012-01-01", time.Now().Format(period.Layout), "", ""
	switch command {
	case "run", "tick":
		flags.StringVar(&start, "from", start, "data inicial")
		flags.StringVar(&end, "to", end, "data final")
		if command == "run" {
			flags.StringVar(&source, "source", "", "fonte")
		}
	case "calculate", "prepare", "activate":
		flags.StringVar(&manifest, "manifest", "", "manifesto JSON com inputs por ID")
	case "calculation":
		flags.StringVar(&id, "id", "", "ID da avaliação")
	case "import-poc":
		flags.StringVar(&root, "root", "", "raiz da PoC")
	case "migrate", "status", "monitor", "verify", "serve", "current":
	default:
		fmt.Fprintln(stderr, "comando desconhecido")
		return 2
	}
	if e := flags.Parse(args[1:]); e != nil {
		if e == flag.ErrHelp {
			return 0
		}
		return 2
	}
	if flags.NArg() != 0 || command == "run" && source == "" || command == "import-poc" && root == "" || (command == "calculate" || command == "prepare" || command == "activate") && manifest == "" || command == "calculation" && id == "" {
		fmt.Fprintln(stderr, "argumentos inválidos ou ausentes")
		return 2
	}
	fail := func(e error) int {
		json.NewEncoder(stderr).Encode(map[string]any{"status": "failed", "error": ingestion.Failure(e)})
		return 1
	}
	var preparation publications.PrepareRequest
	var activation publications.ActivateRequest
	if command == "prepare" || command == "activate" {
		body, e := os.ReadFile(manifest)
		if e != nil {
			return fail(e)
		}
		var target any = &preparation
		if command == "activate" {
			target = &activation
		}
		if e = publications.Decode(body, target); e != nil {
			return fail(e)
		}
	}
	var requests []indicators.Request
	if command == "calculate" {
		body, e := os.ReadFile(manifest)
		if e != nil {
			return fail(e)
		}
		requests, e = indicators.DecodeManifest(body)
		if e != nil {
			return fail(observations.Invalid("manifesto inválido: %s", e))
		}
	}
	var window period.Window
	if command == "run" || command == "tick" {
		var e error
		window, e = period.NewWindow(start, end, time.Now())
		if e != nil {
			return fail(e)
		}
	}
	pool, e := postgres.Open(ctx)
	if e != nil {
		return fail(e)
	}
	defer pool.Close()
	var result any
	exit := 0
	switch command {
	case "serve":
		store, e := objectstore.ProjectionFromEnv(ctx)
		if e != nil {
			return fail(e)
		}
		cache, e := snapshotCache(store)
		if e != nil {
			return fail(e)
		}
		if e = serve(ctx, publications.Queries{Pool: pool, Store: store, Cache: cache}, stdout); e != nil {
			return fail(e)
		}
		return 0
	case "current":
		r, e := (publications.Queries{Pool: pool}).Resolve(ctx, time.Time{})
		if e != nil {
			return fail(e)
		}
		result = r
	case "prepare", "activate":
		store, e := objectstore.ProjectionFromEnv(ctx)
		if e != nil {
			return fail(e)
		}
		commands := publications.Commands{Pool: pool, Store: store}
		if command == "prepare" {
			raw, e := objectstore.FromEnv(ctx)
			if e != nil {
				return fail(e)
			}
			commands.Raw = raw
			r, e := commands.Prepare(ctx, preparation)
			if e != nil {
				return fail(e)
			}
			result = r
		} else {
			r, e := commands.Activate(ctx, activation)
			if e != nil {
				return fail(e)
			}
			result = r
		}
	case "calculate":
		r, e := (indicators.Commands{Pool: pool}).Materialize(ctx, requests)
		if e != nil {
			return fail(e)
		}
		result = r
	case "calculation":
		r, e := (indicators.Queries{Pool: pool}).Get(ctx, id)
		if e != nil {
			return fail(e)
		}
		result = r
	case "migrate":
		if e = postgres.Migrate(ctx, pool); e != nil {
			return fail(e)
		}
		result = map[string]any{"migration": postgres.LatestMigration, "status": "succeeded"}
	case "status", "monitor":
		r, e := (ingestion.Queries{Pool: pool}).Health(ctx)
		if e != nil {
			if command == "monitor" {
				checkedAt := time.Now().UTC()
				failure := ingestion.Failure(e)
				alertCtx := context.WithoutCancel(ctx)
				unhealthy := ingestion.Health{Healthy: false}
				configured, alertErr := sendHealthAlert(alertCtx, unhealthy, checkedAt, failure)
				if alertErr != nil {
					json.NewEncoder(stderr).Encode(map[string]any{"status": "failed", "error": failure, "alert_error": alertErr.Error(), "alert_delivery": "failed"})
					return 1
				}
				if configured {
					json.NewEncoder(stderr).Encode(map[string]any{"status": "failed", "error": failure, "alert_delivery": "webhook_sent"})
					return 1
				}
			}
			return fail(e)
		}
		if command == "monitor" {
			status := "healthy"
			if !r.Healthy {
				status = "unhealthy"
			}
			checkedAt := time.Now().UTC()
			configured, alertErr := sendHealthAlert(ctx, r, checkedAt, "")
			if alertErr != nil {
				json.NewEncoder(stderr).Encode(map[string]any{"status": "failed", "error": alertErr.Error()})
				return 1
			}
			delivery := "scheduler_exit_status"
			if configured {
				delivery = "webhook_sent"
			}
			result = map[string]any{"checked_at": checkedAt, "status": status, "alert_delivery": delivery, "health": r}
		} else {
			result = r
		}
		if !r.Healthy {
			exit = 1
		}
	default:
		store, e := objectstore.FromEnv(ctx)
		if e != nil {
			return fail(e)
		}
		switch command {
		case "verify":
			r, e := (observations.Queries{Pool: pool, Store: store}).Verify(ctx)
			if e != nil {
				return fail(e)
			}
			result = r
		case "import-poc":
			r, e := (legacy.Commands{Pool: pool, Store: store}).Import(ctx, root)
			if e != nil {
				return fail(e)
			}
			result = r
		case "run":
			r, e := (ingestion.Commands{Pool: pool, Store: store}).Run(ctx, source, window, true)
			if e != nil {
				return fail(e)
			}
			result = r
		case "tick":
			r := (ingestion.Commands{Pool: pool, Store: store}).Tick(ctx, window)
			result = r
			for _, s := range r {
				if s.Status == "failed" {
					exit = 1
				}
			}
		}
	}
	if e = json.NewEncoder(stdout).Encode(result); e != nil {
		return fail(e)
	}
	return exit
}
