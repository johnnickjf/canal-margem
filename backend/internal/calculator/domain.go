// Package calculator evaluates user-declared scenarios without storing profiles.
package calculator

import (
	"fmt"
	"regexp"

	"github.com/shopspring/decimal"
)

const Version = "profile-v1"

// Amounts are decimal strings in BRL/month, never binary floating point.
type Profile struct {
	Income       string `json:"income"`
	Members      int    `json:"members"`
	Housing      string `json:"housing"`
	Transport    string `json:"transport"`
	Other        string `json:"other"`
	IncomeChange string `json:"income_change"`
	LaborIncome  string `json:"labor_income,omitempty"`
	MonthlyHours string `json:"monthly_hours,omitempty"`
}
type Budget struct {
	Income       string  `json:"income"`
	PerPerson    string  `json:"per_person"`
	Expenses     string  `json:"expenses"`
	Remaining    string  `json:"remaining"`
	ExpenseShare *string `json:"expense_share"`
}
type Result struct {
	Version     string            `json:"version"`
	Precision   int               `json:"precision"`
	Rounding    string            `json:"rounding"`
	Baseline    Budget            `json:"baseline"`
	Scenario    Budget            `json:"scenario"`
	BasketShare *string           `json:"basket_share"`
	BasketHours *string           `json:"basket_hours"`
	Formulas    map[string]string `json:"formulas"`
}

var money = regexp.MustCompile(`^-?(0|[1-9][0-9]{0,8})(\.[0-9]{1,2})?$`)

func amount(raw string, signed bool) (decimal.Decimal, error) {
	if !money.MatchString(raw) {
		return decimal.Zero, fmt.Errorf("use decimal com até 2 casas e valor absoluto até 999999999,99")
	}
	d, err := decimal.NewFromString(raw)
	if err != nil || (!signed && d.IsNegative()) {
		return decimal.Zero, fmt.Errorf("valor negativo não permitido")
	}
	return d, nil
}
func ratio(a, b decimal.Decimal) *string {
	if !b.IsPositive() {
		return nil
	}
	// DivRound uses half-away; adjust exact ties with an even truncated digit.
	rounded := a.DivRound(b, 12)
	truncated, remainder := a.QuoRem(b, 12)
	if remainder.Abs().Equal(b.Abs().Mul(decimal.New(5, -13))) && truncated.Shift(12).BigInt().Bit(0) == 0 {
		rounded = truncated
	}
	v := rounded.String()
	return &v
}
func Validate(p Profile) error {
	if p.Members < 1 || p.Members > 100 {
		return fmt.Errorf("composição familiar deve ter de 1 a 100 pessoas")
	}
	for _, raw := range []string{p.Income, p.Housing, p.Transport, p.Other} {
		if _, err := amount(raw, false); err != nil {
			return err
		}
	}
	change, err := amount(p.IncomeChange, true)
	if err != nil {
		return err
	}
	income, _ := amount(p.Income, false)
	if income.Add(change).IsNegative() {
		return fmt.Errorf("renda do cenário não pode ser negativa")
	}
	if (p.LaborIncome == "") != (p.MonthlyHours == "") {
		return fmt.Errorf("informe renda individual do trabalho e horas mensais juntas")
	}
	if p.LaborIncome != "" {
		labor, err := amount(p.LaborIncome, false)
		if err != nil || !labor.IsPositive() || labor.GreaterThan(income) {
			return fmt.Errorf("renda individual deve ser positiva e integrar a renda familiar")
		}
		hours, err := amount(p.MonthlyHours, false)
		if err != nil || !hours.IsPositive() || hours.GreaterThan(decimal.NewFromInt(744)) {
			return fmt.Errorf("horas mensais devem ser maiores que zero e até 744")
		}
	}
	return nil
}

// Evaluate separates declared household budgets from a single adult's reference basket.
// The optional work conversion uses one person's declared labor income and hours.
func Evaluate(p Profile, basket *decimal.Decimal) (Result, error) {
	if err := Validate(p); err != nil {
		return Result{}, err
	}
	income, _ := amount(p.Income, false)
	housing, _ := amount(p.Housing, false)
	transport, _ := amount(p.Transport, false)
	other, _ := amount(p.Other, false)
	change, _ := amount(p.IncomeChange, true)
	expenses := housing.Add(transport).Add(other)
	budget := func(income decimal.Decimal) Budget {
		return Budget{income.String(), *ratio(income, decimal.NewFromInt(int64(p.Members))), expenses.String(), income.Sub(expenses).String(), ratio(expenses.Mul(decimal.NewFromInt(100)), income)}
	}
	result := Result{Version: Version, Precision: 12, Rounding: "half_even", Baseline: budget(income), Scenario: budget(income.Add(change)), Formulas: map[string]string{
		"per_person": "income / members", "expenses": "housing + transport + other", "remaining": "income - expenses", "expense_share": "expenses / income * 100", "scenario_income": "income + income_change", "basket_share": "basket / income * 100", "basket_hours": "basket * monthly_hours / labor_income",
	}}
	if basket != nil && !basket.IsNegative() {
		result.BasketShare = ratio(basket.Mul(decimal.NewFromInt(100)), income)
		if p.LaborIncome != "" {
			labor, _ := amount(p.LaborIncome, false)
			hours, _ := amount(p.MonthlyHours, false)
			result.BasketHours = ratio(basket.Mul(hours), labor)
		}
	}
	return result, nil
}
