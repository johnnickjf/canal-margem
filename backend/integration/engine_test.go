package integration

import (
	"context"
	"encoding/json"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"margem/backend/internal/catalog"
	"margem/backend/internal/indicators"
	"margem/backend/internal/ingestion"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/platform/postgres"
)

// The same ingestion command that writes raw/captures/receipts accepts inputs;
// engine tests never insert normalized observations around that boundary.
func TestEngineAcceptedInputsRevisionsAndAtomicity(t *testing.T) {
	pool, store := setup(t)
	scenario := newScenario(pool, store)
	value := "1500"
	adapter := func(ctx context.Context, f ingestion.Fetcher, w period.Window) ([]observations.Observation, error) {
		body, e := f.Get(ctx, "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1619/dados")
		if e != nil {
			return nil, e
		}
		rows := []observations.Observation{}
		for _, item := range []struct{ series, date, value string }{{"minimum-nominal", "2025-01-01", value}, {"inpc-index", "2025-01-01", "100"}, {"inpc-index", "2025-12-01", "110"}, {"cv4", "2025-01-01", "750"}} {
			start, _ := period.Date(item.date)
			a, b := period.Month(start.Year(), start.Month())
			geo := "BR"
			metadata := map[string]any{}
			if item.series == "cv4" {
				geo = "BR-city-3550308"
				metadata = map[string]any{"composition": "regional", "method_segment": "partnership-2025", "published_work_time": "110h00m"}
			}
			o, e := observations.New(catalog.ByID[item.series], a, b, item.value, item.series, metadata, geo, []string{canonical.Hash(body)})
			if e != nil {
				return nil, e
			}
			rows = append(rows, o)
		}
		return rows, nil
	}
	scenario.window, _ = period.NewWindow("2025-01-01", "2025-12-31", time.Now())
	for _, source := range []string{"bcb", "ibge", "dieese"} {
		scenario.commands.Sources[source] = func(ctx context.Context, f ingestion.Fetcher, w period.Window) ([]observations.Observation, error) {
			all, e := adapter(ctx, f, w)
			if e != nil {
				return nil, e
			}
			selected := []observations.Observation{}
			for _, o := range all {
				if catalog.ByID[o.Series].Source == source {
					selected = append(selected, o)
				}
			}
			return selected, nil
		}
		if _, e := scenario.commands.Run(ctx, source, scenario.window, true); e != nil {
			t.Fatal(e)
		}
	}
	ids := map[string]string{}
	rows, e := pool.Query(ctx, "SELECT series,id,start_date::text FROM normalized.observation")
	if e != nil {
		t.Fatal(e)
	}
	for rows.Next() {
		var series, id, date string
		if e = rows.Scan(&series, &id, &date); e != nil {
			t.Fatal(e)
		}
		if series == "inpc-index" {
			series += date
		}
		ids[series] = id
	}
	if e = rows.Err(); e != nil {
		t.Fatal(e)
	}
	rows.Close()
	tr2 := indicators.Request{Calculation: "tr2", Version: "1", Inputs: map[string]string{"nominal": ids["minimum-nominal"], "current_index": ids["inpc-index2025-01-01"], "base_index": ids["inpc-index2025-12-01"]}}
	cv5 := indicators.Request{Calculation: "cv5", Version: "1", Inputs: map[string]string{"nominal": ids["minimum-nominal"], "basket": ids["cv4"]}}
	commands := indicators.Commands{Pool: pool}
	first, e := commands.Materialize(ctx, []indicators.Request{tr2, cv5})
	if e != nil {
		t.Fatal(e)
	}
	if *first[0].Evaluation.Output.Value != "1650" || *first[1].Evaluation.Output.Value != "110" {
		t.Fatal(first)
	}
	again, e := commands.Materialize(ctx, []indicators.Request{tr2, cv5})
	if e != nil {
		t.Fatal(e)
	}
	if first[0].ID != again[0].ID || !first[0].CalculatedAt.Equal(again[0].CalculatedAt) {
		t.Fatal("replay changed receipt")
	}
	// Concurrent first inserts share an immutable receipt and timestamp.
	concurrentRequest := indicators.Request{Calculation: "price-income", Version: "1", Inputs: map[string]string{"nominal": ids["minimum-nominal"], "basket": ids["cv4"]}}
	var wg sync.WaitGroup
	concurrentResults := make([]indicators.Receipt, 4)
	for i := range 4 {
		wg.Go(func() {
			got, e := commands.Materialize(ctx, []indicators.Request{concurrentRequest})
			if e != nil {
				t.Error(e)
				return
			}
			concurrentResults[i] = got[0]
		})
	}
	wg.Wait()
	for _, got := range concurrentResults {
		if got.ID == "" || got.ID != concurrentResults[0].ID || !got.CalculatedAt.Equal(concurrentResults[0].CalculatedAt) {
			t.Fatal("concurrent receipts differ", concurrentResults)
		}
	}
	value = "1650"
	if _, e := scenario.commands.Run(ctx, "bcb", scenario.window, true); e != nil {
		t.Fatal(e)
	}
	var revised string
	if e = pool.QueryRow(ctx, "SELECT id FROM normalized.observation WHERE series='minimum-nominal' AND value=1650").Scan(&revised); e != nil {
		t.Fatal(e)
	}
	tr2.Inputs["nominal"] = revised
	cv5.Inputs["nominal"] = revised
	updated, e := commands.Materialize(ctx, []indicators.Request{tr2, cv5})
	if e != nil {
		t.Fatal(e)
	}
	if updated[0].ID == first[0].ID || *updated[0].Evaluation.Output.Value != "1815" || updated[1].Evaluation.Output.Value != nil || updated[1].Evaluation.Reason != "published_work_time_mismatch" {
		t.Fatal(updated)
	}
	old, e := (indicators.Queries{Pool: pool}).Get(ctx, first[0].ID)
	if e != nil || *old.Evaluation.Output.Value != "1650" {
		t.Fatal(old, e)
	}
	// Rebase can use prior derived observations without changing their inputs.
	rebase := indicators.Request{Calculation: "rebase", Version: "2", Inputs: map[string]string{"current": updated[0].ID, "base": first[0].ID}}
	derived, e := commands.Materialize(ctx, []indicators.Request{rebase})
	if e != nil || *derived[0].Evaluation.Output.Value != "110" {
		t.Fatal(derived, e)
	}
	// A valid domain incompatibility persists its reason and never a number.
	bad := indicators.Request{Calculation: "tr2", Version: "1", Inputs: map[string]string{"nominal": revised, "current_index": ids["inpc-index2025-12-01"], "base_index": ids["inpc-index2025-12-01"]}}
	blocked, e := commands.Materialize(ctx, []indicators.Request{bad})
	if e != nil || blocked[0].Evaluation.Reason == "" || blocked[0].Evaluation.Output.Value != nil {
		t.Fatal(blocked, e)
	}
	// Missing IDs abort the complete manifest, including preceding new results.
	unique := indicators.Request{Calculation: "price-income", Version: "1", Inputs: map[string]string{"nominal": revised, "basket": ids["cv4"]}}
	missing := indicators.Request{Calculation: "rebase", Version: "2", Inputs: map[string]string{"current": strings.Repeat("a", 64), "base": first[0].ID}}
	var before, after int
	pool.QueryRow(ctx, "SELECT count(*) FROM derived.evaluation").Scan(&before)
	if _, e = commands.Materialize(ctx, []indicators.Request{unique, missing}); e == nil {
		t.Fatal("unaccepted input succeeded")
	}
	pool.QueryRow(ctx, "SELECT count(*) FROM derived.evaluation").Scan(&after)
	if before != after {
		t.Fatal("partial acceptance", before, after)
	}
	var publications int
	pool.QueryRow(ctx, "SELECT count(*) FROM information_schema.tables WHERE table_schema='published'").Scan(&publications)
	if publications != 0 {
		t.Fatal("public projection changed")
	}
	// Check exact request/input provenance is recoverable from storage.
	var count int
	pool.QueryRow(ctx, "SELECT count(*) FROM derived.input WHERE evaluation=$1", first[0].ID).Scan(&count)
	if count != 3 {
		t.Fatal(count)
	}
	bytes, _ := json.Marshal(old)
	if !strings.Contains(string(bytes), ids["minimum-nominal"]) {
		t.Fatal("missing input lineage")
	}
	// Exercise the actual Node wrapper, relative manifest path, Go CLI and reads,
	// with object-store configuration deliberately unavailable.
	databaseURL, e := url.Parse(os.Getenv("TEST_DATABASE_URL"))
	if e != nil {
		t.Fatal(e)
	}
	databaseURL.Path = "/" + pool.Config().ConnConfig.Database
	t.Setenv("DATABASE_URL", databaseURL.String())
	t.Setenv("RAW_BUCKET", "")
	t.Setenv("S3_ENDPOINT_URL", "")
	manifestPath := filepath.Join(t.TempDir(), "calculations.json")
	manifestJSON, e := json.Marshal([]indicators.Request{rebase})
	if e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(manifestPath, manifestJSON, 0600); e != nil {
		t.Fatal(e)
	}
	root, e := filepath.Abs("../..")
	if e != nil {
		t.Fatal(e)
	}
	relative, e := filepath.Rel(root, manifestPath)
	if e != nil {
		t.Fatal(e)
	}
	cli := exec.Command("node", "backend/scripts/run.mjs", "calculate", "--manifest", relative)
	cli.Dir = root
	output, e := cli.CombinedOutput()
	if e != nil {
		t.Fatalf("CLI: %s: %s", e, output)
	}
	var cliReceipts []indicators.Receipt
	if e = json.Unmarshal(output, &cliReceipts); e != nil || len(cliReceipts) != 1 || cliReceipts[0].ID != derived[0].ID {
		t.Fatalf("CLI receipt: %s %v", output, e)
	}
	cli = exec.Command("node", "backend/scripts/run.mjs", "calculation", "--id", derived[0].ID)
	cli.Dir = root
	output, e = cli.CombinedOutput()
	if e != nil {
		t.Fatalf("CLI read: %s: %s", e, output)
	}
	var cliReceipt indicators.Receipt
	if e = json.Unmarshal(output, &cliReceipt); e != nil || cliReceipt.ID != derived[0].ID {
		t.Fatalf("CLI read receipt: %s %v", output, e)
	}

}

func TestEngineMigrationUpgradePreservesAcceptedData(t *testing.T) {
	pool, store := setup(t)
	s := newScenario(pool, store)
	s.run(t)
	// Recreate the pre-engine schema inside this test's disposable database.
	if _, e := pool.Exec(ctx, "DROP TABLE derived.input; DROP TABLE derived.evaluation; DELETE FROM ops.migration WHERE id='002'"); e != nil {
		t.Fatal(e)
	}
	var before, after int
	if e := pool.QueryRow(ctx, "SELECT count(*) FROM normalized.observation").Scan(&before); e != nil {
		t.Fatal(e)
	}
	for range 2 {
		if e := postgres.Migrate(ctx, pool); e != nil {
			t.Fatal(e)
		}
	}
	if e := pool.QueryRow(ctx, "SELECT count(*) FROM normalized.observation").Scan(&after); e != nil {
		t.Fatal(e)
	}
	if before == 0 || before != after {
		t.Fatal(before, after)
	}
	var migrations int
	if e := pool.QueryRow(ctx, "SELECT count(*) FROM ops.migration").Scan(&migrations); e != nil || migrations != 2 {
		t.Fatal(migrations, e)
	}
	if _, e := pool.Exec(ctx, "UPDATE ops.migration SET sha256='changed' WHERE id='002'"); e != nil {
		t.Fatal(e)
	}
	if e := postgres.Migrate(ctx, pool); e == nil {
		t.Fatal("engine migration checksum not enforced")
	}
}

func TestEngineMonthlyRatesAndIntervalComparisons(t *testing.T) {
	pool, store := setup(t)
	s := newScenario(pool, store)
	s.window, _ = period.NewWindow("2024-01-01", "2025-02-28", time.Now())
	for _, source := range []string{"ibge", "bcb"} {
		s.commands.Sources[source] = func(ctx context.Context, f ingestion.Fetcher, w period.Window) ([]observations.Observation, error) {
			body, e := f.Get(ctx, "https://api.bcb.gov.br/dados/serie/bcdata.sgs.29265/dados")
			if e != nil {
				return nil, e
			}
			var rows []observations.Observation
			for _, item := range []struct{ series, date, value string }{
				{"cv1-monthly", "2024-01-01", "1"}, {"cv1-monthly", "2024-02-01", "2"},
				{"cv1-monthly", "2025-01-01", "2"}, {"cv1-monthly", "2025-02-01", "3"},
				{"vf2", "2025-01-01", "3"}, {"vf2", "2025-02-01", "3"},
			} {
				spec := catalog.ByID[item.series]
				if spec.Source != source {
					continue
				}
				date, _ := period.Date(item.date)
				start, end := period.Month(date.Year(), date.Month())
				o, e := observations.New(spec, start, end, item.value, item.series, nil, "BR", []string{canonical.Hash(body)})
				if e != nil {
					return nil, e
				}
				rows = append(rows, o)
			}
			return rows, nil
		}
		if _, e := s.commands.Run(ctx, source, s.window, true); e != nil {
			t.Fatal(e)
		}
	}
	commands := indicators.Commands{Pool: pool}
	materialize := func(calculation string, inputs map[string]string) indicators.Receipt {
		t.Helper()
		got, e := commands.Materialize(ctx, []indicators.Request{{Calculation: calculation, Version: "2", Inputs: inputs}})
		if e != nil || len(got) != 1 {
			t.Fatalf("materialization failed: %v %v", got, e)
		}
		return got[0]
	}
	monthlyIDs := func(series, year string) map[string]string {
		t.Helper()
		ids := map[string]string{}
		for _, month := range []string{"01", "02"} {
			var id string
			if e := pool.QueryRow(ctx, "SELECT id FROM normalized.observation WHERE series=$1 AND start_date=$2::date", series, year+"-"+month+"-01").Scan(&id); e != nil {
				t.Fatal(e)
			}
			ids["month:"+year+"-"+month] = id
		}
		return ids
	}
	previous := materialize("compound-change", monthlyIDs("cv1-monthly", "2024"))
	current := materialize("compound-change", monthlyIDs("cv1-monthly", "2025"))
	blocked := materialize("compound-change", monthlyIDs("vf2", "2025"))
	if blocked.Evaluation.Output.Value != nil || blocked.Evaluation.Reason != "incompatible_monthly_rate" {
		t.Fatal("persisted compounded delinquency levels", blocked)
	}
	for _, tt := range []struct{ calculation, other, want string }{
		{"difference", "previous", "2.04"},
		{"relative-change", "previous", "67.549668874172"},
		{"rebase", "base", "167.549668874172"},
	} {
		inputs := map[string]string{"current": current.ID, tt.other: previous.ID}
		first := materialize(tt.calculation, inputs)
		again := materialize(tt.calculation, inputs)
		if first.Evaluation.Output.Value == nil || *first.Evaluation.Output.Value != tt.want || first.ID != again.ID || !first.CalculatedAt.Equal(again.CalculatedAt) {
			t.Fatal("incorrect interval comparison or replay", first, again)
		}
		// JSON from PostgreSQL decodes window_months as float64, not Go int.
		read, e := (indicators.Queries{Pool: pool}).Get(ctx, first.ID)
		if e != nil || read.Evaluation.Output.Context["window_months"] != float64(2) {
			t.Fatal("lost persisted window", read, e)
		}
		nested := materialize("rebase", map[string]string{"current": first.ID, "base": first.ID})
		if nested.Evaluation.Output.Value == nil || *nested.Evaluation.Output.Value != "100" {
			t.Fatal("persisted comparison cannot feed another calculation", nested)
		}
	}
}
