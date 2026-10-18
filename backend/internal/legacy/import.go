// Package legacy preserves the local TypeScript PoC without promoting its data.
package legacy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/observations"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type File struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
	Bytes  int    `json:"bytes"`
}
type Inventory struct {
	Manifest     map[string]any
	Bodies       map[string][]byte
	Observations map[string]map[string]any
	Files        []File
}

func Inspect(root string) (Inventory, error) {
	result := Inventory{Bodies: map[string][]byte{}, Observations: map[string]map[string]any{}}
	paths := []string{"current"}
	for _, dir := range []string{"raw", "snapshots", "runs"} {
		info, e := os.Lstat(filepath.Join(root, dir))
		if e != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return result, observations.Invalid("PoC: diretório inválido")
		}
		entries, e := os.ReadDir(filepath.Join(root, dir))
		if e != nil {
			return result, e
		}
		for _, entry := range entries {
			paths = append(paths, dir+"/"+entry.Name())
		}
	}
	for _, name := range paths {
		p := filepath.Join(root, filepath.FromSlash(name))
		info, e := os.Lstat(p)
		if e != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
			return result, observations.Invalid("PoC: arquivo inválido")
		}
		b, e := os.ReadFile(p)
		if e != nil {
			return result, e
		}
		sha := canonical.Hash(b)
		if strings.HasPrefix(name, "raw/") && filepath.Base(name) != sha {
			return result, observations.Invalid("PoC: hash raw divergente")
		}
		if strings.HasPrefix(name, "snapshots/") && strings.TrimSuffix(filepath.Base(name), ".json") != sha {
			return result, observations.Invalid("PoC: hash de snapshot divergente")
		}
		result.Bodies[name] = b
		result.Files = append(result.Files, File{name, sha, len(b)})
	}
	current := strings.TrimSpace(string(result.Bodies["current"]))
	if _, ok := result.Bodies["snapshots/"+current+".json"]; !ok {
		return result, observations.Invalid("PoC: current sem snapshot")
	}
	for _, file := range result.Files {
		if !strings.HasPrefix(file.Path, "snapshots/") {
			continue
		}
		var snapshot struct {
			SchemaVersion        int               `json:"schema_version"`
			NormalizationVersion string            `json:"normalization_version"`
			Selected             map[string]string `json:"selected"`
			Batches              []struct {
				ObservationIDs []string `json:"observation_ids"`
			} `json:"batches"`
			Observations []map[string]any `json:"observations"`
		}
		if e := canonical.Decode(result.Bodies[file.Path], &snapshot); e != nil {
			return result, e
		}
		if snapshot.SchemaVersion != 1 || snapshot.NormalizationVersion != "poc-1" {
			return result, observations.Invalid("PoC: versão desconhecida")
		}
		ids := map[string]bool{}
		for _, o := range snapshot.Observations {
			id, ok := o["id"].(string)
			if !ok || id == "" {
				return result, observations.Invalid("PoC: identidade inválida")
			}
			ids[id] = true
		}
		for _, id := range snapshot.Selected {
			if !ids[id] {
				return result, observations.Invalid("PoC: seleção órfã")
			}
		}
		for _, batch := range snapshot.Batches {
			for _, id := range batch.ObservationIDs {
				if !ids[id] {
					return result, observations.Invalid("PoC: lote órfão")
				}
			}
		}
		for _, o := range snapshot.Observations {
			if prior := o["supersedes"]; prior != nil {
				p, ok := prior.(string)
				if !ok || !ids[p] {
					return result, observations.Invalid("PoC: predecessor órfão")
				}
			}
			raw, ok := o["raw_artifact"].(string)
			if !ok {
				return result, observations.Invalid("PoC: raw de observação ausente")
			}
			if _, ok = result.Bodies["raw/"+raw]; !ok {
				return result, observations.Invalid("PoC: raw de observação ausente")
			}
			id := o["id"].(string)
			if prior, ok := result.Observations[id]; ok {
				a, e := canonical.Digest(prior)
				if e != nil {
					return result, e
				}
				b, e := canonical.Digest(o)
				if e != nil {
					return result, e
				}
				if a != b {
					return result, observations.Invalid("PoC: identidade conflitante")
				}
			}
			result.Observations[id] = o
		}
	}
	var check func(any) error
	check = func(v any) error {
		switch x := v.(type) {
		case map[string]any:
			if sha, ok := x["sha256"].(string); ok {
				if size, ok := x["bytes"].(json.Number); ok {
					n, e := size.Int64()
					raw, exists := result.Bodies["raw/"+sha]
					if e != nil || !exists || int64(len(raw)) != n {
						return observations.Invalid("PoC: captura órfã")
					}
				}
			}
			for _, child := range x {
				if e := check(child); e != nil {
					return e
				}
			}
		case []any:
			for _, child := range x {
				if e := check(child); e != nil {
					return e
				}
			}
		}
		return nil
	}
	for name, b := range result.Bodies {
		if !strings.HasPrefix(name, "runs/") {
			continue
		}
		lines := [][]byte{b}
		if strings.HasSuffix(name, ".jsonl") {
			lines = nil
			for _, line := range strings.Split(string(b), "\n") {
				if strings.TrimSpace(line) != "" {
					lines = append(lines, []byte(line))
				}
			}
		}
		for _, line := range lines {
			var v any
			if e := canonical.Decode(line, &v); e != nil {
				return result, e
			}
			if e := check(v); e != nil {
				return result, e
			}
		}
	}
	result.Manifest = map[string]any{"schema": "poc-archive-1", "current": current, "files": result.Files, "observations": len(result.Observations), "vintage_basis": "local-capture-no-official-order", "public_selection": false}
	return result, nil
}

type Result struct {
	Import       string `json:"import"`
	Files        int    `json:"files"`
	Observations int    `json:"observations"`
	Promoted     bool   `json:"promoted"`
}
type Commands struct {
	Pool  *pgxpool.Pool
	Store objectstore.Store
}

func (c Commands) Import(ctx context.Context, root string) (Result, error) {
	result := Result{}
	lock := filepath.Join(root, "writer.lock")
	if e := os.Mkdir(lock, 0700); e != nil {
		if errors.Is(e, os.ErrExist) {
			return result, observations.Invalid("PoC bloqueada: conferir writer.lock antes de importar")
		}
		return result, e
	}
	defer os.Remove(lock)
	owner := filepath.Join(lock, "owner.json")
	b, e := canonical.Bytes(map[string]any{"pid": os.Getpid(), "purpose": "migration"})
	if e != nil {
		return result, e
	}
	if e = os.WriteFile(owner, b, 0600); e != nil {
		return result, e
	}
	defer os.Remove(owner)
	inv, e := Inspect(root)
	if e != nil {
		return result, e
	}
	id, e := canonical.Digest(inv.Manifest)
	if e != nil {
		return result, e
	}
	objects := map[string]postgres.CreateRawObjectParams{}
	for _, f := range inv.Files {
		sha, key, e := c.Store.Save(ctx, inv.Bodies[f.Path])
		if e != nil {
			return result, e
		}
		objects[f.Path] = postgres.CreateRawObjectParams{Sha256: sha, Key: key, Bytes: int64(f.Bytes)}
	}
	tx, e := c.Pool.Begin(ctx)
	if e != nil {
		return result, e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(740701)"); e != nil {
		return result, e
	}
	q := postgres.New(tx)
	manifest, e := canonical.Bytes(inv.Manifest)
	if e != nil {
		return result, e
	}
	if e = q.CreateLegacyImport(ctx, postgres.CreateLegacyImportParams{ID: id, Manifest: manifest}); e != nil {
		return result, e
	}
	for _, f := range inv.Files {
		o := objects[f.Path]
		if e = q.CreateRawObject(ctx, o); e != nil {
			return result, e
		}
		if e = q.CreateLegacyFile(ctx, postgres.CreateLegacyFileParams{Import: id, Path: f.Path, Object: o.Sha256}); e != nil {
			return result, e
		}
	}
	ids := []string{}
	for id := range inv.Observations {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, oldID := range ids {
		record, e := canonical.Bytes(inv.Observations[oldID])
		if e != nil {
			return result, e
		}
		prior, e := q.GetLegacyObservation(ctx, oldID)
		if e != nil && !errors.Is(e, pgx.ErrNoRows) {
			return result, e
		}
		if e == nil {
			var value any
			if e = canonical.Decode(prior, &value); e != nil {
				return result, e
			}
			prior, e = canonical.Bytes(value)
			if e != nil {
				return result, e
			}
			if string(prior) != string(record) {
				return result, observations.Invalid("PoC: ID legado conflitante no destino")
			}
		}
		if e = q.CreateLegacyObservation(ctx, postgres.CreateLegacyObservationParams{ID: oldID, Record: record}); e != nil {
			return result, e
		}
	}
	if e = tx.Commit(ctx); e != nil {
		return result, fmt.Errorf("confirmar importação: %w", e)
	}
	return Result{id, len(inv.Files), len(ids), false}, nil
}
