// Package indicators owns reproducible calculations, independently of publication.
package indicators

import (
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/shopspring/decimal"
	"margem/backend/internal/catalog"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
)

const Precision = 12

type Definition struct {
	ID            string            `json:"id"`
	Version       string            `json:"version"`
	Formula       string            `json:"formula"`
	Inputs        []string          `json:"inputs"`
	Methodology   string            `json:"methodology"`
	Parameters    map[string]string `json:"parameters"`
	Precision     int               `json:"precision"`
	Rounding      string            `json:"rounding"`
	MissingPolicy string            `json:"missing_policy"`
}

func Definitions() []Definition {
	return []Definition{
		definition("tr2", "1", "nominal * base_index / current_index", []string{"nominal", "current_index", "base_index"}, "Mínimo nacional deflacionado pelo INPC; índice-base temporal explícito.", map[string]string{"base_period": "2025-12", "territory": "BR"}),
		definition("cv5", "1", "basket * reference_monthly_hours / nominal", []string{"basket", "nominal"}, "Piso nacional aplicado à capital; não representa jornada observada ou salário líquido.", map[string]string{"reference_monthly_hours": "220", "territorial_transformation": "national-minimum-to-capital"}),
		definition("price-income", "1", "basket / nominal * 100", []string{"basket", "nominal"}, "Custo da cesta da capital em percentual do mínimo nominal nacional do mesmo mês.", map[string]string{"territorial_transformation": "national-minimum-to-capital"}),
		definition("relative-change", "2", "(current / previous - 1) * 100", []string{"current", "previous"}, "Variação relativa entre períodos comparáveis, incluindo intervalos completos de igual duração em meses; sem classificação de bem-estar.", nil),
		definition("difference", "2", "current - previous", []string{"current", "previous"}, "Diferença absoluta entre períodos comparáveis, incluindo intervalos completos de igual duração em meses; taxas percentuais resultam em pontos percentuais.", nil),
		definition("rebase", "2", "current / base * 100", []string{"current", "base"}, "Índice de base 100 em período explícito da mesma série, incluindo intervalos completos de igual duração em meses.", map[string]string{"base_value": "100"}),
		definition("compound-change", "2", "(product(1 + monthly_rate / 100) - 1) * 100", []string{"month:YYYY-MM"}, "Acumulado composto de variações mensais de preços em meses civis contíguos; apenas IPCA, alimentação e INPC, sem emenda metodológica, níveis ou proporções.", nil),
	}
}
func definition(id, version, formula string, inputs []string, method string, params map[string]string) Definition {
	return Definition{id, version, formula, inputs, method, params, Precision, "half_even", "do_not_compute"}
}
func lookup(id, version string) (Definition, error) {
	for _, d := range Definitions() {
		if d.ID == id && d.Version == version {
			return d, nil
		}
	}
	return Definition{}, fmt.Errorf("cálculo/versão desconhecido: %s/%s", id, version)
}

type Request struct {
	Calculation string            `json:"calculation"`
	Version     string            `json:"version"`
	Inputs      map[string]string `json:"inputs"`
}

// Input is an immutable accepted normalized observation or a prior engine output.
type Input struct {
	ID        string         `json:"id"`
	Series    string         `json:"series"`
	Start     string         `json:"start"`
	End       string         `json:"end"`
	Geography string         `json:"geography"`
	Value     *string        `json:"value"`
	Status    string         `json:"status"`
	Context   map[string]any `json:"context"`
}
type Evaluation struct {
	Request    Request    `json:"request"`
	Definition Definition `json:"definition"`
	Output     Input      `json:"output"`
	Reason     string     `json:"reason,omitempty"`
	Warnings   []string   `json:"warnings"`
}

func (r Request) Validate() error {
	d, e := lookup(r.Calculation, r.Version)
	if e != nil {
		return e
	}
	if r.Calculation == "compound-change" {
		if len(r.Inputs) == 0 || len(r.Inputs) > 1200 {
			return fmt.Errorf("esperados de 1 a 1200 meses")
		}
		for k := range r.Inputs {
			if !regexp.MustCompile(`^month:\d{4}-\d{2}$`).MatchString(k) {
				return fmt.Errorf("papel mensal inválido")
			}
		}
	} else {
		if len(r.Inputs) != len(d.Inputs) {
			return fmt.Errorf("papéis de entrada inválidos")
		}
		for _, role := range d.Inputs {
			if r.Inputs[role] == "" {
				return fmt.Errorf("input ausente: %s", role)
			}
		}
	}
	for _, id := range r.Inputs {
		if !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(id) {
			return fmt.Errorf("ID de input inválido")
		}
	}
	return nil
}

// Evaluate never substitutes latest values. Domain incompatibilities are persisted
// as evaluations without a number; malformed requests are errors.
func Evaluate(r Request, inputs map[string]Input) (Evaluation, error) {
	if e := r.Validate(); e != nil {
		return Evaluation{}, e
	}
	d, _ := lookup(r.Calculation, r.Version)
	ev := Evaluation{Request: r, Definition: d, Warnings: []string{}}
	roles := make([]string, 0, len(r.Inputs))
	for role := range r.Inputs {
		roles = append(roles, role)
	}
	sort.Strings(roles)
	block := func(reason string) (Evaluation, error) {
		ev.Reason = reason
		ev.Output.Status = "not_computed"
		ev.Output.Value = nil
		return ev, nil
	}
	values := map[string]*big.Rat{}
	for _, role := range roles {
		x, ok := inputs[role]
		if !ok || x.ID != r.Inputs[role] {
			return block("input_not_accepted:" + role)
		}
		if x.Status != "observed" || x.Value == nil {
			return block("input_unavailable:" + role)
		}
		if _, e := observations.Decimal(*x.Value, false); e != nil {
			return block("invalid_decimal:" + role)
		}
		n, ok := new(big.Rat).SetString(*x.Value)
		if !ok {
			return block("invalid_decimal:" + role)
		}
		values[role] = n
		if !validInput(x) {
			return block("incompatible_metadata:" + role)
		}
		if x.Context["monetary_base"] == "release-base-unresolved-block-publication" {
			return block("unresolved_monetary_base:" + role)
		}
	}
	var result *big.Rat
	ref := inputs[roles[0]]
	unit := ""
	seriesInputs := inputSeries(inputs)
	outContext := map[string]any{"source": "margem", "dataset": "indicator-engine", "source_series_id": nil, "method": d.ID + "/" + d.Version, "calculation": d.ID, "calculation_version": d.Version}
	switch r.Calculation {
	case "tr2":
		n, c, b := inputs["nominal"], inputs["current_index"], inputs["base_index"]
		if n.Series != "minimum-nominal" || c.Series != "inpc-index" || b.Series != "inpc-index" || n.Geography != "BR" || c.Geography != "BR" || b.Geography != "BR" || !samePeriod(n, c) || !month(n) || !month(b) || b.Start != "2025-12-01" || b.End != "2025-12-31" || !comparable(c, b) {
			return block("incompatible_tr2_inputs")
		}
		if values["nominal"].Sign() <= 0 || values["current_index"].Sign() <= 0 || values["base_index"].Sign() <= 0 {
			return block("nonpositive_input")
		}
		result = new(big.Rat).Quo(new(big.Rat).Mul(values["nominal"], values["base_index"]), values["current_index"])
		ref = n
		unit = "BRL/month@2025-12:INPC"
		outContext["monetary_base"] = "2025-12"
		outContext["deflator"] = "inpc-index"
	case "cv5", "price-income":
		b, n := inputs["basket"], inputs["nominal"]
		if b.Context["composition"] == nil || b.Context["method_segment"] == nil || b.Series != "cv4" || n.Series != "minimum-nominal" || !strings.HasPrefix(b.Geography, "BR-city-") || n.Geography != "BR" || !samePeriod(b, n) || !month(b) {
			return block("incompatible_basket_inputs")
		}
		if values["basket"].Sign() < 0 || values["nominal"].Sign() <= 0 {
			return block("invalid_price_or_denominator")
		}
		factor := int64(220)
		unit = "h/basket"
		if r.Calculation == "price-income" {
			factor = 100
			unit = "%"
		}
		result = new(big.Rat).Quo(new(big.Rat).Mul(values["basket"], big.NewRat(factor, 1)), values["nominal"])
		ref = b
		outContext["composition"] = b.Context["composition"]
		outContext["method_segment"] = b.Context["method_segment"]
		outContext["territorial_transformation"] = "national-minimum-to-capital"
		if r.Calculation == "cv5" {
			ev.Warnings = append(ev.Warnings, "reference_220_hours_not_observed_work_time")
			if report, ok := b.Context["published_work_time"].(string); ok {
				comparison := confront(result, report)
				if comparison != "published_work_time_within_one_minute" {
					return block(comparison)
				}
				ev.Warnings = append(ev.Warnings, comparison)
			}
		}
	case "relative-change", "difference", "rebase":
		other := "previous"
		if r.Calculation == "rebase" {
			other = "base"
		}
		c, p := inputs["current"], inputs[other]
		if !comparable(c, p) || (r.Calculation != "rebase" && c.Start <= p.End) {
			return block("not_comparable")
		}
		ref = c
		unit = c.Context["unit"].(string)
		// Retain semantic context for subsequent calculations on this output.
		for _, k := range []string{"classification", "monetary_base", "composition", "method_segment", "deflator", "window_months"} {
			if v, ok := c.Context[k]; ok {
				outContext[k] = v
			}
		}
		if r.Calculation == "difference" {
			result = new(big.Rat).Sub(values["current"], values[other])
			if unit == "%" {
				unit = "percentage_points"
			}
		} else {
			if values[other].Sign() <= 0 {
				return block("nonpositive_denominator")
			}
			result = new(big.Rat).Quo(values["current"], values[other])
			if r.Calculation == "relative-change" {
				result.Sub(result, big.NewRat(1, 1))
				unit = "%"
			} else {
				unit = "index"
				outContext["index_base_period"] = p.Start + "/" + p.End
			}
			result.Mul(result, big.NewRat(100, 1))
		}
		outContext["comparison_start"] = p.Start
		outContext["comparison_end"] = p.End
		if r.Calculation != "rebase" {
			outContext["temporal_basis"] = "explicit_comparison"
			currentDate, _ := period.Date(c.Start)
			previousDate, _ := period.Date(p.Start)
			if c.Context["frequency"] == "weekly" {
				outContext["comparison_lag"] = fmt.Sprintf("%d_days", int(currentDate.Sub(previousDate).Hours()/24))
			} else {
				outContext["comparison_lag"] = fmt.Sprintf("%d_calendar_months", (currentDate.Year()-previousDate.Year())*12+int(currentDate.Month()-previousDate.Month()))
			}
		}
	case "compound-change":
		result = big.NewRat(1, 1)
		first := inputs[roles[0]]
		ref = first
		for i, role := range roles {
			x := inputs[role]
			if !monthlyPriceChange(x) || !month(x) || role != "month:"+x.Start[:7] || !comparable(first, x) || x.Context["unit"] != "%" || (x.Context["temporal_basis"] != "calendar_month" && x.Context["temporal_basis"] != "calendar") {
				return block("incompatible_monthly_rate")
			}
			if i > 0 {
				prev, _ := period.Date(inputs[roles[i-1]].Start)
				cur, _ := period.Date(x.Start)
				if !prev.AddDate(0, 1, 0).Equal(cur) {
					return block("noncontiguous_months")
				}
			}
			if values[role].Cmp(big.NewRat(-100, 1)) < 0 {
				return block("rate_below_minus_100")
			}
			result.Mul(result, new(big.Rat).Add(big.NewRat(1, 1), new(big.Rat).Quo(values[role], big.NewRat(100, 1))))
		}
		result.Sub(result, big.NewRat(1, 1))
		result.Mul(result, big.NewRat(100, 1))
		unit = "%"
		ref.End = inputs[roles[len(roles)-1]].End
		outContext["frequency"] = "interval"
		outContext["temporal_basis"] = "explicit_interval"
		outContext["window_months"] = len(roles)
		// Calendar dates pin this evaluation, while the source and window define
		// the measure shared by successive accumulated observations.
		seriesInputs = map[string]string{"monthly_rate": first.Series}
	}
	value := round(result)
	outContext["unit"] = unit
	if outContext["frequency"] == nil {
		outContext["frequency"] = ref.Context["frequency"]
	}
	if outContext["temporal_basis"] == nil {
		outContext["temporal_basis"] = ref.Context["temporal_basis"]
	}
	// Output series identity includes semantic parameters, without including input
	// vintages. Revisions change evaluation IDs, not the meaning of the series.
	identityContext := map[string]any{}
	for _, k := range []string{"unit", "frequency", "temporal_basis", "monetary_base", "deflator", "composition", "method_segment", "index_base_period", "comparison_lag"} {
		identityContext[k] = outContext[k]
	}
	if outContext["window_months"] != nil {
		identityContext["window_months"] = outContext["window_months"]
	}
	series, _ := canonical.Digest(map[string]any{"calculation": d, "input_series": seriesInputs, "unit": unit, "context": identityContext})
	ev.Output = Input{Series: "derived:" + series, Start: ref.Start, End: ref.End, Geography: ref.Geography, Value: &value, Status: "observed", Context: outContext}
	return ev, nil
}
func inputSeries(inputs map[string]Input) map[string]string {
	m := map[string]string{}
	for k, x := range inputs {
		m[k] = x.Series
	}
	return m
}
func validInput(x Input) bool {
	s, e := period.Date(x.Start)
	if e != nil {
		return false
	}
	t, e := period.Date(x.End)
	if e != nil || t.Before(s) {
		return false
	}
	for _, k := range []string{"unit", "frequency", "method", "temporal_basis"} {
		if v, ok := x.Context[k].(string); !ok || v == "" {
			return false
		}
	}
	if spec, ok := catalog.ByID[x.Series]; ok {
		return x.Context["unit"] == spec.Unit && x.Context["method"] == spec.Method && x.Context["frequency"] == spec.Frequency && x.Context["temporal_basis"] == spec.TemporalBasis
	}
	return strings.HasPrefix(x.Series, "derived:")
}
func samePeriod(a, b Input) bool { return a.Start == b.Start && a.End == b.End }
func monthlyPriceChange(x Input) bool {
	switch x.Series {
	case "cv1-monthly", "cv2-old-monthly", "cv2-current-monthly", "inpc-monthly":
		return true
	}
	return false
}

// Interval length is measured in complete calendar months, including leap years.
// Canonical JSON accepts both the integer produced here and the JSON number read
// from PostgreSQL, while rejecting strings, fractions and absent metadata.
func calendarInterval(x Input) bool {
	s, e := period.Date(x.Start)
	if e != nil || s.Day() != 1 {
		return false
	}
	t, e := period.Date(x.End)
	if e != nil || t.Before(s) {
		return false
	}
	months := (t.Year()-s.Year())*12 + int(t.Month()-s.Month()) + 1
	if months < 1 || months > 1200 || !s.AddDate(0, months, -1).Equal(t) {
		return false
	}
	encoded, e := canonical.Bytes(x.Context["window_months"])
	return e == nil && string(encoded) == strconv.Itoa(months)
}

func month(x Input) bool {
	s, e := period.Date(x.Start)
	if e != nil {
		return false
	}
	a, b := period.Month(s.Year(), s.Month())
	return x.Start == a.Format(period.Layout) && x.End == b.Format(period.Layout) && x.Context["frequency"] == "monthly"
}
func comparable(a, b Input) bool {
	if a.Series != b.Series || a.Geography != b.Geography {
		return false
	}
	for _, k := range []string{"unit", "frequency", "method", "temporal_basis", "classification", "monetary_base", "composition", "method_segment", "deflator", "index_base_period", "comparison_lag", "window_months"} {
		x, _ := canonical.Digest(a.Context[k])
		y, _ := canonical.Digest(b.Context[k])
		if x != y {
			return false
		}
	}
	// Periods must have the declared calendar shape; no partial-period joins.
	switch a.Context["frequency"] {
	case "monthly":
		return month(a) && month(b)
	case "interval":
		return calendarInterval(a) && calendarInterval(b)
	case "annual":
		return a.Start[5:] == "01-01" && a.End == a.Start[:4]+"-12-31" && b.Start[5:] == "01-01" && b.End == b.Start[:4]+"-12-31"
	case "quarterly":
		valid := func(x Input) bool {
			s, _ := period.Date(x.Start)
			start, end, e := period.Code(fmt.Sprintf("%04d%02d", s.Year(), (int(s.Month())-1)/3+1), "quarterly")
			return e == nil && x.Start == start.Format(period.Layout) && x.End == end.Format(period.Layout)
		}
		return valid(a) && valid(b)
	case "weekly":
		s, _ := period.Date(a.Start)
		e, _ := period.Date(a.End)
		t, _ := period.Date(b.Start)
		u, _ := period.Date(b.End)
		return e.Sub(s) == u.Sub(t) && e.Sub(s).Hours() == 144
	}
	return false
}

// Exact rational arithmetic through the entire formula; round once, half even.
func round(n *big.Rat) string {
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(Precision), nil)
	num := new(big.Int).Mul(n.Num(), scale)
	sign := num.Sign()
	num.Abs(num)
	q, r := new(big.Int), new(big.Int)
	q.QuoRem(num, n.Denom(), r)
	cmp := new(big.Int).Lsh(r, 1).Cmp(n.Denom())
	if cmp > 0 || cmp == 0 && q.Bit(0) == 1 {
		q.Add(q, big.NewInt(1))
	}
	if sign < 0 {
		q.Neg(q)
	}
	return decimal.NewFromBigInt(q, -Precision).String()
}
func confront(hours *big.Rat, published string) string {
	m := regexp.MustCompile(`^(\d+)h(\d+)m$`).FindStringSubmatch(published)
	if m == nil {
		return "published_work_time_invalid"
	}
	h, _ := strconv.Atoi(m[1])
	min, _ := strconv.Atoi(m[2])
	if min >= 60 {
		return "published_work_time_invalid"
	}
	// Published whole minutes may be truncated or rounded: accept <= one minute.
	delta := new(big.Rat).Sub(new(big.Rat).Mul(hours, big.NewRat(60, 1)), big.NewRat(int64(h*60+min), 1))
	delta.Abs(delta)
	if delta.Cmp(big.NewRat(1, 1)) <= 0 {
		return "published_work_time_within_one_minute"
	}
	return "published_work_time_mismatch"
}
