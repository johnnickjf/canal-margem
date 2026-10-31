package ingestion

import (
	"context"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const DIEESEIndex = "https://www.dieese.org.br/analisecestabasica/analiseCestaBasicaAnteriores.html"
const DIEESECurrent = "https://www.dieese.org.br/analisecestabasica/analiseCestaBasica_conabDieese.html"

func ANP(ctx context.Context, f Fetcher, w period.Window) ([]observations.Observation, error) {
	body, e := f.Get(ctx, ANPIndex)
	if e != nil {
		return nil, e
	}
	links, e := Links(body, ANPIndex)
	if e != nil {
		return nil, e
	}
	rows := []observations.Observation{}
	for _, v := range []struct{ name, sheet string }{{"anp-old.xlsx", "BRASIL - 09.05.04 A 29.12.12"}, {"anp-new.xlsx", "BRASIL - DESDE 30.12.2012"}} {
		u := fileURLs[v.name]
		if !links[u] {
			return nil, observations.Invalid("ANP: arquivo não está no índice")
		}
		body, e := f.Get(ctx, u)
		if e != nil {
			return nil, e
		}
		batch, e := NormalizeANP(body, v.sheet, w)
		if e != nil {
			return nil, e
		}
		rows = append(rows, batch...)
	}
	weeks := []string{}
	for _, o := range rows {
		weeks = append(weeks, o.Start)
	}
	sort.Strings(weeks)
	allowed := map[string]bool{"2015-08-09/2015-08-23": true, "2020-08-16/2020-10-18": true}
	for i := 1; i < len(weeks); i++ {
		a, _ := period.Date(weeks[i-1])
		b, _ := period.Date(weeks[i])
		if b.Sub(a) != 7*24*time.Hour && !allowed[weeks[i-1]+"/"+weeks[i]] {
			return nil, observations.Invalid("ANP: lacuna não catalogada: %s/%s", weeks[i-1], weeks[i])
		}
	}
	return rows, nil
}
func FJP(ctx context.Context, f Fetcher, w period.Window) ([]observations.Observation, error) {
	b, e := f.Get(ctx, FJPIndex)
	if e != nil {
		return nil, e
	}
	if !strings.Contains(string(b), "Déficit") && !strings.Contains(string(b), "déficit") {
		return nil, observations.Invalid("FJP: índice inválido")
	}
	links, e := Links(b, FJPIndex)
	if e != nil {
		return nil, e
	}
	known := map[string]bool{}
	idRE := regexp.MustCompile(`(?:id=|/d/)([^/&?]+)`)
	for name, u := range fileURLs {
		if strings.HasPrefix(name, "fjp") {
			m := idRE.FindStringSubmatch(u)
			if m == nil {
				return nil, observations.Invalid("FJP: URL de catálogo inválida")
			}
			known[m[1]] = true
		}
	}
	sheets := map[string]bool{}
	sheetRE := regexp.MustCompile(`spreadsheets/d/([^/]+)`)
	for link := range links {
		m := sheetRE.FindStringSubmatch(link)
		if m != nil {
			sheets[m[1]] = true
		}
	}
	if len(sheets) == 0 {
		return nil, observations.Invalid("FJP: planilhas ausentes")
	}
	for id := range known {
		if !sheets[id] {
			return nil, observations.Invalid("FJP: vínculos selecionados mudaram")
		}
	}
	for _, id := range []string{"157eNPVoJPRowVBNQobAK1weRLnajftCI", "1CzNCJm5f4aNR3BY28FPUcaMlkKpC5MLK", "1Qg5DSnJRrsvqoZeCItJ-KPHNtuMf_JE6", "1dun9qQm73z33IGH_07MHAhGrLru5dyoV", "18D1UwSU4SkmGhdEpqA-5INN9TUzGfn2e"} {
		known[id] = true
	}
	for id := range sheets {
		if !known[id] {
			return nil, observations.Invalid("FJP: nova planilha exige revisão do catálogo/método")
		}
	}
	rows := []observations.Observation{}
	for _, entry := range []struct{ name, edition string }{{"fjp2016.xlsx", "2016-2019-reweighted-2023"}, {"fjp2022.xlsx", "2022"}, {"fjp2023.xlsx", "2023"}, {"fjp2024.xlsx", "2024"}} {
		if len(entry.edition) == 4 {
			a, z, e := period.Code(entry.edition, "annual")
			if e != nil {
				return nil, e
			}
			if !w.Contains(a, z) {
				continue
			}
		}
		b, e := f.Get(ctx, fileURLs[entry.name])
		if e != nil {
			return nil, e
		}
		batch, e := NormalizeFJP(b, entry.edition, w)
		if e != nil {
			return nil, e
		}
		rows = append(rows, batch...)
	}
	return rows, nil
}
func DIEESE(ctx context.Context, f Fetcher, w period.Window) ([]observations.Observation, error) {
	links := map[string]bool{}
	for _, u := range []string{DIEESEIndex, DIEESECurrent} {
		b, e := f.Get(ctx, u)
		if e != nil {
			return nil, e
		}
		l, e := Links(b, u)
		if e != nil {
			return nil, e
		}
		for v := range l {
			links[v] = true
		}
	}
	original := []string{}
	for u := range links {
		original = append(original, u)
	}
	sort.Strings(original)
	pageRE := regexp.MustCompile(`(?:analiseCestaBasica|/)(\d{4})(\d{2})(?:cestabasica)?\.html$`)
	for _, u := range original {
		m := pageRE.FindStringSubmatch(u)
		if m == nil {
			continue
		}
		a, z, e := period.Code(m[1]+m[2], "monthly")
		if e != nil {
			return nil, e
		}
		if !w.Contains(a, z) {
			continue
		}
		b, e := f.Get(ctx, u)
		if e != nil {
			return nil, e
		}
		l, e := Links(b, u)
		if e != nil {
			return nil, e
		}
		for v := range l {
			links[v] = true
		}
	}
	bulletins := map[string]string{}
	bulletinRE := regexp.MustCompile(`/(\d{4})/(\d{4})(\d{2})cestabasica\.pdf$`)
	for u := range links {
		m := bulletinRE.FindStringSubmatch(u)
		if m == nil || m[1] != m[2] {
			continue
		}
		code := m[2] + m[3]
		a, z, e := period.Code(code, "monthly")
		if e != nil {
			return nil, e
		}
		if !w.Contains(a, z) {
			continue
		}
		if _, ok := bulletins[code]; ok {
			return nil, observations.Invalid("DIEESE: boletins ambíguos")
		}
		bulletins[code] = u
	}
	if len(bulletins) == 0 {
		return nil, observations.Invalid("DIEESE: nenhum boletim descoberto")
	}
	codes := []string{}
	for c := range bulletins {
		codes = append(codes, c)
	}
	sort.Strings(codes)
	expected, _ := period.Month(w.Start.Year(), w.Start.Month())
	rows := []observations.Observation{}
	for _, code := range codes {
		a, z, _ := period.Code(code, "monthly")
		if !a.Equal(expected) {
			return nil, observations.Invalid("DIEESE: boletim ausente em %s", expected.Format(period.Layout))
		}
		b, e := f.Get(ctx, bulletins[code])
		if e != nil {
			return nil, e
		}
		year, _ := strconv.Atoi(code[:4])
		month, _ := strconv.Atoi(code[4:])
		batch, e := NormalizeBasket(b, year, month, w)
		if e != nil {
			return nil, observations.Invalid("DIEESE %s: %v", code, e)
		}
		rows = append(rows, batch...)
		expected = z.AddDate(0, 0, 1)
	}
	return rows, nil
}

var Sources = map[string]Source{"ibge": IBGE, "bcb": BCB, "anp": ANP, "dieese": DIEESE, "fjp": FJP}
