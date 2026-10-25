package api

import (
	"net/http"

	"github.com/shopspring/decimal"
	"margem/backend/internal/indicators"
	"margem/backend/internal/publications"
)

// workTime uses only exact, explicitly selected periods in an immutable edition.
// CV5/1 and price-income/1 remain the sole owners of the economic calculations.
func workTime(r *http.Request, s publications.Snapshot) (any, error) {
	from, to, err := interval(r, true)
	if err != nil {
		return nil, err
	}
	v := r.URL.Query()
	series, geography := v.Get("series"), v.Get("geography")
	if (series != "cv4" && series != "cv5" && series != "price-income") || geography == "" {
		return nil, publications.Fail("invalid_request", "informe series=cv4|cv5|price-income e geography")
	}
	result := map[string]any{"series": series, "geography": geography, "from": from, "to": to, "status": "not_computed", "reason": "endpoint_not_covered"}
	find := func(series, geography string) *point {
		for _, p := range points(s, series, geography) {
			if p.Start == from && p.End == to {
				return &p
			}
		}
		return nil
	}
	selected := find(series, geography)
	if selected == nil {
		return result, nil
	}
	if selected.Node == nil || selected.Status != "observed" {
		result["reason"] = "endpoint_unavailable"
		return result, nil
	}
	price, income := find("cv4", geography), find("minimum-nominal", "BR")
	if price == nil || income == nil {
		result["reason"] = "reference_not_covered"
		return result, nil
	}
	result["price"], result["income"] = price, income
	if price.Node == nil || income.Node == nil {
		result["reason"] = "reference_unavailable"
		return result, nil
	}
	inputs := map[string]indicators.Input{"basket": price.Node.Input, "nominal": income.Node.Input}
	request := indicators.Request{Version: "1", Inputs: map[string]string{"basket": price.Node.Input.ID, "nominal": income.Node.Input.ID}}
	for _, calculation := range []string{"cv5", "price-income"} {
		request.Calculation = calculation
		ev, err := indicators.Evaluate(request, inputs)
		if err != nil {
			return nil, err
		}
		key := "hours"
		if calculation == "price-income" {
			key = "share"
		}
		result[key] = ev
		if ev.Output.Value == nil {
			result["reason"] = ev.Reason
			return result, nil
		}
		if calculation == "cv5" {
			// Unit formatting only: nearest minute, ties to even, from decimal hours.
			hours, _ := decimal.NewFromString(*ev.Output.Value)
			result["rounded_minutes"] = hours.Mul(decimal.NewFromInt(60)).RoundBank(0).String()
		}
	}
	result["status"] = "computed"
	delete(result, "reason")
	return result, nil
}
