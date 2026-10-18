package indicators

import (
	"margem/backend/internal/catalog"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"strings"
	"testing"
)

func input(series, date, value string) Input {
	spec := catalog.ByID[series]
	s, _ := period.Date(date)
	a, b := period.Month(s.Year(), s.Month())
	x := Input{Series: series, Start: a.Format(period.Layout), End: b.Format(period.Layout), Geography: "BR", Status: "observed", Value: &value, Context: map[string]any{"unit": spec.Unit, "method": spec.Method, "frequency": spec.Frequency, "temporal_basis": spec.TemporalBasis}}
	if series == "cv4" {
		x.Geography = "BR-city-3550308"
		x.Context["composition"] = "regional"
		x.Context["method_segment"] = "partnership-2025"
	}
	x.ID, _ = canonical.Digest(x)
	return x
}
func evaluate(t *testing.T, calc string, inputs map[string]Input) Evaluation {
	t.Helper()
	version := ""
	for _, d := range Definitions() {
		if d.ID == calc {
			version = d.Version
		}
	}
	r := Request{calc, version, map[string]string{}}
	for role, x := range inputs {
		r.Inputs[role] = x.ID
	}
	ev, e := Evaluate(r, inputs)
	if e != nil {
		t.Fatal(e)
	}
	return ev
}
func TestMVPAndOperations(t *testing.T) {
	tests := []struct {
		calc   string
		inputs map[string]Input
		want   string
	}{
		{"tr2", map[string]Input{"nominal": input("minimum-nominal", "2025-01-01", "1518"), "current_index": input("inpc-index", "2025-01-01", "100"), "base_index": input("inpc-index", "2025-12-01", "110")}, "1669.8"},
		{"cv5", map[string]Input{"basket": input("cv4", "2025-01-01", "750"), "nominal": input("minimum-nominal", "2025-01-01", "1500")}, "110"},
		{"cv5", map[string]Input{"basket": input("cv4", "2025-01-01", "0"), "nominal": input("minimum-nominal", "2025-01-01", "1500")}, "0"},
		{"price-income", map[string]Input{"basket": input("cv4", "2025-01-01", "750"), "nominal": input("minimum-nominal", "2025-01-01", "1500")}, "50"},
		{"relative-change", map[string]Input{"current": input("minimum-nominal", "2025-02-01", "1100"), "previous": input("minimum-nominal", "2025-01-01", "1000")}, "10"},
		{"difference", map[string]Input{"current": input("vf1", "2025-02-01", "23"), "previous": input("vf1", "2025-01-01", "25")}, "-2"},
		{"rebase", map[string]Input{"current": input("minimum-nominal", "2025-02-01", "1100"), "base": input("minimum-nominal", "2025-01-01", "1000")}, "110"},
		{"compound-change", map[string]Input{"month:2025-01": input("cv1-monthly", "2025-01-01", "10"), "month:2025-02": input("cv1-monthly", "2025-02-01", "10")}, "21"},
		{"compound-change", map[string]Input{"month:2025-01": input("cv1-monthly", "2025-01-01", "-100"), "month:2025-02": input("cv1-monthly", "2025-02-01", "10")}, "-100"},
	}
	for _, tt := range tests {
		t.Run(tt.calc+tt.want, func(t *testing.T) {
			ev := evaluate(t, tt.calc, tt.inputs)
			if ev.Reason != "" || ev.Output.Value == nil || *ev.Output.Value != tt.want {
				t.Fatalf("%+v", ev)
			}
			if tt.calc == "difference" && ev.Output.Context["unit"] != "percentage_points" {
				t.Fatal(ev.Output)
			}
		})
	}
}
func TestInvalidInputsNeverBecomeNumbers(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]Input)
	}{
		{"zero denominator", func(m map[string]Input) { m["nominal"] = input("minimum-nominal", "2025-01-01", "0") }},
		{"negative price", func(m map[string]Input) { m["basket"] = input("cv4", "2025-01-01", "-1") }},
		{"different month", func(m map[string]Input) { m["nominal"] = input("minimum-nominal", "2025-02-01", "1500") }},
		{"wrong unit", func(m map[string]Input) { m["basket"].Context["unit"] = "USD/basket" }},
		{"wrong method", func(m map[string]Input) { m["basket"].Context["method"] = "different" }},
		{"wrong territory", func(m map[string]Input) { x := m["nominal"]; x.Geography = "BR-city-3550308"; m["nominal"] = x }},
		{"partial month", func(m map[string]Input) { x := m["basket"]; x.End = "2025-01-15"; m["basket"] = x }},
		{"suppressed", func(m map[string]Input) { x := m["basket"]; x.Status = "suppressed"; x.Value = nil; m["basket"] = x }},
		{"missing", func(m map[string]Input) { x := m["basket"]; x.Status = "missing"; x.Value = nil; m["basket"] = x }},
		{"not applicable", func(m map[string]Input) {
			x := m["basket"]
			x.Status = "not_applicable"
			x.Value = nil
			m["basket"] = x
		}},
		{"NaN", func(m map[string]Input) { m["basket"] = input("cv4", "2025-01-01", "NaN") }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := map[string]Input{"basket": input("cv4", "2025-01-01", "750"), "nominal": input("minimum-nominal", "2025-01-01", "1500")}
			tt.mutate(m)
			ev := evaluate(t, "cv5", m)
			if ev.Reason == "" || ev.Output.Value != nil {
				t.Fatal(ev)
			}
		})
	}
}
func TestComparisonAndCompoundingBoundaries(t *testing.T) {
	for _, kind := range []string{"gap", "12m", "different series", "segment", "base", "partial"} {
		t.Run(kind, func(t *testing.T) {
			m := map[string]Input{"month:2025-01": input("cv1-monthly", "2025-01-01", "1"), "month:2025-02": input("cv1-monthly", "2025-02-01", "2")}
			switch kind {
			case "gap":
				delete(m, "month:2025-02")
				m["month:2025-03"] = input("cv1-monthly", "2025-03-01", "2")
			case "12m":
				m["month:2025-01"] = input("cv1-12m", "2025-01-01", "1")
				m["month:2025-02"] = input("cv1-12m", "2025-02-01", "2")
			case "different series":
				m["month:2025-02"] = input("inpc-monthly", "2025-02-01", "2")
			case "segment":
				m["month:2025-02"].Context["method_segment"] = "new"
			case "base":
				m["month:2025-02"].Context["monetary_base"] = "new"
			case "partial":
				x := m["month:2025-02"]
				x.End = "2025-02-15"
				m["month:2025-02"] = x
			}
			ev := evaluate(t, "compound-change", m)
			if ev.Reason == "" {
				t.Fatal(ev)
			}
		})
	}
	m := map[string]Input{"current": input("minimum-nominal", "2025-01-01", "1100"), "previous": input("minimum-nominal", "2025-02-01", "1000")}
	if ev := evaluate(t, "difference", m); ev.Reason == "" {
		t.Fatal(ev)
	}
	m["previous"] = input("minimum-nominal", "2025-01-01", "1000")
	if ev := evaluate(t, "difference", m); ev.Reason == "" {
		t.Fatal(ev)
	}
}
func TestTR2BaseAndUnresolvedMonetaryBasis(t *testing.T) {
	m := map[string]Input{"nominal": input("minimum-nominal", "2025-01-01", "1518"), "current_index": input("inpc-index", "2025-01-01", "100"), "base_index": input("inpc-index", "2025-11-01", "110")}
	if ev := evaluate(t, "tr2", m); ev.Reason == "" {
		t.Fatal(ev)
	}
	m["base_index"] = input("inpc-index", "2025-12-01", "0")
	if ev := evaluate(t, "tr2", m); ev.Reason == "" {
		t.Fatal(ev)
	}
	a, b := input("tr1", "2025-01-01", "3000"), input("tr1", "2025-02-01", "3100")
	a.Context["monetary_base"] = "release-base-unresolved-block-publication"
	if ev := evaluate(t, "relative-change", map[string]Input{"previous": a, "current": b}); !strings.Contains(ev.Reason, "unresolved") {
		t.Fatal(ev)
	}
}
func TestExactRoundingAndDIEESEConfrontation(t *testing.T) {
	for _, tt := range []struct{ cost, want string }{{"0.0000000000005", "0"}, {"0.0000000000015", "0.000000000002"}, {"1", "0.333333333333"}} {
		ev := evaluate(t, "cv5", map[string]Input{"basket": input("cv4", "2025-01-01", tt.cost), "nominal": input("minimum-nominal", "2025-01-01", "660")})
		// First two cases use denominator 220 to exercise ties exactly.
		if tt.cost != "1" {
			ev = evaluate(t, "cv5", map[string]Input{"basket": input("cv4", "2025-01-01", tt.cost), "nominal": input("minimum-nominal", "2025-01-01", "220")})
		}
		if *ev.Output.Value != tt.want {
			t.Fatal(*ev.Output.Value, tt.want)
		}
	}
	b := input("cv4", "2025-01-01", "750")
	b.Context["published_work_time"] = "110h00m"
	ev := evaluate(t, "cv5", map[string]Input{"basket": b, "nominal": input("minimum-nominal", "2025-01-01", "1500")})
	if ev.Warnings[1] != "published_work_time_within_one_minute" {
		t.Fatal(ev)
	}
	b.Context["published_work_time"] = "111h00m"
	ev = evaluate(t, "cv5", map[string]Input{"basket": b, "nominal": input("minimum-nominal", "2025-01-01", "1500")})
	if ev.Reason != "published_work_time_mismatch" || ev.Output.Value != nil {
		t.Fatal(ev)
	}
}
func TestRequestValidation(t *testing.T) {
	for _, body := range []string{`[]`, `null`, `[{"calculation":"cv5","version":"2","inputs":{}}]`, `[{"calculation":"cv5","version":"1","inputs":{},"hours":200}]`, `[] []`} {
		if _, e := DecodeManifest([]byte(body)); e == nil {
			t.Fatal(body)
		}
	}
}

func TestComparisonHorizonCannotBecomeMonthlyInflation(t *testing.T) {
	current := input("minimum-nominal", "2025-02-01", "1100")
	monthly := evaluate(t, "relative-change", map[string]Input{"current": current, "previous": input("minimum-nominal", "2025-01-01", "1000")})
	annual := evaluate(t, "relative-change", map[string]Input{"current": current, "previous": input("minimum-nominal", "2024-02-01", "1000")})
	if monthly.Output.Series == annual.Output.Series {
		t.Fatal("different comparison horizons share series")
	}
	output := annual.Output
	output.ID = strings.Repeat("a", 64)
	ev := evaluate(t, "compound-change", map[string]Input{"month:2025-02": output})
	if ev.Reason != "incompatible_monthly_rate" || ev.Output.Value != nil {
		t.Fatal("compounded annual comparison as monthly inflation", ev)
	}
	next := evaluate(t, "relative-change", map[string]Input{"current": input("minimum-nominal", "2025-03-01", "1200"), "previous": current})
	if next.Output.Series != monthly.Output.Series {
		t.Fatal("same monthly comparison method changed series")
	}
}

func TestCompoundSeriesUsesWindowInsteadOfCalendarDates(t *testing.T) {
	jan := input("cv1-monthly", "2025-01-01", "1")
	feb := input("cv1-monthly", "2025-02-01", "2")
	mar := input("cv1-monthly", "2025-03-01", "3")
	first := evaluate(t, "compound-change", map[string]Input{"month:2025-01": jan, "month:2025-02": feb})
	next := evaluate(t, "compound-change", map[string]Input{"month:2025-02": feb, "month:2025-03": mar})
	longer := evaluate(t, "compound-change", map[string]Input{"month:2025-01": jan, "month:2025-02": feb, "month:2025-03": mar})
	revised := evaluate(t, "compound-change", map[string]Input{"month:2025-01": input("cv1-monthly", "2025-01-01", "4"), "month:2025-02": feb})
	other := evaluate(t, "compound-change", map[string]Input{"month:2025-01": input("inpc-monthly", "2025-01-01", "1"), "month:2025-02": input("inpc-monthly", "2025-02-01", "2")})
	for _, ev := range []Evaluation{first, next, longer, revised, other} {
		if ev.Reason != "" || ev.Output.Value == nil {
			t.Fatal(ev)
		}
	}
	if first.Output.Series != next.Output.Series || first.Output.Series != revised.Output.Series {
		t.Fatal("calendar dates or revisions changed the series")
	}
	if first.Output.Series == longer.Output.Series || first.Output.Series == other.Output.Series {
		t.Fatal("different windows or source series share an identity")
	}
	if first.Output.Start != "2025-01-01" || first.Output.End != "2025-02-28" || next.Output.Start != "2025-02-01" || next.Output.End != "2025-03-31" {
		t.Fatal("evaluation lost its explicit period", first, next)
	}
}

func TestCompoundRejectsNonChangePercentages(t *testing.T) {
	for _, series := range []string{"vf1", "vf2"} {
		t.Run(series, func(t *testing.T) {
			ev := evaluate(t, "compound-change", map[string]Input{
				"month:2025-01": input(series, "2025-01-01", "3"),
				"month:2025-02": input(series, "2025-02-01", "3"),
			})
			if ev.Output.Value != nil || ev.Reason != "incompatible_monthly_rate" {
				t.Fatal("compounded percentage levels", ev)
			}
		})
	}
	shares := map[string]Input{}
	for _, date := range []string{"2025-01-01", "2025-02-01"} {
		x := evaluate(t, "price-income", map[string]Input{
			"basket": input("cv4", date, "750"), "nominal": input("minimum-nominal", date, "1500"),
		}).Output
		x.ID, _ = canonical.Digest(x)
		shares["month:"+date[:7]] = x
	}
	if ev := evaluate(t, "compound-change", shares); ev.Output.Value != nil || ev.Reason != "incompatible_monthly_rate" {
		t.Fatal("compounded basket/income shares", ev)
	}
	for _, series := range []string{"cv1-monthly", "cv2-old-monthly", "cv2-current-monthly", "inpc-monthly"} {
		ev := evaluate(t, "compound-change", map[string]Input{
			"month:2025-01": input(series, "2025-01-01", "1"),
			"month:2025-02": input(series, "2025-02-01", "2"),
		})
		if ev.Output.Value == nil || *ev.Output.Value != "3.02" {
			t.Fatal("rejected a monthly price change", series, ev)
		}
	}
}

func accumulated(t *testing.T, year, january, february string) Input {
	t.Helper()
	x := evaluate(t, "compound-change", map[string]Input{
		"month:" + year + "-01": input("cv1-monthly", year+"-01-01", january),
		"month:" + year + "-02": input("cv1-monthly", year+"-02-01", february),
	}).Output
	if x.Value == nil {
		t.Fatal("accumulation failed", x)
	}
	x.ID, _ = canonical.Digest(x)
	return x
}

func TestAccumulatedComparisons(t *testing.T) {
	previous, current := accumulated(t, "2024", "1", "2"), accumulated(t, "2025", "2", "3")
	for _, tt := range []struct{ calculation, other, want, unit string }{
		{"difference", "previous", "2.04", "percentage_points"},
		{"relative-change", "previous", "67.549668874172", "%"},
		{"rebase", "base", "167.549668874172", "index"},
	} {
		t.Run(tt.calculation, func(t *testing.T) {
			ev := evaluate(t, tt.calculation, map[string]Input{"current": current, tt.other: previous})
			if ev.Output.Value == nil || *ev.Output.Value != tt.want || ev.Output.Context["unit"] != tt.unit || ev.Output.Context["window_months"] != 2 {
				t.Fatal(ev)
			}
		})
	}
	for _, kind := range []string{"partial start", "partial end", "wrong duration", "fractional duration", "missing duration", "different duration", "different geography", "overlap"} {
		t.Run(kind, func(t *testing.T) {
			p, c := accumulated(t, "2024", "1", "2"), accumulated(t, "2025", "2", "3")
			switch kind {
			case "partial start":
				c.Start = "2025-01-02"
			case "partial end":
				c.End = "2025-02-27"
			case "wrong duration":
				c.Context["window_months"] = 3
			case "fractional duration":
				c.Context["window_months"] = 2.5
			case "missing duration":
				delete(c.Context, "window_months")
			case "different duration":
				c.End, c.Context["window_months"] = "2025-03-31", 3
			case "different geography":
				c.Geography = "BR-city-3550308"
			case "overlap":
				c.Start, c.End = "2024-02-01", "2024-03-31"
			}
			if ev := evaluate(t, "difference", map[string]Input{"current": c, "previous": p}); ev.Output.Value != nil || ev.Reason != "not_comparable" {
				t.Fatal(ev)
			}
		})
	}
	// A second operation must retain the window after JSON persistence and keep
	// identical series identities across successive years and leap-year February.
	first := evaluate(t, "difference", map[string]Input{"current": current, "previous": previous}).Output
	first.ID, _ = canonical.Digest(first)
	next := evaluate(t, "difference", map[string]Input{"current": accumulated(t, "2026", "3", "4"), "previous": current}).Output
	next.ID, _ = canonical.Digest(next)
	if first.Series != next.Series {
		t.Fatal("successive comparisons changed the series", first, next)
	}
	chained := evaluate(t, "difference", map[string]Input{"current": next, "previous": first})
	if chained.Output.Value == nil || *chained.Output.Value != "0.02" || chained.Output.Context["window_months"] != 2 {
		t.Fatal("lost calendar window in a chained comparison", chained)
	}
}

func TestCorrectedCalculationsRequireVersionTwo(t *testing.T) {
	for _, calculation := range []string{"compound-change", "difference", "relative-change", "rebase"} {
		if _, e := lookup(calculation, "1"); e == nil {
			t.Fatal("obsolete calculation version still executable", calculation)
		}
		if _, e := lookup(calculation, "2"); e != nil {
			t.Fatal(e)
		}
	}
}
