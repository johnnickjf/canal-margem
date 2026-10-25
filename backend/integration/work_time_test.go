package integration

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"margem/backend/internal/api"
	"margem/backend/internal/catalog"
	"margem/backend/internal/indicators"
	"margem/backend/internal/ingestion"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"margem/backend/internal/publications"
)

func TestWorkTimeAcceptedPublicationAndRevision(t *testing.T) {
	pool, scenario, commands, queries := publicationSetup(t)
	scenario.window, _ = period.NewWindow("2025-01-01", "2025-01-31", time.Now())
	cost := "750"
	for _, series := range []string{"cv4", "minimum-nominal"} {
		scenario.commands.Sources[catalog.ByID[series].Source] = func(ctx context.Context, f ingestion.Fetcher, _ period.Window) ([]observations.Observation, error) {
			body, err := f.Get(ctx, "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1619/dados")
			if err != nil {
				return nil, err
			}
			start, end := period.Month(2025, time.January)
			value, geo := cost, "BR-city-3550308"
			metadata := map[string]any{"composition": "regional", "method_segment": "partnership-2025"}
			if series == "minimum-nominal" {
				value, geo = "1500", "BR"
				metadata = map[string]any{}
			}
			o, err := observations.New(catalog.ByID[series], start, end, value, series, metadata, geo, []string{canonical.Hash(body)})
			return []observations.Observation{o}, err
		}
	}
	build := func(base int64) publications.Prepared {
		t.Helper()
		slots := []publications.Slot{}
		ids := map[string]string{}
		for _, source := range []string{"dieese", "bcb"} {
			receipt, err := scenario.commands.Run(ctx, source, scenario.window, true)
			if err != nil {
				t.Fatal(err)
			}
			for _, slot := range scopeFor(t, pool, receipt.Batch) {
				slots = append(slots, slot)
				ids[slot.Series] = slot.ID
			}
		}
		requests := []indicators.Request{}
		for _, calc := range []string{"cv5", "price-income"} {
			requests = append(requests, indicators.Request{Calculation: calc, Version: "1", Inputs: map[string]string{"basket": ids["cv4"], "nominal": ids["minimum-nominal"]}})
		}
		receipts, err := (indicators.Commands{Pool: pool}).Materialize(ctx, requests)
		if err != nil {
			t.Fatal(err)
		}
		for _, receipt := range receipts {
			o := receipt.Evaluation.Output
			slots = append(slots, publications.Slot{Series: receipt.Evaluation.Request.Calculation, Geography: o.Geography, Start: o.Start, End: o.End, ID: receipt.ID})
		}
		return prepare(t, commands, slots, base)
	}
	first := build(0)
	handler := api.New(queries)
	path := func(publication, series string) string {
		return "/api/v1/work-time?publication=" + publication + "&series=" + series + "&geography=BR-city-3550308&from=2025-01-01&to=2025-01-31"
	}
	expectStatus(t, get(handler, path(first.Publication, "cv4")), 404)
	if _, err := commands.Activate(ctx, activation(first, 0)); err != nil {
		t.Fatal(err)
	}
	verify := func(publication, series, hours, share, minutes string) string {
		t.Helper()
		response := get(handler, path(publication, series))
		expectStatus(t, response, 200)
		var body struct {
			Publication string
			Data        struct {
				Status         string
				Hours, Share   indicators.Evaluation
				RoundedMinutes string `json:"rounded_minutes"`
			}
		}
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		d := body.Data
		if body.Publication != publication || d.Status != "computed" || d.Hours.Output.Value == nil || *d.Hours.Output.Value != hours || d.Share.Output.Value == nil || *d.Share.Output.Value != share || d.RoundedMinutes != minutes {
			t.Fatal(response.Body.String())
		}
		return response.Body.String()
	}
	original := verify(first.Publication, "cv4", "110", "50", "6600")
	verify(first.Publication, "cv5", "110", "50", "6600")
	verify(first.Publication, "price-income", "110", "50", "6600")
	cost = "825"
	revised := build(1)
	if _, err := commands.Activate(ctx, activation(revised, 1)); err != nil {
		t.Fatal(err)
	}
	verify(revised.Publication, "cv4", "121", "55", "7260")
	if verify(first.Publication, "cv4", "110", "50", "6600") != original {
		t.Fatal("old edition changed after activation")
	}
}
