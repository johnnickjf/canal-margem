package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"margem/backend/internal/app"
	"margem/backend/internal/catalog"
	"margem/backend/internal/ingestion"
	"margem/backend/internal/legacy"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/platform/postgres"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

var ctx = context.Background()

func setup(t *testing.T) (*pgxpool.Pool, *objectstore.S3) {
	t.Helper()
	dsn, endpoint := os.Getenv("TEST_DATABASE_URL"), os.Getenv("TEST_S3_ENDPOINT_URL")
	if dsn == "" || endpoint == "" {
		if os.Getenv("REQUIRE_INTEGRATION") == "1" {
			t.Fatal("serviços de integração obrigatórios ausentes")
		}
		t.Skip("requer TEST_DATABASE_URL e TEST_S3_ENDPOINT_URL")
	}
	cfg, e := pgx.ParseConfig(dsn)
	if e != nil {
		t.Fatal(e)
	}
	admin, e := pgx.ConnectConfig(ctx, cfg)
	if e != nil {
		t.Fatal(e)
	}
	name := "margem_go_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, e = admin.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{name}.Sanitize()); e != nil {
		t.Fatal(e)
	}
	poolConfig, e := pgxpool.ParseConfig(dsn)
	if e != nil {
		t.Fatal(e)
	}
	poolConfig.ConnConfig.Database = name
	pool, e := pgxpool.NewWithConfig(ctx, poolConfig)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() {
		pool.Close()
		if _, e := admin.Exec(ctx, "DROP DATABASE "+pgx.Identifier{name}.Sanitize()+" WITH (FORCE)"); e != nil {
			t.Error(e)
		}
		admin.Close(ctx)
	})
	var actual string
	if e = pool.QueryRow(ctx, "SELECT current_database()").Scan(&actual); e != nil || actual != name {
		t.Fatalf("isolamento do banco inválido: %s", actual)
	}
	if e = postgres.Migrate(ctx, pool); e != nil {
		t.Fatal(e)
	}
	t.Setenv("S3_ENDPOINT_URL", endpoint)
	bucket := "margem-go-test-" + uuid.NewString()
	t.Setenv("RAW_BUCKET", bucket)
	t.Setenv("AWS_ACCESS_KEY_ID", "local")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "local")
	t.Setenv("AWS_DEFAULT_REGION", "us-east-1")
	store, e := objectstore.FromEnv(ctx)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = store.Client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: &bucket}); e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() {
		p := s3.NewListObjectsV2Paginator(store.Client, &s3.ListObjectsV2Input{Bucket: &bucket})
		for p.HasMorePages() {
			page, e := p.NextPage(ctx)
			if e != nil {
				t.Error(e)
				break
			}
			ids := []types.ObjectIdentifier{}
			for _, o := range page.Contents {
				ids = append(ids, types.ObjectIdentifier{Key: o.Key})
			}
			if len(ids) > 0 {
				if _, e = store.Client.DeleteObjects(ctx, &s3.DeleteObjectsInput{Bucket: &bucket, Delete: &types.Delete{Objects: ids}}); e != nil {
					t.Error(e)
				}
			}
		}
		if _, e = store.Client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: &bucket}); e != nil {
			t.Error(e)
		}
	})
	return pool, store
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type scenario struct {
	commands ingestion.Commands
	body     []byte
	statuses []int
	calls    int
	window   period.Window
}

func newScenario(pool *pgxpool.Pool, store objectstore.Store) *scenario {
	s := &scenario{body: []byte(`[{"data":"01/01/2025","valor":"23.1"},{"data":"01/02/2025","valor":"23.2"}]`)}
	s.window, _ = period.NewWindow("2025-01-01", "2025-02-28", time.Now())
	s.commands = ingestion.Commands{Pool: pool, Store: store, Sources: map[string]ingestion.Source{"bcb": func(ctx context.Context, f ingestion.Fetcher, w period.Window) ([]observations.Observation, error) {
		b, e := f.Get(ctx, "https://api.bcb.gov.br/dados/serie/bcdata.sgs.29265/dados")
		if e != nil {
			return nil, e
		}
		return ingestion.NormalizeBCB(b, catalog.ByID["vf1"], w, []string{canonical.Hash(b)})
	}}}
	s.commands.FetcherFactory = func(db *pgx.Conn, store objectstore.Store, run pgtype.UUID) ingestion.Fetcher {
		f := ingestion.NewHTTPFetcher(db, store, run)
		f.Client.Transport = roundTrip(func(r *http.Request) (*http.Response, error) {
			s.calls++
			status := 200
			if len(s.statuses) > 0 {
				status = s.statuses[0]
				s.statuses = s.statuses[1:]
			}
			return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(bytes.NewReader(s.body)), Request: r}, nil
		})
		f.Wait = func(context.Context, time.Duration) error { return nil }
		return f
	}
	return s
}
func (s *scenario) run(t *testing.T) ingestion.Result {
	t.Helper()
	r, e := s.commands.Run(ctx, "bcb", s.window, true)
	if e != nil {
		t.Fatal(e)
	}
	return r
}
func count(t *testing.T, pool *pgxpool.Pool, table string) int {
	t.Helper()
	var n int
	if e := pool.QueryRow(ctx, "SELECT count(*) FROM "+pgx.Identifier(strings.Split(table, ".")).Sanitize()).Scan(&n); e != nil {
		t.Fatal(e)
	}
	return n
}
func requireCount(t *testing.T, pool *pgxpool.Pool, table string, n int) {
	t.Helper()
	if got := count(t, pool, table); got != n {
		t.Fatalf("%s: %d; esperado %d", table, got, n)
	}
}
func TestPipelineIntegration(t *testing.T) {
	t.Run("replay revisions and direct lineage", func(t *testing.T) {
		pool, store := setup(t)
		s := newScenario(pool, store)
		first, again := s.run(t), s.run(t)
		if first.Changed != 2 || again.Changed != 0 || first.Batch != again.Batch {
			t.Fatal(first, again)
		}
		requireCount(t, pool, "normalized.observation", 2)
		requireCount(t, pool, "raw.capture", 2)
		requireCount(t, pool, "raw.object", 1)
		s.body = bytes.Replace(s.body, []byte("23.2"), []byte("23.3"), 1)
		revision := s.run(t)
		if revision.Changed != 1 || revision.Batch == first.Batch {
			t.Fatal(revision)
		}
		requireCount(t, pool, "normalized.observation", 3)
		requireCount(t, pool, "normalized.provenance", 6)
		if s.run(t).Changed != 0 {
			t.Fatal("revisão duplicada")
		}
		if r, e := (observations.Queries{Pool: pool, Store: store}).Verify(ctx); e != nil || r.Status != "verified" {
			t.Fatal(r, e)
		}
		var lineage int
		e := pool.QueryRow(ctx, "SELECT count(*) FROM normalized.provenance p JOIN raw.capture c ON c.id=p.capture JOIN raw.object o ON o.sha256=c.object WHERE p.run=$1", revision.Run).Scan(&lineage)
		if e != nil || lineage != 2 {
			t.Fatal(lineage, e)
		}
	})
	t.Run("validation failure preserves accepted data", func(t *testing.T) {
		pool, store := setup(t)
		s := newScenario(pool, store)
		s.run(t)
		s.body = []byte(`[{"data":"02/01/2025","valor":"24"}]`)
		if _, e := s.commands.Run(ctx, "bcb", s.window, true); e == nil {
			t.Fatal("aceitou dia inválido")
		}
		requireCount(t, pool, "normalized.observation", 2)
		requireCount(t, pool, "normalized.receipt", 1)
		var status string
		if e := pool.QueryRow(ctx, "SELECT status FROM ops.run ORDER BY started_at DESC LIMIT 1").Scan(&status); e != nil || status != "failed" {
			t.Fatal(status, e)
		}
	})
	t.Run("http retries preserve error captures", func(t *testing.T) {
		pool, store := setup(t)
		s := newScenario(pool, store)
		s.statuses = []int{503, 429}
		s.run(t)
		requireCount(t, pool, "raw.capture", 3)
		s.statuses = []int{403, 200}
		if _, e := s.commands.Run(ctx, "bcb", s.window, true); e == nil {
			t.Fatal("aceitou 403")
		}
		if len(s.statuses) != 1 {
			t.Fatal("repetiu 403")
		}
	})
	t.Run("raw corruption prevents acceptance", func(t *testing.T) {
		pool, store := setup(t)
		s := newScenario(pool, store)
		key := "raw/sha256/" + canonical.Hash(s.body)
		if _, e := store.Client.PutObject(ctx, &s3.PutObjectInput{Bucket: &store.Bucket, Key: &key, Body: strings.NewReader("corruption")}); e != nil {
			t.Fatal(e)
		}
		if _, e := s.commands.Run(ctx, "bcb", s.window, true); e == nil {
			t.Fatal("aceitou raw corrompido")
		}
		requireCount(t, pool, "normalized.receipt", 0)
	})
	t.Run("distributed lock schedule and orphan recovery", func(t *testing.T) {
		pool, store := setup(t)
		s := newScenario(pool, store)
		conn, e := pool.Acquire(ctx)
		if e != nil {
			t.Fatal(e)
		}
		defer conn.Release()
		if _, e = conn.Exec(ctx, "SELECT pg_advisory_lock(740711)"); e != nil {
			t.Fatal(e)
		}
		r, e := s.commands.Run(ctx, "bcb", s.window, true)
		if e != nil || r.Status != "busy" {
			t.Fatal(r, e)
		}
		conn.Exec(ctx, "SELECT pg_advisory_unlock(740711)")
		s.run(t)
		r, e = s.commands.Run(ctx, "bcb", s.window, false)
		if e != nil || r.Status != "not-due" {
			t.Fatal(r, e)
		}
		requireCount(t, pool, "ops.run", 1)
		if _, e = pool.Exec(ctx, "INSERT INTO ops.run(id,source,catalog,status,window_start,window_end) VALUES ($1,'bcb',$2,'running','2025-01-01','2025-02-28')", uuid.NewString(), catalog.Version); e != nil {
			t.Fatal(e)
		}
		s.run(t)
		var n int
		pool.QueryRow(ctx, "SELECT count(*) FROM ops.run WHERE error='worker-lost'").Scan(&n)
		if n != 1 {
			t.Fatal(n)
		}
	})
	t.Run("receipt failure rolls back batch and observations", func(t *testing.T) {
		pool, store := setup(t)
		s := newScenario(pool, store)
		s.run(t)
		_, e := pool.Exec(ctx, "CREATE FUNCTION ops.reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER reject_receipt BEFORE INSERT ON normalized.receipt FOR EACH ROW EXECUTE FUNCTION ops.reject_receipt()")
		if e != nil {
			t.Fatal(e)
		}
		s.body = bytes.Replace(s.body, []byte("23.2"), []byte("24"), 1)
		if _, e = s.commands.Run(ctx, "bcb", s.window, true); e == nil {
			t.Fatal("não injetou falha")
		}
		requireCount(t, pool, "normalized.observation", 2)
		requireCount(t, pool, "normalized.batch", 1)
		requireCount(t, pool, "normalized.receipt", 1)
		requireCount(t, pool, "raw.capture", 2)
		if _, e = pool.Exec(ctx, "DROP TRIGGER reject_receipt ON normalized.receipt; DROP FUNCTION ops.reject_receipt()"); e != nil {
			t.Fatal(e)
		}
		if s.run(t).Changed != 1 {
			t.Fatal("recovery falhou")
		}
	})
	t.Run("concurrent conditional raw creation", func(t *testing.T) {
		_, store := setup(t)
		var wg sync.WaitGroup
		for range 2 {
			wg.Go(func() {
				if _, _, e := store.Save(ctx, []byte("identical")); e != nil {
					t.Error(e)
				}
			})
		}
		wg.Wait()
		r, e := store.Client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &store.Bucket})
		if e != nil || len(r.Contents) != 1 {
			t.Fatal(r, e)
		}
	})
	t.Run("health and missing raw are observable", func(t *testing.T) {
		pool, store := setup(t)
		s := newScenario(pool, store)
		s.run(t)
		r, e := (ingestion.Queries{Pool: pool}).Health(ctx)
		if e != nil {
			t.Fatal(e)
		}
		for _, source := range r.Sources {
			if source.Source == "bcb" && (source.Healthy || len(source.StaleSeries) != 1 || source.StaleSeries[0] != "vf1") {
				t.Fatal(source)
			}
		}
		boundary, e := (ingestion.Queries{Pool: pool, Now: func() time.Time { return s.window.End.AddDate(0, 0, 120).Add(12 * time.Hour) }}).Health(ctx)
		if e != nil {
			t.Fatal(e)
		}
		for _, source := range boundary.Sources {
			if source.Source == "bcb" && (source.Healthy || len(source.StaleSeries) != 0 || len(source.MissingSeries) != 2) {
				t.Fatalf("limite diário antecipado: %+v", source)
			}
		}
		key := "raw/sha256/" + canonical.Hash(s.body)
		if _, e = store.Client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &store.Bucket, Key: &key}); e != nil {
			t.Fatal(e)
		}
		integrity, e := (observations.Queries{Pool: pool, Store: store}).Verify(ctx)
		if e == nil || integrity.Status != "failed" || integrity.FailedObjects != 1 || len(integrity.Failures) != 1 || integrity.Failures[0].SHA256 != canonical.Hash(s.body) || integrity.Failures[0].Reason != "missing" {
			t.Fatalf("raw ausente não identificado: %+v, %v", integrity, e)
		}
		databaseURL, e := url.Parse(os.Getenv("TEST_DATABASE_URL"))
		if e != nil {
			t.Fatal(e)
		}
		databaseURL.Path = "/" + pool.Config().ConnConfig.Database
		t.Setenv("DATABASE_URL", databaseURL.String())
		var stdout, stderr bytes.Buffer
		if code := app.Run(ctx, []string{"verify"}, &stdout, &stderr); code != 1 || stdout.Len() != 0 {
			t.Fatalf("verify CLI retornou %d, stdout %q", code, stdout.String())
		}
		var report observations.Integrity
		if e = json.Unmarshal(stderr.Bytes(), &report); e != nil || report.FailedObjects != 1 || len(report.Failures) != 1 || report.Failures[0].SHA256 != canonical.Hash(s.body) || strings.Contains(stderr.String(), key) {
			t.Fatalf("diagnóstico CLI inválido: %+v, %v", report, e)
		}
	})
	t.Run("runtime cannot mutate history", func(t *testing.T) {
		pool, store := setup(t)
		s := newScenario(pool, store)
		s.run(t)
		session, e := pool.Acquire(ctx)
		if e != nil {
			t.Fatal(e)
		}
		defer session.Release()
		role := "margem_go_worker_" + strings.ReplaceAll(uuid.NewString(), "-", "")
		if _, e = session.Exec(ctx, "CREATE ROLE "+pgx.Identifier{role}.Sanitize()); e != nil {
			t.Fatal(e)
		}
		defer func() {
			session.Exec(ctx, "RESET ROLE")
			session.Exec(ctx, "DROP OWNED BY "+pgx.Identifier{role}.Sanitize())
			session.Exec(ctx, "DROP ROLE "+pgx.Identifier{role}.Sanitize())
		}()
		grants, e := os.ReadFile("../runtime-grants.sql")
		if e != nil {
			t.Fatal(e)
		}
		if _, e = session.Exec(ctx, strings.ReplaceAll(string(grants), "margem_worker", role)); e != nil {
			t.Fatal(e)
		}
		if _, e = session.Exec(ctx, "SET ROLE "+pgx.Identifier{role}.Sanitize()); e != nil {
			t.Fatal(e)
		}
		for _, sql := range []string{"UPDATE derived.evaluation SET result='{}'", "DELETE FROM derived.input", "DELETE FROM derived.evaluation", "UPDATE normalized.observation SET value=0", "DELETE FROM raw.capture", "DELETE FROM normalized.receipt", "UPDATE ops.catalog SET definition='{}'"} {
			if _, e = session.Exec(ctx, sql); e == nil {
				t.Fatalf("runtime permitiu %s", sql)
			}
		}
	})
	t.Run("migration checksum and catalog identity", func(t *testing.T) {
		pool, _ := setup(t)
		if e := postgres.Migrate(ctx, pool); e != nil {
			t.Fatal(e)
		}
		if catalog.Version != "c937cf6dc9d642c7eb4cb78701e723e725e30457f80efdb901a225fc3ad29dc9" {
			t.Fatal(catalog.Version)
		}
		pool.Exec(ctx, "UPDATE ops.migration SET sha256='changed'")
		if e := postgres.Migrate(ctx, pool); e == nil {
			t.Fatal("aceitou migração alterada")
		}
	})
}
func TestLegacyIntegration(t *testing.T) {
	pool, store := setup(t)
	root := t.TempDir()
	for _, d := range []string{"raw", "snapshots", "runs"} {
		if e := os.Mkdir(filepath.Join(root, d), 0700); e != nil {
			t.Fatal(e)
		}
	}
	raw := []byte(`{"original":"official"}`)
	sha := canonical.Hash(raw)
	os.WriteFile(filepath.Join(root, "raw", sha), raw, 0600)
	record := map[string]any{"id": "experimental-1", "value": "23.100", "supersedes": nil, "raw_artifact": sha, "retrieved_at": "2025-02-01T14:00:00Z", "accepted_at": "2025-02-01T14:00:01Z"}
	state := map[string]any{"schema_version": 1, "normalization_version": "poc-1", "observations": []any{record}, "selected": map[string]string{"vf1:2025-01": "experimental-1"}, "batches": []any{map[string]any{"observation_ids": []string{"experimental-1"}}}}
	b, _ := canonical.Bytes(state)
	id := canonical.Hash(b)
	os.WriteFile(filepath.Join(root, "snapshots", id+".json"), b, 0600)
	os.WriteFile(filepath.Join(root, "current"), []byte(id+"\n"), 0600)
	log, _ := canonical.Bytes(map[string]any{"artifacts": []any{map[string]any{"sha256": sha, "bytes": len(raw)}}})
	os.WriteFile(filepath.Join(root, "runs", "run.json"), log, 0600)
	c := legacy.Commands{Pool: pool, Store: store}
	first, e := c.Import(ctx, root)
	if e != nil {
		t.Fatal(e)
	}
	again, e := c.Import(ctx, root)
	if e != nil || first != again || first.Promoted || first.Observations != 1 {
		t.Fatal(first, again, e)
	}
	requireCount(t, pool, "legacy.import", 1)
	requireCount(t, pool, "normalized.observation", 0)
	var saved []byte
	if e = pool.QueryRow(ctx, "SELECT record FROM legacy.observation WHERE id='experimental-1'").Scan(&saved); e != nil {
		t.Fatal(e)
	}
	var value map[string]any
	json.Unmarshal(saved, &value)
	if value["value"] != "23.100" || value["retrieved_at"] != record["retrieved_at"] {
		t.Fatal(value)
	}
	lock := filepath.Join(root, "writer.lock")
	os.Mkdir(lock, 0700)
	if _, e = c.Import(ctx, root); e == nil {
		t.Fatal("ignorou lock PoC")
	}
	if _, e = os.Stat(lock); e != nil {
		t.Fatal("removeu lock alheio")
	}
	os.Remove(lock)
	os.WriteFile(filepath.Join(root, "raw", sha), []byte("corrupt"), 0600)
	if _, e = legacy.Inspect(root); e == nil {
		t.Fatal("aceitou raw inválido")
	}
}

func referenceURL(raw string) string {
	u, e := url.Parse(raw)
	if e != nil {
		return raw
	}
	u.RawQuery = u.Query().Encode()
	return u.String()
}
func TestOfficialMigrationEndToEnd(t *testing.T) {
	root := os.Getenv("MIGRATION_CORPUS")
	if root == "" {
		t.Skip("defina MIGRATION_CORPUS para replay integral dos originais")
	}
	pool, store := setup(t)
	b, e := os.ReadFile(filepath.Join(root, "urls.json"))
	if e != nil {
		t.Fatal(e)
	}
	var entries []struct {
		URL, SHA256 string
		Status      int
		Headers     map[string]string
	}
	if e = json.Unmarshal(b, &entries); e != nil {
		t.Fatal(e)
	}
	index := map[string]int{}
	for i, x := range entries {
		index[referenceURL(x.URL)] = i
	}
	b, e = os.ReadFile(filepath.Join(root, "observations.json"))
	if e != nil {
		t.Fatal(e)
	}
	var expected []struct{ ID, Series string }
	if e = json.Unmarshal(b, &expected); e != nil {
		t.Fatal(e)
	}
	ids := map[string]bool{}
	for _, o := range expected {
		ids[o.ID] = true
	}
	commands := ingestion.Commands{Pool: pool, Store: store}
	commands.FetcherFactory = func(db *pgx.Conn, s objectstore.Store, run pgtype.UUID) ingestion.Fetcher {
		f := ingestion.NewHTTPFetcher(db, s, run)
		f.Client.Transport = roundTrip(func(r *http.Request) (*http.Response, error) {
			i, ok := index[referenceURL(r.URL.String())]
			if !ok {
				return nil, fmt.Errorf("URL ausente no corpus: %s", r.URL.String())
			}
			x := entries[i]
			b, e := os.ReadFile(filepath.Join(root, "raw", x.SHA256))
			if e != nil {
				return nil, e
			}
			if canonical.Hash(b) != x.SHA256 {
				return nil, fmt.Errorf("raw de referência corrompido")
			}
			h := http.Header{}
			for k, v := range x.Headers {
				h.Set(k, v)
			}
			return &http.Response{StatusCode: x.Status, Header: h, Body: io.NopCloser(bytes.NewReader(b)), Request: r}, nil
		})
		return f
	}
	w, _ := period.NewWindow("2012-01-01", "2026-10-17", time.Now())
	first := map[string]string{}
	expectedBatches := map[string]string{"ibge": "36ca2c3bfb6f32a24b39e15a7ba1f34690e89d353f83ad69587ec3fea56fbccd", "bcb": "7aeced5853ca8614f9c236cbbdaa4d78b206ffc36512848ac68dff24c14ad24b", "anp": "e0a5e829a07d27bcd1491575c265bdbac58081baeadaa57cbb3069bcd1a4715b", "dieese": "63fdaceb9d59bf8b8c6479a8eadb9b3567f238fac3fca5146f08f7a97d00f567", "fjp": "0a064dc7900615c54d2384833f04d31448f9918617f1e615e36a99bdfea9bb2b"}
	for iteration := range 2 {
		for _, source := range catalog.Sources {
			r, e := commands.Run(ctx, source, w, true)
			if e != nil {
				t.Fatalf("%s: %v", source, e)
			}
			if r.Batch != expectedBatches[source] {
				t.Fatalf("%s: lote Go %s; Python %s", source, r.Batch, expectedBatches[source])
			}
			if iteration == 0 {
				first[source] = r.Batch
			} else if r.Batch != first[source] || r.Changed != 0 {
				t.Fatalf("%s: repetição criou versão: %+v", source, r)
			}
			t.Logf("replay %d %s: %d observações, %d novas", iteration+1, source, r.Observations, r.Changed)
		}
	}
	requireCount(t, pool, "normalized.observation", len(expected))
	rows, e := pool.Query(ctx, "SELECT id FROM normalized.observation")
	if e != nil {
		t.Fatal(e)
	}
	for rows.Next() {
		var id string
		if e = rows.Scan(&id); e != nil {
			t.Fatal(e)
		}
		if !ids[id] {
			t.Fatalf("ID não existia no Python: %s", id)
		}
	}
	if e = rows.Err(); e != nil {
		t.Fatal(e)
	}
	rows.Close()
	if poc := os.Getenv("MIGRATION_POC"); poc != "" {
		r, e := (legacy.Commands{Pool: pool, Store: store}).Import(ctx, poc)
		if e != nil {
			t.Fatal(e)
		}
		if r.Import != "83ce402e5237bd181870ccbc9dbbd60864903d328a7a49cebdfd943e24eecaec" || r.Files != 21 || r.Observations != 587 || r.Promoted {
			t.Fatalf("arquivo PoC divergente: %+v", r)
		}
		again, e := (legacy.Commands{Pool: pool, Store: store}).Import(ctx, poc)
		if e != nil || r != again {
			t.Fatal(r, again, e)
		}
	}
	integrity, e := (observations.Queries{Pool: pool, Store: store}).Verify(ctx)
	if e != nil {
		t.Fatal(e)
	}
	t.Logf("integridade: %+v", integrity)
}
