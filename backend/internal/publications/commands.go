package publications

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/indicators"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/platform/postgres"
)

type Commands struct {
	Pool  *pgxpool.Pool
	Store ProjectionStore
	Raw   RawVerifier
}
type rawObject struct {
	key, sha string
	size     int64
}

func stamp(t time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: t, Valid: true} }

func receipt(ctx context.Context, q *postgres.Queries, op, actor, key, fingerprint string, target any) (bool, error) {
	r, e := q.PublicationReceipt(ctx, postgres.PublicationReceiptParams{Operation: op, Actor: actor, Key: key})
	if errors.Is(e, pgx.ErrNoRows) {
		return false, nil
	}
	if e != nil {
		return false, e
	}
	if r.Fingerprint != fingerprint {
		return false, Fail("conflict", "chave de idempotência reutilizada com outra intenção")
	}
	return true, json.Unmarshal(r.Result, target)
}
func saveReceipt(ctx context.Context, q *postgres.Queries, op, actor, key, fp string, result any) error {
	body, e := canonical.Bytes(result)
	if e != nil {
		return e
	}
	return q.CreatePublicationReceipt(ctx, postgres.CreatePublicationReceiptParams{Operation: op, Actor: actor, Key: key, Fingerprint: fp, Result: body})
}

// Prepare explicitly selects IDs: capture arrival order is never official vintage order.
// SQL reads finish before any object-store IO. Uploads cannot activate a publication.
func (c Commands) Prepare(ctx context.Context, request PrepareRequest) (Prepared, error) {
	r, e := normalized(request)
	if e != nil {
		return Prepared{}, e
	}
	fp, e := canonical.Digest(r)
	if e != nil {
		return Prepared{}, e
	}
	result := Prepared{}
	if ok, e := receipt(ctx, postgres.New(c.Pool), "prepare", r.Actor, r.Key, fp, &result); ok || e != nil {
		return result, e
	}
	tx, e := c.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if e != nil {
		return result, e
	}
	defer tx.Rollback(ctx)
	q := postgres.New(tx)
	nodes := map[string]Node{}
	derived := map[string]bool{}
	visiting := map[string]bool{}
	raw := map[string]rawObject{}
	var load func(string, int) error
	load = func(id string, depth int) error {
		if _, ok := nodes[id]; ok {
			return nil
		}
		if visiting[id] || depth > 32 || len(nodes) > 30000 {
			return Fail("invalid_request", "linhagem cíclica ou acima do limite")
		}
		visiting[id] = true
		defer delete(visiting, id)
		o, e := q.PublicationNormalized(ctx, postgres.PublicationNormalizedParams{ID: id, Cutoff: stamp(r.DataCutoff)})
		if e == nil {
			var metadata map[string]any
			if e = json.Unmarshal(o.Context, &metadata); e != nil {
				return e
			}
			if metadata["monetary_base"] == "release-base-unresolved-block-publication" {
				return Fail("quality_rejected", "base monetária não resolvida: "+id)
			}
			var value *string
			if o.Status == "observed" {
				value = &o.ValueText
			}
			n := Node{Input: indicators.Input{ID: id, Series: o.Series, Start: o.StartDate.Time.Format("2006-01-02"), End: o.EndDate.Time.Format("2006-01-02"), Geography: o.Geography, Value: value, Status: o.Status, Context: metadata}, AcceptedAt: o.AcceptedAt.Time, Locator: o.Locator, Origins: []Origin{}}
			origins, e := q.PublicationOrigins(ctx, postgres.PublicationOriginsParams{Observation: id, Cutoff: stamp(r.DataCutoff)})
			if e != nil {
				return e
			}
			for _, origin := range origins {
				n.Origins = append(n.Origins, Origin{origin.Url, origin.Sha256, origin.RetrievedAt.Time})
				raw[origin.Sha256] = rawObject{origin.Key, origin.Sha256, origin.Bytes}
			}
			if len(n.Origins) == 0 {
				return Fail("quality_rejected", "proveniência ausente")
			}
			nodes[id] = n
			return nil
		}
		if !errors.Is(e, pgx.ErrNoRows) {
			return e
		}
		ev, e := q.EngineEvaluation(ctx, id)
		if errors.Is(e, pgx.ErrNoRows) {
			return Fail("quality_rejected", "ID não aceito no corte: "+id)
		}
		if e != nil {
			return e
		}
		if ev.CalculatedAt.Time.After(r.DataCutoff) {
			return Fail("quality_rejected", "cálculo posterior ao corte")
		}
		var evaluation indicators.Evaluation
		if e = json.Unmarshal(ev.Result, &evaluation); e != nil {
			return e
		}
		if evaluation.Output.Status != "observed" {
			return Fail("quality_rejected", "cálculo sem número deve ser declarado pending_recalculation")
		}
		for _, input := range evaluation.Request.Inputs {
			if e = load(input, depth+1); e != nil {
				return e
			}
			if nodes[input].AcceptedAt.After(ev.CalculatedAt.Time) {
				return Fail("quality_rejected", "input posterior ao cálculo")
			}
		}
		evaluation.Output.ID = id
		nodes[id] = Node{Input: evaluation.Output, AcceptedAt: ev.CalculatedAt.Time, Origins: []Origin{}, Evaluation: &evaluation}
		derived[id] = true
		return nil
	}
	selected := map[string]string{}
	for _, s := range r.Scope {
		selected[s.Key()] = s.ID
		if s.ID == "" {
			continue
		}
		if e = load(s.ID, 0); e != nil {
			return result, e
		}
		n := nodes[s.ID]
		series := SeriesID(n)
		if series != s.Series || n.Input.Start != s.Start || n.Input.End != s.End || n.Input.Geography != s.Geography {
			return result, Fail("quality_rejected", "ID incompatível com o recorte declarado")
		}
	}
	// Every dependency must agree with the explicit selection, even across periods
	// (e.g. the INPC base month). Missing/revised inputs never reuse an old output.
	for id, n := range nodes {
		series := SeriesID(n)
		key := (Slot{Series: series, Geography: n.Input.Geography, Start: n.Input.Start, End: n.Input.End}).Key()
		if selected[key] != id {
			return result, Fail("quality_rejected", "dependência não selecionada ou desatualizada: "+id)
		}
	}
	dependencies := make([]string, 0, len(nodes))
	for id := range nodes {
		dependencies = append(dependencies, id)
	}
	sort.Strings(dependencies)
	manifest := Manifest{"margem-publication-1", CurrentCatalog(), r.BaseActivation, r.DataCutoff, r.SelectionReason, r.Scope, dependencies}
	id, e := canonical.Digest(manifest)
	if e != nil {
		return result, e
	}
	snapshot := Snapshot{id, manifest, nodes}
	body, e := canonical.Bytes(snapshot)
	if e != nil {
		return result, e
	}
	if len(body) > MaxProjection {
		return result, Fail("invalid_request", "projeção excede 16 MiB")
	}
	if e = tx.Commit(ctx); e != nil {
		return result, e
	}
	if c.Raw == nil || c.Store == nil {
		return result, Fail("temporarily_unavailable", "armazenamento não configurado")
	}
	for _, o := range raw {
		if e = c.Raw.Verify(ctx, o.key, o.sha, o.size); e != nil {
			return result, e
		}
	}
	key := "publications/" + id + "/v1/snapshot.json"
	if e = c.Store.SaveProjection(ctx, key, body); e != nil {
		return result, e
	}
	result = Prepared{id, manifest.Catalog.Revision, key, canonical.Hash(body), int64(len(body))}
	write, e := c.Pool.Begin(ctx)
	if e != nil {
		return Prepared{}, e
	}
	defer write.Rollback(ctx)
	// Serializes only this receipt; no network IO under the transaction lock.
	if _, e = write.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,740709))", "prepare/"+r.Actor+"/"+r.Key); e != nil {
		return Prepared{}, e
	}
	db := postgres.New(write)
	if ok, e := receipt(ctx, db, "prepare", r.Actor, r.Key, fp, &result); ok || e != nil {
		return result, e
	}
	b, _ := canonical.Bytes(manifest)
	if e = db.CreatePublication(ctx, postgres.CreatePublicationParams{ID: id, Manifest: b, CatalogRevision: manifest.Catalog.Revision, DataCutoff: stamp(r.DataCutoff), BaseActivation: r.BaseActivation, ProjectionKey: key, ProjectionSha256: result.SHA256, ProjectionBytes: result.Bytes}); e != nil {
		return Prepared{}, e
	}
	prior, e := db.PublicationByID(ctx, id)
	if e != nil {
		return Prepared{}, e
	}
	if prior.ProjectionSha256 != result.SHA256 || prior.ProjectionBytes != result.Bytes {
		return Prepared{}, Fail("conflict", "publicação imutável divergente")
	}
	for _, id := range dependencies {
		p := postgres.CreatePublicationDependencyParams{Publication: result.Publication, ID: id}
		if derived[id] {
			p.DerivedID = postgres.Text(id)
		} else {
			p.NormalizedID = postgres.Text(id)
		}
		if e = db.CreatePublicationDependency(ctx, p); e != nil {
			return Prepared{}, e
		}
	}
	if e = saveReceipt(ctx, db, "prepare", r.Actor, r.Key, fp, result); e != nil {
		return Prepared{}, e
	}
	if e = write.Commit(ctx); e != nil {
		return Prepared{}, e
	}
	return result, nil
}

func (c Commands) Activate(ctx context.Context, r ActivateRequest) (Activation, error) {
	result := Activation{}
	if e := identity(r.Actor, r.Key); e != nil {
		return result, e
	}
	if !hashPattern.MatchString(r.Publication) || r.ExpectedGeneration < 0 || len(r.Reason) == 0 || len(r.Reason) > 2000 {
		return result, Fail("invalid_request", "ativação inválida")
	}
	op := "activate"
	if r.Return {
		op = "return"
	}
	fp, e := canonical.Digest(r)
	if e != nil {
		return result, e
	}
	q := postgres.New(c.Pool)
	if ok, e := receipt(ctx, q, op, r.Actor, r.Key, fp, &result); ok || e != nil {
		return result, e
	}
	p, e := q.PublicationByID(ctx, r.Publication)
	if errors.Is(e, pgx.ErrNoRows) {
		return result, Fail("not_found", "publicação inexistente")
	}
	if e != nil {
		return result, e
	}
	if c.Store == nil {
		return result, Fail("temporarily_unavailable", "armazenamento não configurado")
	}
	if _, e = c.Store.LoadProjection(ctx, p.ProjectionKey, p.ProjectionSha256, p.ProjectionBytes); e != nil {
		return result, e
	}
	tx, e := c.Pool.Begin(ctx)
	if e != nil {
		return result, e
	}
	defer tx.Rollback(ctx)
	db := postgres.New(tx)
	generation, e := db.LockPublicationChannel(ctx)
	if e != nil {
		return result, e
	}
	if ok, e := receipt(ctx, db, op, r.Actor, r.Key, fp, &result); ok || e != nil {
		return result, e
	}
	if generation != r.ExpectedGeneration {
		return result, Fail("conflict", "geração do canal mudou")
	}
	if r.Return {
		activated, e := db.WasPublicationActivated(ctx, r.Publication)
		if e != nil {
			return result, e
		}
		if !activated {
			return result, Fail("conflict", "retorno exige publicação anteriormente ativada")
		}
	} else if p.BaseActivation != generation {
		return result, Fail("conflict", "base do candidato mudou; prepare outro manifesto")
	}
	a, e := db.CreatePublicationActivation(ctx, postgres.CreatePublicationActivationParams{Generation: generation + 1, Publication: r.Publication, PreviousActivation: generation, Actor: r.Actor, Reason: r.Reason})
	if e != nil {
		return result, e
	}
	if e = db.AdvancePublicationChannel(ctx, a.Generation); e != nil {
		return result, e
	}
	result = Activation{a.Generation, a.Publication, a.PreviousActivation, a.ActivatedAt.Time, p.CatalogRevision, p.DataCutoff.Time}
	if e = saveReceipt(ctx, db, op, r.Actor, r.Key, fp, result); e != nil {
		return Activation{}, e
	}
	if e = tx.Commit(ctx); e != nil {
		return Activation{}, e
	}
	return result, nil
}
