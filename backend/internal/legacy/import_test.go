package legacy

import (
	"margem/backend/internal/platform/canonical"
	"os"
	"testing"
)

func TestOfficialArchiveIdentity(t *testing.T) {
	root := os.Getenv("MIGRATION_POC")
	if root == "" {
		t.Skip("defina MIGRATION_POC para comparar o arquivo original")
	}
	inv, e := Inspect(root)
	if e != nil {
		t.Fatal(e)
	}
	id, e := canonical.Digest(inv.Manifest)
	if e != nil || id != "83ce402e5237bd181870ccbc9dbbd60864903d328a7a49cebdfd943e24eecaec" || len(inv.Files) != 21 || len(inv.Observations) != 587 {
		t.Fatal(id, len(inv.Files), len(inv.Observations), e)
	}
}
