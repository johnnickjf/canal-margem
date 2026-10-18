package indicators

import (
	"encoding/json"
	"margem/backend/internal/observations"
	"os"
	"testing"
)

// The committed sample comes from the preserved phase-7 normalization corpus.
// ENGINE_CORPUS optionally verifies the complete local capture without fetching.
func TestRecordedOfficialInputs(t *testing.T) {
	path := os.Getenv("ENGINE_CORPUS")
	if path == "" {
		path = "testdata/official-inputs.json"
	}
	body, e := os.ReadFile(path)
	if e != nil {
		t.Fatal(e)
	}
	var rows []Input
	if e = json.Unmarshal(body, &rows); e != nil {
		t.Fatal(e)
	}
	var originals []observations.Observation
	if e = json.Unmarshal(body, &originals); e != nil {
		t.Fatal(e)
	}
	byKey := map[string]Input{}
	for i, x := range rows {
		id, e := originals[i].ID()
		if e != nil || id != x.ID {
			t.Fatal("fixture identity changed", x.ID, id, e)
		}
		byKey[x.Series+"/"+x.Start+"/"+x.Geography] = x
	}
	tr2, cv5, blocked := 0, 0, 0
	knownIncompatible := map[string]bool{
		"014c28d67bfe96fd6f1bb2ef81c6d51eebf2a824c357c7d05cbe15fb25e8edd5": true,
		"0dd7b588cb54ae790b96ea8d0e1673f174a4701eb84eca346098808fbad2a472": true,
		"0ea3439ecc99433bdbbedf6717ee3e9ccdd10c71b77bb771b723cfbc49a3afa7": true,
		"361c73d17f2aadb6dc33cb92ad896dba8f2717149b2202304b0f930cbeb4ef33": true,
		"92faf9e413c2e15bc1f88c0bc4245911be30aa82d9733226f52c63002041cac2": true,
		"c44e7e581bced40b6a1b4dba2a1966516aa7232c180ff3e7b67e6870894ecd90": true,
	}
	for _, x := range rows {
		n, ok := byKey["minimum-nominal/"+x.Start+"/BR"]
		if !ok {
			continue
		}
		if x.Series == "inpc-index" {
			base, ok := byKey["inpc-index/2025-12-01/BR"]
			if !ok {
				continue
			}
			ev := evaluate(t, "tr2", map[string]Input{"nominal": n, "current_index": x, "base_index": base})
			if ev.Reason != "" {
				t.Fatal(ev)
			}
			tr2++
		}
		if x.Series == "cv4" && x.Status == "observed" {
			ev := evaluate(t, "cv5", map[string]Input{"nominal": n, "basket": x})
			if ev.Reason != "" {
				if ev.Reason != "published_work_time_mismatch" || !knownIncompatible[x.ID] || ev.Output.Value != nil {
					t.Fatal(ev)
				}
				blocked++
				continue
			}
			cv5++
		}
	}
	if tr2 == 0 || cv5 == 0 {
		t.Fatal("no matched official inputs", tr2, cv5)
	}
	t.Logf("TR2=%d CV5=%d blocked-incompatible=%d", tr2, cv5, blocked)
}
