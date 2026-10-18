package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"margem/backend/internal/catalog"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type replay struct {
	root string
	urls map[string]string
}

func normalizedURL(s string) string {
	u, e := url.Parse(s)
	if e != nil {
		return s
	}
	u.RawQuery = u.Query().Encode()
	return u.String()
}
func (f replay) Get(_ context.Context, u string) ([]byte, error) {
	sha := f.urls[normalizedURL(u)]
	if sha == "" {
		return nil, fmt.Errorf("URL ausente no corpus: %s", u)
	}
	b, e := os.ReadFile(filepath.Join(f.root, "raw", sha))
	if e == nil && canonical.Hash(b) != sha {
		return nil, fmt.Errorf("corpus corrompido: %s", sha)
	}
	return b, e
}
func TestMigrationOfficialCorpus(t *testing.T) {
	root := os.Getenv("MIGRATION_CORPUS")
	if root == "" {
		t.Skip("defina MIGRATION_CORPUS para comparar os originais e IDs Python")
	}
	b, e := os.ReadFile(filepath.Join(root, "urls.json"))
	if e != nil {
		t.Fatal(e)
	}
	var entries []struct {
		URL, SHA256 string
		Headers     map[string]string
		Status      int
	}
	if e = json.Unmarshal(b, &entries); e != nil {
		t.Fatal(e)
	}
	f := replay{root, map[string]string{}}
	for _, x := range entries {
		if x.Status >= 200 && x.Status < 300 {
			f.urls[normalizedURL(x.URL)] = x.SHA256
		}
	}
	for _, x := range entries {
		if x.Status >= 300 && x.Status < 400 {
			u, _ := url.Parse(x.URL)
			target, e := url.Parse(x.Headers["location"])
			if e == nil {
				dest := u.ResolveReference(target).String()
				for range 6 {
					if sha := f.urls[normalizedURL(dest)]; sha != "" {
						f.urls[normalizedURL(x.URL)] = sha
						break
					}
					found := false
					for _, next := range entries {
						if normalizedURL(next.URL) == normalizedURL(dest) && next.Status >= 300 && next.Status < 400 {
							base, _ := url.Parse(dest)
							loc, _ := url.Parse(next.Headers["location"])
							dest = base.ResolveReference(loc).String()
							found = true
							break
						}
					}
					if !found {
						break
					}
				}
			}
		}
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
	counts := map[string]int{}
	for _, o := range expected {
		ids[o.ID] = true
		counts[catalog.ByID[o.Series].Source]++
	}
	w, e := period.NewWindow("2012-01-01", "2026-10-17", time.Now())
	if e != nil {
		t.Fatal(e)
	}
	for _, source := range catalog.Sources {
		t.Run(source, func(t *testing.T) {
			rows, e := Sources[source](context.Background(), f, w)
			if e != nil {
				t.Fatal(e)
			}
			if e = observations.Validate(rows); e != nil {
				t.Fatal(e)
			}
			if len(rows) != counts[source] {
				t.Fatalf("observações: %d; Python: %d", len(rows), counts[source])
			}
			for _, o := range rows {
				id, e := o.ID()
				if e != nil {
					t.Fatal(e)
				}
				if !ids[id] {
					j, _ := canonical.Bytes(o)
					t.Fatalf("ID divergente %s: %s", id, j)
				}
			}
			t.Logf("%d observações idênticas ao Python", len(rows))
		})
	}
}
