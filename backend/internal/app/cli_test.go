package app

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCalculateReportsManifestValidationErrors(t *testing.T) {
	t.Setenv("DATABASE_URL", "invalid-database-url")
	for _, tt := range []struct{ name, body, want string }{
		{"version", `[{"calculation":"cv5","version":"2","inputs":{}}]`, "cálculo/versão desconhecido: cv5/2"},
		{"roles", `[{"calculation":"cv5","version":"1","inputs":{}}]`, "papéis de entrada inválidos"},
		{"id", `[{"calculation":"cv5","version":"1","inputs":{"basket":"invalid","nominal":"invalid"}}]`, "ID de input inválido"},
		{"parameter", `[{"calculation":"cv5","version":"1","inputs":{},"hours":200}]`, "parâmetro desconhecido: hours"},
		{"json", `[{`, "unexpected EOF"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "manifest.json")
			if e := os.WriteFile(path, []byte(tt.body), 0600); e != nil {
				t.Fatal(e)
			}
			var out, stderr bytes.Buffer
			if exit := Run(context.Background(), []string{"calculate", "--manifest", path}, &out, &stderr); exit != 1 {
				t.Fatalf("exit=%d stderr=%s", exit, stderr.String())
			}
			var failure struct{ Status, Error string }
			if e := json.Unmarshal(stderr.Bytes(), &failure); e != nil {
				t.Fatal(e)
			}
			if failure.Status != "failed" || !strings.Contains(failure.Error, tt.want) || out.Len() != 0 {
				t.Fatalf("stdout=%s failure=%+v", out.String(), failure)
			}
		})
	}
}

func TestHelpAndInvalidArgumentsNeedNoServices(t *testing.T) {
	for _, args := range [][]string{{"--help"}, {"run", "--help"}, {"tick", "--help"}, {"formulas"}, {"calculate", "--help"}, {"calculation", "--help"}} {
		var out, err bytes.Buffer
		if exit := Run(context.Background(), args, &out, &err); exit != 0 {
			t.Fatal(args, exit, err.String())
		}
	}
	for _, args := range [][]string{{"calculate"}, {"calculation"}, {"unknown"}, {"run"}, {"import-poc"}, {"migrate", "extra"}, {"tick", "--unknown"}} {
		var out, err bytes.Buffer
		if exit := Run(context.Background(), args, &out, &err); exit != 2 {
			t.Fatal(args, exit)
		}
	}
	var out, err bytes.Buffer
	Run(context.Background(), []string{"--help"}, &out, &err)
	if !strings.Contains(out.String(), "import-poc") {
		t.Fatal(out.String())
	}
}
