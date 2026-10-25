package calculator

import (
	"github.com/shopspring/decimal"
	"testing"
)

func TestBudgetPrecisionAndBoundaries(t *testing.T) {
	profile := Profile{Income: "100", Members: 3, Housing: "50.25", Transport: "25.25", Other: "50", IncomeChange: "-100"}
	price := decimal.RequireFromString("30.123456789012")
	result, err := Evaluate(profile, &price)
	if err != nil || result.Baseline.PerPerson != "33.333333333333" || result.Baseline.Remaining != "-25.5" || *result.Baseline.ExpenseShare != "125.5" || result.Scenario.Income != "0" || result.Scenario.ExpenseShare != nil || result.BasketHours != nil || *result.BasketShare != "30.123456789012" {
		t.Fatal(result, err)
	}
	for _, invalid := range []Profile{
		{Income: "100", Members: 1, Housing: "0", Transport: "0", Other: "0", IncomeChange: "0", LaborIncome: "100"},
		{Income: "100", Members: 1, Housing: "0", Transport: "0", Other: "0", IncomeChange: "0", LaborIncome: "101", MonthlyHours: "200"},
		{Income: "100", Members: 1, Housing: "0", Transport: "0", Other: "0", IncomeChange: "0", LaborIncome: "0", MonthlyHours: "200"},
		{Income: "100", Members: 1, Housing: "0", Transport: "0", Other: "0", IncomeChange: "0", LaborIncome: "100", MonthlyHours: "745"},
	} {
		if _, err := Evaluate(invalid, nil); err == nil {
			t.Fatal(invalid)
		}
	}
}

func TestDivisionRoundsExactTiesToEven(t *testing.T) {
	for _, tc := range []struct{ numerator, denominator, expected string }{
		{"0.0000000000005", "1", "0"},
		{"0.0000000000015", "1", "0.000000000002"},
		{"0.0000000000025", "1", "0.000000000002"},
		{"0.000000000002500000000000001", "1", "0.000000000003"},
		{"0.000000000002499999999999999", "1", "0.000000000002"},
	} {
		value := ratio(decimal.RequireFromString(tc.numerator), decimal.RequireFromString(tc.denominator))
		if value == nil || *value != tc.expected {
			t.Fatal(tc, value)
		}
	}
}
