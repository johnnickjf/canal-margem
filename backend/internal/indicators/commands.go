package indicators

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/platform/postgres"
)

type Commands struct{ Pool *pgxpool.Pool }

// Materialize atomically accepts a bounded manifest. Each request pins immutable
// accepted IDs, so ingestion or concurrent evaluations cannot change its inputs.
func (c Commands) Materialize(ctx context.Context, requests []Request) ([]Receipt, error) {
	if len(requests) == 0 || len(requests) > 10000 {
		return nil, fmt.Errorf("manifesto deve conter de 1 a 10000 cálculos")
	}
	for _, r := range requests {
		if e := r.Validate(); e != nil {
			return nil, e
		}
	}
	tx, e := c.Pool.Begin(ctx)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	db := postgres.New(tx)
	results := make([]Receipt, 0, len(requests))
	for _, r := range requests {
		d, _ := lookup(r.Calculation, r.Version)
		id, e := canonical.Digest(map[string]any{"request": r, "definition": d})
		if e != nil {
			return nil, e
		}
		prior, e := read(ctx, db, id)
		if e == nil {
			results = append(results, prior)
			continue
		}
		if !errors.Is(e, pgx.ErrNoRows) {
			return nil, e
		}
		inputs := map[string]Input{}
		derived := map[string]bool{}
		roles := make([]string, 0, len(r.Inputs))
		for role := range r.Inputs {
			roles = append(roles, role)
		}
		sort.Strings(roles)
		for _, role := range roles {
			input, isDerived, e := resolve(ctx, db, r.Inputs[role])
			if e != nil {
				return nil, fmt.Errorf("input %s não aceito: %w", role, e)
			}
			inputs[role] = input
			derived[role] = isDerived
		}
		ev, e := Evaluate(r, inputs)
		if e != nil {
			return nil, e
		}
		request, _ := canonical.Bytes(r)
		definition, _ := canonical.Bytes(d)
		body, e := canonical.Bytes(ev)
		if e != nil {
			return nil, e
		}
		if e = db.CreateEngineEvaluation(ctx, postgres.CreateEngineEvaluationParams{ID: id, Request: request, Definition: definition, Result: body}); e != nil {
			return nil, e
		}
		for _, role := range roles {
			p := postgres.CreateEngineInputParams{Evaluation: id, Role: role}
			if derived[role] {
				p.DerivedID = postgres.Text(r.Inputs[role])
			} else {
				p.NormalizedID = postgres.Text(r.Inputs[role])
			}
			if e = db.CreateEngineInput(ctx, p); e != nil {
				return nil, e
			}
		}
		receipt, e := read(ctx, db, id)
		if e != nil {
			return nil, e
		}
		// A hash collision or conflicting implementation is never silently accepted.
		stored, _ := canonical.Bytes(withoutID(receipt.Evaluation))
		if string(stored) != string(body) {
			return nil, fmt.Errorf("conflito de materialização %s", id)
		}
		results = append(results, receipt)
	}
	if e = tx.Commit(ctx); e != nil {
		return nil, e
	}
	return results, nil
}
func withoutID(e Evaluation) Evaluation { e.Output.ID = ""; return e }

// DecodeManifest rejects unknown parameters and trailing content before opening services.
func DecodeManifest(body []byte) ([]Request, error) {
	var r []Request
	if len(body) > 16*1024*1024 {
		return nil, fmt.Errorf("manifesto excede 16 MiB")
	}
	// canonical.Decode also ensures there is only one JSON value.
	if e := canonical.Decode(body, &r); e != nil {
		return nil, e
	}
	var fields []map[string]json.RawMessage
	if e := json.Unmarshal(body, &fields); e != nil {
		return nil, e
	}
	for _, f := range fields {
		for k := range f {
			if k != "calculation" && k != "version" && k != "inputs" {
				return nil, fmt.Errorf("parâmetro desconhecido: %s", k)
			}
		}
	}
	if len(r) == 0 || len(r) > 10000 {
		return nil, fmt.Errorf("manifesto vazio ou grande demais")
	}
	for _, v := range r {
		if e := v.Validate(); e != nil {
			return nil, e
		}
	}
	return r, nil
}
