package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"margem/backend/internal/api"
	"margem/backend/internal/catalog"
	"margem/backend/internal/indicators"
	"margem/backend/internal/ingestion"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/platform/objectstore"
	"margem/backend/internal/publications"
)

func publicationSetup(t *testing.T) (*pgxpool.Pool, *scenario, publications.Commands, publications.Queries) {
	t.Helper()
	pool, raw := setup(t)
	bucket := "margem-public-test-" + uuid.NewString()
	if _, e := raw.Client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: &bucket}); e != nil {
		t.Fatal(e)
	}
	public := &objectstore.S3{Client: raw.Client, Bucket: bucket}
	t.Cleanup(func() {
		page, e := raw.Client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &bucket})
		if e != nil {
			t.Error(e)
			return
		}
		for _, o := range page.Contents {
			if _, e = raw.Client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &bucket, Key: o.Key}); e != nil {
				t.Error(e)
			}
		}
		if _, e = raw.Client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: &bucket}); e != nil {
			t.Error(e)
		}
	})
	return pool, newScenario(pool, raw), publications.Commands{Pool: pool, Store: public, Raw: raw}, publications.Queries{Pool: pool, Store: public}
}
func scopeFor(t *testing.T, pool *pgxpool.Pool, batch string) []publications.Slot {
	t.Helper()
	rows, e := pool.Query(ctx, "SELECT o.series,o.geography,o.start_date::text,o.end_date::text,o.id FROM normalized.member m JOIN normalized.observation o ON o.id=m.observation WHERE m.batch=$1 ORDER BY o.start_date", batch)
	if e != nil {
		t.Fatal(e)
	}
	defer rows.Close()
	slots := []publications.Slot{}
	for rows.Next() {
		var s publications.Slot
		if e = rows.Scan(&s.Series, &s.Geography, &s.Start, &s.End, &s.ID); e != nil {
			t.Fatal(e)
		}
		slots = append(slots, s)
	}
	if e = rows.Err(); e != nil {
		t.Fatal(e)
	}
	return slots
}
func prepare(t *testing.T, c publications.Commands, slots []publications.Slot, base int64) publications.Prepared {
	t.Helper()
	p, e := c.Prepare(ctx, publications.PrepareRequest{Actor: "test", Key: uuid.NewString(), BaseActivation: base, DataCutoff: time.Now().UTC(), SelectionReason: "Explicit captured edition; no official vintage order inferred", Scope: slots})
	if e != nil {
		t.Fatal(e)
	}
	return p
}
func activation(p publications.Prepared, generation int64) publications.ActivateRequest {
	return publications.ActivateRequest{Actor: "test", Key: uuid.NewString(), Publication: p.Publication, ExpectedGeneration: generation, Reason: "quality verified"}
}
func get(handler http.Handler, path string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("GET", path, nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}
func expectStatus(t *testing.T, w *httptest.ResponseRecorder, status int) {
	t.Helper()
	if w.Code != status {
		t.Fatalf("HTTP %d wanted %d: %s", w.Code, status, w.Body.String())
	}
}

func TestPublicationLifecycle(t *testing.T) {
	pool, s, c, q := publicationSetup(t)
	handler := api.New(q)
	expectStatus(t, get(handler, "/api/v1/publications/current"), 404)
	first := s.run(t)
	slots := scopeFor(t, pool, first.Batch)
	p := prepare(t, c, slots, 0)
	// Accepted and even prepared does not mean public.
	expectStatus(t, get(handler, "/api/v1/series/vf1?publication="+p.Publication), 404)
	requireCount(t, pool, "published.activation", 0)
	r := activation(p, 0)
	a, e := c.Activate(ctx, r)
	if e != nil || a.Generation != 1 {
		t.Fatal(a, e)
	}
	replay, e := c.Activate(ctx, r)
	if e != nil || a != replay {
		t.Fatal(replay, e)
	}
	r.Reason = "changed intent"
	if _, e = c.Activate(ctx, r); e == nil {
		t.Fatal("same key changed intent accepted")
	}
	requireCount(t, pool, "published.activation", 1)
	current := get(handler, "/api/v1/publications/current")
	expectStatus(t, current, 200)
	if current.Header().Get("Cache-Control") != "public, max-age=0, s-maxage=60, must-revalidate" {
		t.Fatal(current.Header())
	}
	firstPage := get(handler, "/api/v1/series/vf1?publication="+p.Publication+"&limit=1")
	expectStatus(t, firstPage, 200)
	var page struct {
		Publication string
		NextCursor  string `json:"next_cursor"`
		Data        []struct {
			Node struct {
				Input struct {
					Value *string `json:"value"`
				} `json:"observation"`
			} `json:"node"`
		}
	}
	if e = json.Unmarshal(firstPage.Body.Bytes(), &page); e != nil || page.NextCursor == "" {
		t.Fatal(firstPage.Body.String(), e)
	}
	// Revision has a new ID; failed preparation leaves the current publication intact.
	s.body = []byte(`[{"data":"01/01/2025","valor":"23.1"},{"data":"01/02/2025","valor":"23.3"}]`)
	revised := s.run(t)
	revisedSlots := scopeFor(t, pool, revised.Batch)
	invalid := append([]publications.Slot(nil), revisedSlots...)
	invalid[0].ID = strings.Repeat("0", 64)
	if _, e = c.Prepare(ctx, publications.PrepareRequest{Actor: "test", Key: "invalid", BaseActivation: 1, DataCutoff: time.Now(), SelectionReason: "failure", Scope: invalid}); e == nil {
		t.Fatal("unknown reference accepted")
	}
	resolved, e := q.Resolve(ctx, time.Time{})
	if e != nil || resolved.Publication != p.Publication {
		t.Fatal(resolved, e)
	}
	p2 := prepare(t, c, revisedSlots, 1)
	// Race: only one activation wins generation 1, with different keys.
	var wg sync.WaitGroup
	successes := make(chan publications.Activation, 2)
	failures := make(chan error, 2)
	for range 2 {
		wg.Go(func() {
			a, e := c.Activate(ctx, activation(p2, 1))
			if e != nil {
				failures <- e
			} else {
				successes <- a
			}
		})
	}
	wg.Wait()
	if len(successes) != 1 || len(failures) != 1 {
		t.Fatal(len(successes), len(failures))
	}
	a2 := <-successes
	secondPage := get(handler, "/api/v1/series/vf1?publication="+p.Publication+"&limit=1&cursor="+page.NextCursor)
	expectStatus(t, secondPage, 200)
	if e = json.Unmarshal(secondPage.Body.Bytes(), &page); e != nil || page.Publication != p.Publication || len(page.Data) != 1 || page.Data[0].Node.Input.Value == nil || *page.Data[0].Node.Input.Value != "23.2" {
		t.Fatal(secondPage.Body.String(), e)
	}
	mismatch := get(handler, "/api/v1/series/vf1?publication="+p2.Publication+"&limit=1&cursor="+extractCursor(t, firstPage))
	expectStatus(t, mismatch, 400)
	if !strings.Contains(mismatch.Body.String(), "cursor_context_mismatch") {
		t.Fatal(mismatch.Body.String())
	}
	// Return is a new event; historical resolution still returns generation 2.
	back := activation(p, 2)
	back.Return = true
	a3, e := c.Activate(ctx, back)
	if e != nil || a3.Generation != 3 {
		t.Fatal(a3, e)
	}
	historical, e := q.Resolve(ctx, a2.ActivatedAt)
	if e != nil || historical.Publication != p2.Publication || historical.Generation != 2 {
		t.Fatal(historical, e)
	}
	old, e := q.Snapshot(ctx, p.Publication)
	if e != nil {
		t.Fatal(e)
	}
	if len(old.Nodes) != 2 {
		t.Fatal(old)
	}
	// Provenance is public metadata, not a raw bucket locator or credentials.
	for _, node := range old.Nodes {
		if len(node.Origins) != 1 || node.Origins[0].SHA256 == "" || node.Input.Context["method"] == nil {
			t.Fatal(node)
		}
	}
	comparison := get(handler, "/api/v1/comparisons?publication="+p2.Publication+"&series=vf1&geography=BR&from=2025-01-01&to=2025-02-28&calculation=difference&version=2")
	expectStatus(t, comparison, 200)
	if !strings.Contains(comparison.Body.String(), `"value":"0.2"`) {
		t.Fatal(comparison.Body.String())
	}
	for _, path := range []string{"/api/v1/themes", "/api/v1/themes/vida-financeira", "/api/v1/indicators?role=primary", "/api/v1/indicators/comprometimento-renda", "/api/v1/indicators/comprometimento-renda/series", "/api/v1/sources/bcb", "/api/v1/observations/" + slots[0].ID} {
		sep := "?"
		if strings.Contains(path, "?") {
			sep = "&"
		}
		expectStatus(t, get(handler, path+sep+"publication="+p.Publication), 200)
	}
	for _, query := range []string{"limit=0", "limit=201", "limit=no", "from=2025-02-30", "from=2025-03-01&to=2025-01-01", "unknown=x", "limit=1&limit=2", "cursor=broken"} {
		w := get(handler, "/api/v1/series/vf1?publication="+p.Publication+"&"+query)
		expectStatus(t, w, 400)
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal(w.Header())
		}
	}
	// Explicit unavailable most recent period cannot fall back to an older number.
	unavailable := append(append([]publications.Slot(nil), slots...), publications.Slot{Series: "vf1", Geography: "BR", Start: "2025-03-01", End: "2025-03-31", Status: "not_covered", Reason: "not published by source"})
	pending := prepare(t, c, unavailable, 3)
	if _, e = c.Activate(ctx, activation(pending, 3)); e != nil {
		t.Fatal(e)
	}
	summary := get(handler, "/api/v1/indicators/comprometimento-renda?publication="+pending.Publication)
	expectStatus(t, summary, 200)
	if !strings.Contains(summary.Body.String(), `"status":"not_covered"`) || strings.Contains(summary.Body.String(), `"value":"23.2"`) {
		t.Fatal(summary.Body.String())
	}
	// A missing retained projection returns an error, never another publication.
	public := c.Store.(*objectstore.S3)
	if _, e = public.Client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &public.Bucket, Key: &p.Projection}); e != nil {
		t.Fatal(e)
	}
	missing := get(handler, "/api/v1/series/vf1?publication="+p.Publication)
	expectStatus(t, missing, 503)
	if missing.Header().Get("Cache-Control") != "no-store" {
		t.Fatal(missing.Header())
	}
}
func extractCursor(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var x struct {
		Next string `json:"next_cursor"`
	}
	if e := json.Unmarshal(w.Body.Bytes(), &x); e != nil {
		t.Fatal(e)
	}
	return x.Next
}

func TestPreparationIdempotencyAndFailure(t *testing.T) {
	pool, s, c, _ := publicationSetup(t)
	first := s.run(t)
	slots := scopeFor(t, pool, first.Batch)
	request := publications.PrepareRequest{Actor: "test", Key: "same", DataCutoff: time.Now(), SelectionReason: "explicit edition", Scope: slots}
	p, e := c.Prepare(ctx, request)
	if e != nil {
		t.Fatal(e)
	}
	again, e := c.Prepare(ctx, request)
	if e != nil || again != p {
		t.Fatal(again, e)
	}
	request.SelectionReason = "another intention"
	if _, e = c.Prepare(ctx, request); e == nil {
		t.Fatal("reused receipt")
	}
	// Publication insert and receipt are one transaction.
	if _, e = pool.Exec(ctx, "CREATE FUNCTION published.reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER reject_receipt BEFORE INSERT ON published.receipt FOR EACH ROW EXECUTE FUNCTION published.reject_receipt()"); e != nil {
		t.Fatal(e)
	}
	request.Key = "rollback"
	request.BaseActivation = 1
	if _, e = c.Prepare(ctx, request); e == nil {
		t.Fatal("did not inject failure")
	}
	requireCount(t, pool, "published.publication", 1)
	requireCount(t, pool, "published.activation", 0)
	pool.Exec(ctx, "DROP TRIGGER reject_receipt ON published.receipt")
	// Cutoff before acceptance rejects IDs even if they are now known.
	request.Key = "cutoff"
	request.DataCutoff = time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	if _, e = c.Prepare(ctx, request); e == nil {
		t.Fatal("accepted future data")
	}
	// Missing raw prevents readiness, leaving no candidate to activate.
	raw := c.Raw.(*objectstore.S3)
	key := "raw/sha256/"
	var sha string
	if e = pool.QueryRow(ctx, "SELECT sha256 FROM raw.object LIMIT 1").Scan(&sha); e != nil {
		t.Fatal(e)
	}
	key += sha
	if _, e = raw.Client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &raw.Bucket, Key: &key}); e != nil {
		t.Fatal(e)
	}
	request.Key = "missing-raw"
	request.DataCutoff = time.Now()
	if _, e = c.Prepare(ctx, request); e == nil {
		t.Fatal("missing raw accepted")
	}
	requireCount(t, pool, "published.publication", 1)
}

func TestPublicationRoleIsolation(t *testing.T) {
	pool, _, _, _ := publicationSetup(t)
	for _, name := range []string{"api", "publisher"} {
		t.Run(name, func(t *testing.T) {
			session, e := pool.Acquire(ctx)
			if e != nil {
				t.Fatal(e)
			}
			defer session.Release()
			role := "margem_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
			if _, e = session.Exec(ctx, "CREATE ROLE "+role); e != nil {
				t.Fatal(e)
			}
			defer func() {
				session.Exec(ctx, "RESET ROLE")
				session.Exec(ctx, "DROP OWNED BY "+role)
				session.Exec(ctx, "DROP ROLE "+role)
			}()
			grants := readGrants(t, "../"+name+"-grants.sql")
			if _, e = session.Exec(ctx, strings.ReplaceAll(grants, "margem_"+name, role)); e != nil {
				t.Fatal(e)
			}
			if _, e = session.Exec(ctx, "SET ROLE "+role); e != nil {
				t.Fatal(e)
			}
			denied := []string{"UPDATE published.publication SET manifest='{}'", "DELETE FROM published.activation", "UPDATE published.receipt SET fingerprint='x'", "UPDATE normalized.observation SET value=0"}
			if name == "api" {
				denied = append(denied, "SELECT * FROM raw.capture", "UPDATE published.channel SET generation=0", "INSERT INTO published.activation VALUES(1,'fake',0,now(),'x','x')")
			}
			for _, sql := range denied {
				if _, e = session.Exec(ctx, sql); e == nil {
					t.Fatal(fmt.Sprintf("role %s allowed %s", name, sql))
				}
			}
		})
	}
}

func readGrants(t *testing.T, path string) string {
	t.Helper()
	b, e := os.ReadFile(path)
	if e != nil {
		t.Fatal(e)
	}
	return string(b)
}

func TestDerivedPublicationRejectsStaleInputs(t *testing.T) {
	pool, s, c, q := publicationSetup(t)
	value := "1500"
	s.window, _ = period.NewWindow("2025-01-01", "2025-12-31", time.Now())
	batches := map[string]string{}
	for _, source := range []string{"bcb", "ibge"} {
		s.commands.Sources[source] = func(ctx context.Context, f ingestion.Fetcher, w period.Window) ([]observations.Observation, error) {
			b, e := f.Get(ctx, "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1619/dados")
			if e != nil {
				return nil, e
			}
			result := []observations.Observation{}
			for _, x := range []struct{ series, date, value string }{{"minimum-nominal", "2025-01-01", value}, {"inpc-index", "2025-01-01", "100"}, {"inpc-index", "2025-12-01", "110"}} {
				if catalog.ByID[x.series].Source != source {
					continue
				}
				date, _ := period.Date(x.date)
				a, z := period.Month(date.Year(), date.Month())
				o, e := observations.New(catalog.ByID[x.series], a, z, x.value, x.series, map[string]any{}, "BR", []string{canonical.Hash(b)})
				if e != nil {
					return nil, e
				}
				result = append(result, o)
			}
			return result, nil
		}
		r, e := s.commands.Run(ctx, source, s.window, true)
		if e != nil {
			t.Fatal(e)
		}
		batches[source] = r.Batch
	}
	slots := append(scopeFor(t, pool, batches["bcb"]), scopeFor(t, pool, batches["ibge"])...)
	inputs := map[string]string{}
	for _, slot := range slots {
		role := "nominal"
		if slot.Series == "inpc-index" {
			role = "current_index"
			if slot.Start == "2025-12-01" {
				role = "base_index"
			}
		}
		inputs[role] = slot.ID
	}
	ev, e := (indicators.Commands{Pool: pool}).Materialize(ctx, []indicators.Request{{Calculation: "tr2", Version: "1", Inputs: inputs}})
	if e != nil {
		t.Fatal(e)
	}
	derived := publications.Slot{Series: "tr2", Geography: "BR", Start: "2025-01-01", End: "2025-01-31", ID: ev[0].ID}
	rebased, e := (indicators.Commands{Pool: pool}).Materialize(ctx, []indicators.Request{{Calculation: "rebase", Version: "2", Inputs: map[string]string{"current": ev[0].ID, "base": ev[0].ID}}})
	if e != nil {
		t.Fatal(e)
	}
	generic := publications.Slot{Series: rebased[0].Evaluation.Output.Series, Geography: "BR", Start: "2025-01-01", End: "2025-01-31", ID: rebased[0].ID}
	old := prepare(t, c, append(append([]publications.Slot(nil), slots...), derived, generic), 0)
	if _, e = c.Activate(ctx, activation(old, 0)); e != nil {
		t.Fatal(e)
	}
	for _, slug := range []string{"salario-minimo-real", "tr2-input"} {
		response := get(api.New(q), "/api/v1/indicators/"+slug+"/series?publication="+old.Publication)
		expectStatus(t, response, 200)
		containsRebased := strings.Contains(response.Body.String(), generic.Series)
		if containsRebased != (slug == "salario-minimo-real") {
			t.Fatalf("rebased TR2 classified incorrectly for %s: %s", slug, response.Body.String())
		}
	}
	value = "1650"
	revised, e := s.commands.Run(ctx, "bcb", s.window, true)
	if e != nil {
		t.Fatal(e)
	}
	newSlots := append(scopeFor(t, pool, revised.Batch), scopeFor(t, pool, batches["ibge"])...)
	request := publications.PrepareRequest{Actor: "test", Key: "stale", BaseActivation: 1, DataCutoff: time.Now(), SelectionReason: "revised input with stale derived output", Scope: append(append([]publications.Slot(nil), newSlots...), derived)}
	if _, e = c.Prepare(ctx, request); e == nil {
		t.Fatal("stale derived input accepted")
	}
	request.Key = "pending"
	derived.ID = ""
	derived.Status = "pending_recalculation"
	derived.Reason = "minimum revised"
	request.Scope = append(newSlots, derived)
	pending, e := c.Prepare(ctx, request)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = c.Activate(ctx, activation(pending, 1)); e != nil {
		t.Fatal(e)
	}
	handler := api.New(q)
	summary := get(handler, "/api/v1/indicators/salario-minimo-real?publication="+pending.Publication)
	expectStatus(t, summary, 200)
	if strings.Contains(summary.Body.String(), `"value":"1650"`) || !strings.Contains(summary.Body.String(), "pending_recalculation") {
		t.Fatal(summary.Body.String())
	}
	historical := get(handler, "/api/v1/indicators/salario-minimo-real?series=tr2&publication="+old.Publication)
	expectStatus(t, historical, 200)
	if !strings.Contains(historical.Body.String(), `"value":"1650"`) {
		t.Fatal(historical.Body.String())
	}
}

func TestActivationReceiptRollback(t *testing.T) {
	pool, s, c, q := publicationSetup(t)
	first := s.run(t)
	p := prepare(t, c, scopeFor(t, pool, first.Batch), 0)
	if _, e := pool.Exec(ctx, "CREATE FUNCTION published.reject_activation_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation='activate' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_activation_receipt BEFORE INSERT ON published.receipt FOR EACH ROW EXECUTE FUNCTION published.reject_activation_receipt()"); e != nil {
		t.Fatal(e)
	}
	r := activation(p, 0)
	if _, e := c.Activate(ctx, r); e == nil {
		t.Fatal("did not inject failure")
	}
	requireCount(t, pool, "published.activation", 0)
	var generation int64
	if e := pool.QueryRow(ctx, "SELECT generation FROM published.channel").Scan(&generation); e != nil || generation != 0 {
		t.Fatal(generation, e)
	}
	if _, e := q.Resolve(ctx, time.Time{}); e == nil {
		t.Fatal("partial activation visible")
	}
	pool.Exec(ctx, "DROP TRIGGER reject_activation_receipt ON published.receipt")
	if a, e := c.Activate(ctx, r); e != nil || a.Generation != 1 {
		t.Fatal(a, e)
	}
}
