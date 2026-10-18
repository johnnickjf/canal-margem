package app

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestHelpAndInvalidArgumentsNeedNoServices(t *testing.T) {
	for _, args := range [][]string{{"--help"}, {"run", "--help"}, {"tick", "--help"}} {
		var out, err bytes.Buffer
		if exit := Run(context.Background(), args, &out, &err); exit != 0 {
			t.Fatal(args, exit, err.String())
		}
	}
	for _, args := range [][]string{{"unknown"}, {"run"}, {"import-poc"}, {"migrate", "extra"}, {"tick", "--unknown"}} {
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
