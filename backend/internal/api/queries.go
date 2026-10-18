package api

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"margem/backend/internal/indicators"
	"margem/backend/internal/publications"
)

type point struct {
	Series    string             `json:"series"`
	Geography string             `json:"geography"`
	Start     string             `json:"start"`
	End       string             `json:"end"`
	Status    string             `json:"status"`
	Reason    string             `json:"reason,omitempty"`
	Node      *publications.Node `json:"node,omitempty"`
}
type seriesChoice struct {
	Source        string   `json:"source"`
	Dataset       string   `json:"dataset"`
	TemporalBasis string   `json:"temporal_basis"`
	Series        string   `json:"series"`
	Geography     string   `json:"geography"`
	Unit          string   `json:"unit"`
	Frequency     string   `json:"frequency"`
	Method        string   `json:"method"`
	Coverage      int      `json:"coverage"`
	Warnings      []string `json:"warnings"`
}

func indicatorID(s publications.Snapshot, series string) string {
	for _, spec := range s.Manifest.Catalog.Series {
		if spec.ID == series {
			return strings.ToLower(spec.Indicator)
		}
	}
	if strings.HasPrefix(series, "derived:") {
		for _, slot := range s.Manifest.Scope {
			if slot.Series != series || slot.ID == "" {
				continue
			}
			node := s.Nodes[slot.ID]
			for depth := 0; node.Evaluation != nil && depth < 32; depth++ {
				// Indicator calculations keep their meaning through later transforms.
				switch publications.SeriesID(node) {
				case "tr2":
					return "tr2"
				case "cv5", "price-income":
					return "cv5"
				}
				inputs := node.Evaluation.Request.Inputs
				id := inputs["current"]
				if id == "" {
					keys := make([]string, 0, len(inputs))
					for key := range inputs {
						keys = append(keys, key)
					}
					sort.Strings(keys)
					if len(keys) > 0 {
						id = inputs[keys[0]]
					}
				}
				node = s.Nodes[id]
				for _, spec := range s.Manifest.Catalog.Series {
					if spec.ID == node.Input.Series {
						return strings.ToLower(spec.Indicator)
					}
				}
			}
		}
		return "context"
	}
	if series == "price-income" {
		return "cv5"
	}
	return series
}
func points(s publications.Snapshot, series, geography string) []point {
	result := []point{}
	for _, slot := range s.Manifest.Scope {
		if series != "" && series != slot.Series || geography != "" && geography != slot.Geography {
			continue
		}
		p := point{Series: slot.Series, Geography: slot.Geography, Start: slot.Start, End: slot.End, Status: slot.Status, Reason: slot.Reason}
		if slot.ID != "" {
			node := s.Nodes[slot.ID]
			p.Node = &node
			p.Status = node.Input.Status
		}
		result = append(result, p)
	}
	sort.Slice(result, func(i, j int) bool {
		a, b := result[i], result[j]
		if a.Start != b.Start {
			return a.Start < b.Start
		}
		if a.End != b.End {
			return a.End < b.End
		}
		if a.Series != b.Series {
			return a.Series < b.Series
		}
		if a.Geography != b.Geography {
			return a.Geography < b.Geography
		}
		return a.Status < b.Status
	})
	return result
}
func choices(s publications.Snapshot, indicator string) []seriesChoice {
	result := []seriesChoice{}
	keys := map[string]int{}
	for _, slot := range s.Manifest.Scope {
		if indicatorID(s, slot.Series) != indicator {
			continue
		}
		key := slot.Series + "/" + slot.Geography
		i, exists := keys[key]
		if exists {
			result[i].Coverage++
			continue
		}
		item := seriesChoice{Series: slot.Series, Geography: slot.Geography, Coverage: 1, Warnings: []string{"Não emendar métodos ou recortes automaticamente."}}
		for _, spec := range s.Manifest.Catalog.Series {
			if spec.ID == slot.Series {
				item.Source = spec.Source
				item.Dataset = spec.Dataset
				item.TemporalBasis = spec.TemporalBasis
				item.Unit = spec.Unit
				item.Frequency = spec.Frequency
				item.Method = spec.Method
			}
		}

		if slot.Series == "tr2" || slot.Series == "cv5" || slot.Series == "price-income" {
			item.Source = "margem"
			item.Dataset = "indicator-engine"
			item.Frequency = "monthly"
			item.TemporalBasis = "calendar"
			for _, formula := range s.Manifest.Catalog.Formulas {
				if formula.ID == slot.Series {
					item.Method = formula.ID + "/" + formula.Version
				}
			}
			item.Unit = map[string]string{"tr2": "BRL/month@2025-12:INPC", "cv5": "h/basket", "price-income": "%"}[slot.Series]
		}
		if slot.ID != "" {
			n := s.Nodes[slot.ID]
			if v, ok := n.Input.Context["unit"].(string); ok {
				item.Unit = v
			}
			if v, ok := n.Input.Context["frequency"].(string); ok {
				item.Frequency = v
			}
			if v, ok := n.Input.Context["method"].(string); ok {
				item.Method = v
			}
			if n.Evaluation != nil {
				item.Source = "margem"
				item.Dataset = "indicator-engine"
				if v, ok := n.Input.Context["temporal_basis"].(string); ok {
					item.TemporalBasis = v
				}
				item.Warnings = append(item.Warnings, n.Evaluation.Warnings...)
			}
		}
		keys[key] = len(result)
		result = append(result, item)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Series != result[j].Series {
			return result[i].Series < result[j].Series
		}
		return result[i].Geography < result[j].Geography
	})
	return result
}

func (a *API) read(w http.ResponseWriter, r *http.Request) {
	pattern := chi.RouteContext(r.Context()).RoutePattern()
	allowed := []string{"publication"}
	switch pattern {
	case "/api/v1/themes", "/api/v1/indicators":
		allowed = append(allowed, "limit", "cursor")
		if strings.HasSuffix(pattern, "indicators") {
			allowed = append(allowed, "theme", "q", "role")
		}
	case "/api/v1/indicators/{slug}":
		allowed = append(allowed, "series", "geography")
	case "/api/v1/indicators/{slug}/series":
		allowed = append(allowed, "limit", "cursor")
	case "/api/v1/series/{series}":
		allowed = append(allowed, "geography", "from", "to", "limit", "cursor")
	case "/api/v1/comparisons":
		allowed = append(allowed, "series", "geography", "from", "to", "calculation", "version")
	case "/api/v1/publications/{publication}":
		allowed = nil
	}
	if e := parameters(r, allowed...); e != nil {
		a.fail(w, e)
		return
	}
	id := r.URL.Query().Get("publication")
	if pattern == "/api/v1/publications/{publication}" {
		id = chi.URLParam(r, "publication")
	}
	if id == "" {
		a.fail(w, publications.Fail("invalid_request", "resolva /api/v1/publications/current e informe publication"))
		return
	}
	s, e := a.Reader.Snapshot(r.Context(), id)
	if e != nil {
		a.fail(w, e)
		return
	}
	response := envelope{Publication: id, CatalogRevision: s.Manifest.Catalog.Revision}
	values := r.URL.Query()
	switch pattern {
	case "/api/v1/themes":
		items := append([]publications.Theme(nil), s.Manifest.Catalog.Themes...)
		sort.Slice(items, func(i, j int) bool { return items[i].Slug < items[j].Slug })
		response.Data, response.NextCursor, e = page(r, id, items)
	case "/api/v1/themes/{slug}":
		for _, item := range s.Manifest.Catalog.Themes {
			if item.Slug == chi.URLParam(r, "slug") {
				response.Data = item
			}
		}
	case "/api/v1/indicators":
		if len(values.Get("q")) > 200 {
			e = publications.Fail("invalid_request", "q excede 200 bytes")
			break
		}
		theme, role := values.Get("theme"), values.Get("role")
		if theme != "" {
			exists := false
			for _, t := range s.Manifest.Catalog.Themes {
				exists = exists || t.Slug == theme
			}
			if !exists {
				e = publications.Fail("invalid_request", "tema desconhecido")
				break
			}
		}
		if role != "" && role != "primary" && role != "context" && role != "input" {
			e = publications.Fail("invalid_request", "role inválido")
			break
		}
		items := []publications.Indicator{}
		q := strings.ToLower(values.Get("q"))
		for _, item := range s.Manifest.Catalog.Indicators {
			if theme != "" && item.Theme != theme || role != "" && item.Role != role || !strings.Contains(strings.ToLower(item.Name+" "+item.Question+" "+item.Slug), q) {
				continue
			}
			items = append(items, item)
		}
		sort.Slice(items, func(i, j int) bool { return items[i].Slug < items[j].Slug })
		response.Data, response.NextCursor, e = page(r, id, items)
	case "/api/v1/indicators/{slug}", "/api/v1/indicators/{slug}/series":
		var indicator *publications.Indicator
		for _, item := range s.Manifest.Catalog.Indicators {
			if item.Slug == chi.URLParam(r, "slug") {
				copy := item
				indicator = &copy
				break
			}
		}
		if indicator == nil {
			break
		}
		options := choices(s, indicator.ID)
		if strings.HasSuffix(pattern, "/series") {
			response.Data, response.NextCursor, e = page(r, id, options)
			break
		}
		filtered := []seriesChoice{}
		for _, option := range options {
			if values.Get("series") != "" && values.Get("series") != option.Series || values.Get("geography") != "" && values.Get("geography") != option.Geography {
				continue
			}
			filtered = append(filtered, option)
		}
		if len(filtered) == 0 {
			response.Data = map[string]any{"indicator": indicator, "status": "not_covered", "series": options}
			break
		}
		if len(filtered) > 1 {
			e = publications.Fail("ambiguous_selection", "escolha series e geography em /indicators/"+indicator.Slug+"/series")
			break
		}
		option := filtered[0]
		rows := points(s, option.Series, option.Geography)
		// Latest period includes unavailable states, never falls back to a number.
		sort.Slice(rows, func(i, j int) bool {
			if rows[i].End != rows[j].End {
				return rows[i].End < rows[j].End
			}
			return rows[i].Start < rows[j].Start
		})
		response.Data = map[string]any{"indicator": indicator, "series": option, "latest": rows[len(rows)-1]}
	case "/api/v1/series/{series}":
		series := chi.URLParam(r, "series")
		geography := values.Get("geography")
		rows := points(s, series, geography)
		if len(rows) == 0 {
			e = publications.Fail("not_covered", "série ou geografia fora do escopo")
			break
		}
		geographies := map[string]bool{}
		for _, row := range rows {
			geographies[row.Geography] = true
		}
		if len(geographies) > 1 {
			e = publications.Fail("ambiguous_selection", "escolha geography")
			break
		}
		from, to, err := interval(r, false)
		if err != nil {
			e = err
			break
		}
		filtered := []point{}
		for _, row := range rows {
			if from != "" && row.Start < from || to != "" && row.End > to {
				continue
			}
			filtered = append(filtered, row)
		}
		response.Data, response.NextCursor, e = page(r, id, filtered)
	case "/api/v1/sources/{source}":
		for _, item := range s.Manifest.Catalog.Sources {
			if item.ID == chi.URLParam(r, "source") {
				response.Data = item
			}
		}
	case "/api/v1/observations/{id}":
		if node, ok := s.Nodes[chi.URLParam(r, "id")]; ok {
			response.Data = node
		}
	case "/api/v1/comparisons":
		response.Data, e = compare(r, s)
	case "/api/v1/publications/{publication}":
		response.Data = s.Manifest
	}
	if e != nil {
		a.fail(w, e)
		return
	}
	if response.Data == nil {
		a.fail(w, publications.Fail("not_found", "recurso inexistente nesta publicação"))
		return
	}
	a.write(w, r, response, true)
}
func interval(r *http.Request, required bool) (string, string, error) {
	from, to := r.URL.Query().Get("from"), r.URL.Query().Get("to")
	for _, date := range []string{from, to} {
		if date != "" {
			if _, e := time.Parse("2006-01-02", date); e != nil {
				return "", "", publications.Fail("invalid_request", "data inválida")
			}
		}
	}
	if required && (from == "" || to == "") || from != "" && to != "" && from > to {
		return "", "", publications.Fail("invalid_request", "intervalo inválido")
	}
	if from != "" && to != "" {
		start, _ := time.Parse("2006-01-02", from)
		end, _ := time.Parse("2006-01-02", to)
		if end.After(start.AddDate(100, 0, 0)) {
			return "", "", publications.Fail("invalid_request", "intervalo excede 100 anos")
		}
	}
	return from, to, nil
}
func compare(r *http.Request, s publications.Snapshot) (any, error) {
	from, to, e := interval(r, true)
	if e != nil {
		return nil, e
	}
	v := r.URL.Query()
	calculation, version := v.Get("calculation"), v.Get("version")
	if (calculation != "difference" && calculation != "relative-change") || version != "2" || v.Get("series") == "" || v.Get("geography") == "" {
		return nil, publications.Fail("invalid_request", "informe série, geografia, calculation=difference|relative-change e version=2")
	}
	rows := points(s, v.Get("series"), v.Get("geography"))
	var previous, current *point
	for _, row := range rows {
		if row.Start == from {
			copy := row
			previous = &copy
		}
		if row.End == to {
			copy := row
			current = &copy
		}
	}
	result := map[string]any{"from": from, "to": to, "calculation": calculation, "version": version, "status": "not_comparable", "value": nil, "reason": "endpoint_not_covered"}
	if previous == nil || current == nil {
		return result, nil
	}
	result["previous"] = previous
	result["current"] = current
	if previous.Node == nil || current.Node == nil {
		result["reason"] = "endpoint_unavailable"
		return result, nil
	}
	request := indicators.Request{Calculation: calculation, Version: version, Inputs: map[string]string{"current": current.Node.Input.ID, "previous": previous.Node.Input.ID}}
	ev, e := indicators.Evaluate(request, map[string]indicators.Input{"current": current.Node.Input, "previous": previous.Node.Input})
	if e != nil {
		return nil, e
	}
	result["evaluation"] = ev
	result["value"] = ev.Output.Value
	result["reason"] = ev.Reason
	if ev.Output.Value != nil {
		result["status"] = "computed"
		result["interpretation"] = "Variação matemática; não classifica bem-estar ou causalidade."
	}
	return result, nil
}
