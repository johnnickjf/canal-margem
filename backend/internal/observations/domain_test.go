package observations

import (
	"margem/backend/internal/catalog"
	"margem/backend/internal/period"
	"testing"
	"time"
)

func TestCanonicalDecimalAndRejections(t *testing.T) {
	for input, want := range map[string]string{"-0.0100": "-0.01", "-0.000": "0", "00021.10": "21.1", "0": "0", "3587776.79721440001": "3587776.79721440001"} {
		got, e := Decimal(input, false)
		if e != nil || got != want {
			t.Errorf("%q: %q %v", input, got, e)
		}
	}
	for _, input := range []string{"NaN", "Infinity", "1e3", "", " ", "<html>", "1,23"} {
		if _, e := Decimal(input, false); e == nil {
			t.Errorf("aceitou %q", input)
		}
	}
}
func TestMissingZeroDomainAndIdentity(t *testing.T) {
	start, end, _ := period.Code("202501", "quarterly")
	spec := catalog.ByID["tr4"]
	for _, item := range []struct {
		value, status string
		nilValue      bool
	}{{"...", "missing", true}, {"..", "not_applicable", true}, {"X", "suppressed", true}, {"-", "observed", false}, {"0", "observed", false}} {
		o, e := New(spec, start, end, item.value, "x", nil, "BR", []string{"raw"})
		if e != nil || o.Status != item.status || (o.Value == nil) != item.nilValue {
			t.Fatal(o, e)
		}
	}
	o, _ := New(spec, start, end, "0", "x", nil, "BR", []string{"raw"})
	id, _ := o.ID()
	o.Artifacts = []string{"new-raw"}
	again, _ := o.ID()
	if id != again {
		t.Fatal("raw mudou identidade normalizada")
	}
	o.Context["method"] = "new"
	different, _ := o.ID()
	if id == different {
		t.Fatal("método não mudou identidade")
	}
	if e := Validate([]Observation{o, o}); e == nil {
		t.Fatal("duplicata aceita")
	}
	if _, e := New(spec, start, end, "-1", "x", nil, "BR", nil); e == nil {
		t.Fatal("valor fora do mínimo")
	}
	inflation := catalog.ByID["cv1-monthly"]
	if _, e := New(inflation, start, end, "-0.1", "x", nil, "BR", nil); e != nil {
		t.Fatal(e)
	}
	if _, e := New(inflation, start, end, "-100.01", "x", nil, "BR", nil); e == nil {
		t.Fatal("percentual inválido")
	}
}
func TestWindowBounds(t *testing.T) {
	now := time.Date(2026, 10, 17, 0, 0, 0, 0, time.UTC)
	for _, dates := range [][2]string{{"2011-01-01", "2025-01-01"}, {"2025-02-01", "2025-01-01"}, {"2025-01-01", "2026-10-18"}} {
		if _, e := period.NewWindow(dates[0], dates[1], now); e == nil {
			t.Fatal(dates)
		}
	}
	for _, c := range []string{"", "202505", "xxxx01", "202500"} {
		if _, _, e := period.Code(c, "quarterly"); e == nil {
			t.Fatal(c)
		}
	}
	_, end, e := period.Code("202402", "monthly")
	if e != nil || end.Format(period.Layout) != "2024-02-29" {
		t.Fatal(end, e)
	}
}
