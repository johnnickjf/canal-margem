package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"margem/backend/internal/catalog"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"net/url"
	"reflect"
	"sort"
	"strings"
	"time"
)

type Fetcher interface {
	Get(context.Context, string) ([]byte, error)
}
type Source func(context.Context, Fetcher, period.Window) ([]observations.Observation, error)

const ibgeURL = "https://servicodados.ibge.gov.br/api/v3/agregados"

type ibgeMetadata struct {
	ID          json.Number `json:"id"`
	Periodicity struct {
		Frequency string      `json:"frequencia"`
		Start     json.Number `json:"inicio"`
		End       json.Number `json:"fim"`
	} `json:"periodicidade"`
	Variables []struct {
		ID   json.Number `json:"id"`
		Unit string      `json:"unidade"`
	} `json:"variaveis"`
}
type ibgeResponse []struct {
	ID      string `json:"id"`
	Unit    string `json:"unidade"`
	Results []struct {
		Classifications []struct {
			ID       string            `json:"id"`
			Category map[string]string `json:"categoria"`
		} `json:"classificacoes"`
		Series []struct {
			Location struct {
				ID    string `json:"id"`
				Level struct {
					ID string `json:"id"`
				} `json:"nivel"`
			} `json:"localidade"`
			Values map[string]string `json:"serie"`
		} `json:"series"`
	} `json:"resultados"`
}

func NormalizeIBGE(body, metadata []byte, spec catalog.Spec, codes, artifacts []string) ([]observations.Observation, error) {
	bad := observations.Invalid
	wanted := map[string]bool{}
	for _, c := range codes {
		if wanted[c] {
			return nil, bad("IBGE: períodos solicitados duplicados")
		}
		wanted[c] = true
	}
	var meta ibgeMetadata
	var data ibgeResponse
	if e := json.Unmarshal(metadata, &meta); e != nil {
		return nil, bad("IBGE: metadados inválidos")
	}
	if e := json.Unmarshal(body, &data); e != nil {
		return nil, bad("IBGE: resposta inválida")
	}
	freq := map[string]string{"monthly": "mensal", "quarterly": "trimestral", "annual": "anual"}
	if string(meta.ID) != spec.Dataset || meta.Periodicity.Frequency != freq[spec.Frequency] {
		return nil, bad("IBGE: tabela/frequência divergente")
	}
	n := 0
	for _, v := range meta.Variables {
		if string(v.ID) == spec.Variable {
			if v.Unit != spec.Unit {
				return nil, bad("IBGE: unidade divergente")
			}
			n++
		}
	}
	if n != 1 {
		return nil, bad("IBGE: variável de metadados ambígua")
	}
	if len(data) != 1 || data[0].ID != spec.Variable || (data[0].Unit != "" && data[0].Unit != spec.Unit) || len(data[0].Results) != 1 {
		return nil, bad("IBGE: variável/unidade/recorte divergente")
	}
	result := data[0].Results[0]
	cats := map[string]string{}
	for _, c := range result.Classifications {
		if _, ok := cats[c.ID]; ok || len(c.Category) != 1 {
			return nil, bad("IBGE: categorias ambíguas")
		}
		for id := range c.Category {
			cats[c.ID] = id
		}
	}
	if !reflect.DeepEqual(cats, spec.Classification) || len(result.Series) != 1 {
		return nil, bad("IBGE: classificação/geografia divergente")
	}
	s := result.Series[0]
	if s.Location.ID != "1" || s.Location.Level.ID != "N1" || len(s.Values) != len(wanted) {
		return nil, bad("IBGE: geografia/períodos divergentes")
	}
	var metaMap any
	if e := canonical.Decode(metadata, &metaMap); e != nil {
		return nil, e
	}
	metaHash, e := canonical.Digest(metaMap)
	if e != nil {
		return nil, e
	}
	catHash, e := canonical.Digest(cats)
	if e != nil {
		return nil, e
	}
	context := map[string]any{"metadata_sha256": metaHash, "classification": cats, "source_publication_at": nil, "vintage_basis": "capture-content-not-official-order"}
	if spec.ID == "tr1" {
		context["monetary_base"] = "release-base-unresolved-block-publication"
	}
	rows := []observations.Observation{}
	keys := make([]string, 0, len(s.Values))
	for c := range s.Values {
		keys = append(keys, c)
	}
	sort.Strings(keys)
	for _, code := range keys {
		if !wanted[code] {
			return nil, bad("IBGE: períodos ausentes ou extras")
		}
		start, end, e := period.Code(code, spec.Frequency)
		if e != nil {
			return nil, e
		}
		o, e := observations.New(spec, start, end, s.Values[code], fmt.Sprintf("ibge:%s/%s/%s/%s", spec.Dataset, spec.Variable, code, catHash), context, "BR", artifacts)
		if e != nil {
			return nil, e
		}
		rows = append(rows, o)
	}
	return rows, nil
}
func IBGE(ctx context.Context, f Fetcher, w period.Window) ([]observations.Observation, error) {
	return collectIBGE(ctx, f, w, catalog.Series, true)
}
func collectIBGE(ctx context.Context, f Fetcher, w period.Window, specs []catalog.Spec, includePoverty bool) ([]observations.Observation, error) {
	rows := []observations.Observation{}
	metadata := map[string][]byte{}
	available := map[string][]struct {
		ID string `json:"id"`
	}{}
	for _, s := range specs {
		if s.Source != "ibge" || s.Dataset == "sis-2025" {
			continue
		}
		if metadata[s.Dataset] == nil {
			b, e := f.Get(ctx, ibgeURL+"/"+s.Dataset+"/metadados")
			if e != nil {
				return nil, e
			}
			metadata[s.Dataset] = b
			b, e = f.Get(ctx, ibgeURL+"/"+s.Dataset+"/periodos")
			if e != nil {
				return nil, e
			}
			var entries []struct {
				ID string `json:"id"`
			}
			if e = json.Unmarshal(b, &entries); e != nil {
				return nil, e
			}
			available[s.Dataset] = entries
		}
		codes := []string{}
		got := map[string]bool{}
		for _, entry := range available[s.Dataset] {
			a, b, e := period.Code(entry.ID, s.Frequency)
			if e != nil {
				return nil, e
			}
			if w.Contains(a, b) && s.First <= a.Format(period.Layout) && b.Format(period.Layout) <= s.Last {
				if got[entry.ID] {
					return nil, observations.Invalid("IBGE: períodos disponíveis duplicados")
				}
				codes = append(codes, entry.ID)
				got[entry.ID] = true
			}
		}
		var m ibgeMetadata
		if e := json.Unmarshal(metadata[s.Dataset], &m); e != nil {
			return nil, e
		}
		first, _, e := period.Code(string(m.Periodicity.Start), s.Frequency)
		if e != nil {
			return nil, e
		}
		_, last, e := period.Code(string(m.Periodicity.End), s.Frequency)
		if e != nil {
			return nil, e
		}
		expected := map[string]bool{}
		parts := map[string]int{"monthly": 12, "quarterly": 4, "annual": 1}[s.Frequency]
		for y := w.Start.Year(); y <= w.End.Year(); y++ {
			for p := 1; p <= parts; p++ {
				c := fmt.Sprintf("%04d%02d", y, p)
				if s.Frequency == "annual" {
					c = fmt.Sprint(y)
				}
				a, b, e := period.Code(c, s.Frequency)
				if e != nil {
					return nil, e
				}
				if w.Contains(a, b) && !a.Before(first) && !b.After(last) && s.First <= a.Format(period.Layout) && b.Format(period.Layout) <= s.Last {
					expected[c] = true
				}
			}
		}
		if !reflect.DeepEqual(got, expected) {
			return nil, observations.Invalid("%s: cobertura diverge dos metadados", s.ID)
		}
		for offset := 0; offset < len(codes); offset += 60 {
			end := min(offset+60, len(codes))
			chunk := codes[offset:end]
			params := url.Values{"localidades": {"N1[1]"}}
			if len(s.Classification) > 0 {
				keys := []string{}
				for k := range s.Classification {
					keys = append(keys, k)
				}
				sort.Strings(keys)
				v := []string{}
				for _, k := range keys {
					v = append(v, k+"["+s.Classification[k]+"]")
				}
				params.Set("classificacao", strings.Join(v, "|"))
			}
			// Match the established query ordering used by captured URLs.
			q := "localidades=" + url.QueryEscape("N1[1]")
			if v := params.Get("classificacao"); v != "" {
				q += "&classificacao=" + url.QueryEscape(v)
			}
			u := ibgeURL + "/" + s.Dataset + "/periodos/" + strings.Join(chunk, "|") + "/variaveis/" + s.Variable + "?" + q
			b, e := f.Get(ctx, u)
			if e != nil {
				return nil, e
			}
			batch, e := NormalizeIBGE(b, metadata[s.Dataset], s, chunk, []string{canonical.Hash(b), canonical.Hash(metadata[s.Dataset])})
			if e != nil {
				return nil, e
			}
			rows = append(rows, batch...)
		}
	}
	if includePoverty {
		b, e := f.Get(ctx, fileURLs["sis-renda.zip"])
		if e != nil {
			return nil, e
		}
		batch, e := NormalizePoverty(b, w)
		if e != nil {
			return nil, e
		}
		rows = append(rows, batch...)
	}
	return rows, nil
}
func NormalizeBCB(body []byte, s catalog.Spec, w period.Window, artifacts []string) ([]observations.Observation, error) {
	var data []struct {
		Date  string `json:"data"`
		Value string `json:"valor"`
	}
	if e := json.Unmarshal(body, &data); e != nil || len(data) == 0 {
		return nil, observations.Invalid("BCB: série vazia ou inválida")
	}
	rows := []observations.Observation{}
	previous := w.Start.AddDate(0, 0, -1)
	for _, item := range data {
		date, e := time.Parse("02/01/2006", item.Date)
		if e != nil || date.Day() != 1 {
			return nil, observations.Invalid("BCB: rótulo não mensal")
		}
		start, end := period.Month(date.Year(), date.Month())
		if !w.Contains(start, end) || !start.Equal(previous.AddDate(0, 0, 1)) {
			return nil, observations.Invalid("BCB: lacuna, duplicata, ordem ou janela inválida")
		}
		if item.Value == "-" || item.Value == "..." || item.Value == "X" || item.Value == ".." {
			return nil, observations.Invalid("BCB: valor inválido")
		}
		o, e := observations.New(s, start, end, item.Value, "sgs:"+s.Variable+"/"+start.Format(period.Layout), map[string]any{"source_publication_at": nil, "vintage_basis": "capture-content-not-official-order"}, "BR", artifacts)
		if e != nil {
			return nil, e
		}
		rows = append(rows, o)
		previous = end
	}
	return rows, nil
}
func BCB(ctx context.Context, f Fetcher, w period.Window) ([]observations.Observation, error) {
	if w.Start.Day() != 1 {
		return nil, observations.Invalid("BCB exige início no primeiro dia do mês")
	}
	_, end := period.Month(w.End.Year(), w.End.Month())
	if !end.Equal(w.End) {
		start, _ := period.Month(w.End.Year(), w.End.Month())
		end = start.AddDate(0, 0, -1)
	}
	if end.Before(w.Start) {
		return nil, observations.Invalid("BCB: janela sem meses completos")
	}
	query := period.Window{Start: w.Start, End: end}
	rows := []observations.Observation{}
	for _, s := range catalog.Series {
		if s.Source != "bcb" {
			continue
		}
		u := fmt.Sprintf("https://api.bcb.gov.br/dados/serie/bcdata.sgs.%s/dados?formato=json&dataInicial=%s&dataFinal=%s", s.Variable, url.QueryEscape(w.Start.Format("02/01/2006")), url.QueryEscape(end.Format("02/01/2006")))
		b, e := f.Get(ctx, u)
		if e != nil {
			return nil, e
		}
		batch, e := NormalizeBCB(b, s, query, []string{canonical.Hash(b)})
		if e != nil {
			return nil, e
		}
		rows = append(rows, batch...)
	}
	return rows, nil
}
