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
	"os"
	"time"
)

func Run(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 || args[0] == "--help" || args[0] == "-h" {
		fmt.Fprintln(stdout, "Margem — pipelines e cálculos privados\nComandos: formulas | calculate --manifest ARQUIVO | calculation --id ID | migrate | run --source FONTE [--from DATA --to DATA] | tick [--from DATA --to DATA] | status | verify | import-poc --root DIRETÓRIO")
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
	case "calculate":
		flags.StringVar(&manifest, "manifest", "", "manifesto JSON com inputs por ID")
	case "calculation":
		flags.StringVar(&id, "id", "", "ID da avaliação")
	case "import-poc":
		flags.StringVar(&root, "root", "", "raiz da PoC")
	case "migrate", "status", "verify":
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
	if flags.NArg() != 0 || command == "run" && source == "" || command == "import-poc" && root == "" || command == "calculate" && manifest == "" || command == "calculation" && id == "" {
		fmt.Fprintln(stderr, "argumentos inválidos ou ausentes")
		return 2
	}
	fail := func(e error) int {
		json.NewEncoder(stderr).Encode(map[string]any{"status": "failed", "error": ingestion.Failure(e)})
		return 1
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
	case "status":
		r, e := (ingestion.Queries{Pool: pool}).Health(ctx)
		if e != nil {
			return fail(e)
		}
		result = r
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
