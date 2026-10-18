package ingestion

import (
	"bytes"
	"fmt"
	"github.com/ledongthuc/pdf"
	"margem/backend/internal/catalog"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var capitals = map[string]string{"Rio Branco": "1200401", "Maceió": "2704302", "Macapá": "1600303", "Manaus": "1302603", "Salvador": "2927408", "Fortaleza": "2304400", "Brasília": "5300108", "Vitória": "3205309", "Goiânia": "5208707", "São Luís": "2111300", "Cuiabá": "5103403", "Campo Grande": "5002704", "Belo Horizonte": "3106200", "Belém": "1501402", "João Pessoa": "2507507", "Curitiba": "4106902", "Recife": "2611606", "Teresina": "2211001", "Rio de Janeiro": "3304557", "Natal": "2408102", "Porto Alegre": "4314902", "Porto Velho": "1100205", "Boa Vista": "1400100", "Florianópolis": "4205407", "São Paulo": "3550308", "Aracaju": "2800308", "Palmas": "1721000"}
var months = []string{"janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"}

func PDFPages(body []byte) (pages []string, err error) {
	defer func() {
		if recover() != nil {
			pages = nil
			err = observations.Invalid("PDF inválido")
		}
	}()
	if !bytes.HasPrefix(body, []byte("%PDF-")) {
		return nil, observations.Invalid("DIEESE: assinatura PDF ausente")
	}
	r, e := pdf.NewReader(bytes.NewReader(body), int64(len(body)))
	if e != nil {
		return nil, e
	}
	for i := 1; i <= min(8, r.NumPage()); i++ {
		text, e := extractPage(r.Page(i))
		if e != nil {
			return nil, e
		}
		pages = append(pages, text)
	}
	return pages, nil
}
func NormalizeBasket(body []byte, year, month int, w period.Window) ([]observations.Observation, error) {
	pages, e := PDFPages(body)
	if e != nil {
		return nil, e
	}
	return normalizeBasketPages(pages, canonical.Hash(body), year, month, w)
}
func normalizeBasketPages(pages []string, sha string, year, month int, w period.Window) ([]observations.Observation, error) {
	if month < 1 || month > 12 {
		return nil, observations.Invalid("DIEESE: mês inválido")
	}
	start, end, e := period.Code(fmt.Sprintf("%04d%02d", year, month), "monthly")
	if e != nil {
		return nil, e
	}
	if !w.Contains(start, end) {
		return nil, observations.Invalid("DIEESE: mês fora da janela")
	}
	text := strings.ReplaceAll(strings.Join(pages, "\n"), "\u00a0", " ")
	headings := regexp.MustCompile(`(?im)^[ \t]*TABELA\s*1[ \t]*$`).FindAllStringIndex(text, -1)
	if len(headings) != 1 {
		return nil, observations.Invalid("DIEESE: Tabela 1 ausente ou ambígua")
	}
	heading := headings[0]
	offset, page := 0, 0
	for i, p := range pages {
		if offset <= heading[0] && heading[0] < offset+len(p)+1 {
			page = i
			break
		}
		offset += len(p) + 1
	}
	table := strings.SplitN(text[heading[1]:], "Fonte:", 2)[0]
	if !regexp.MustCompile(fmt.Sprintf(`(?i)%s\s+(?:e\s+ano\s+)?(?:de\s+)?%d`, months[month-1], year)).MatchString(table) {
		return nil, observations.Invalid("DIEESE: mês da tabela divergente")
	}
	declared := regexp.MustCompile(`(?i)\b(\d{2})\s+capitais`).FindStringSubmatch(table)
	if declared == nil {
		return nil, observations.Invalid("DIEESE: cobertura não identificada")
	}
	expected, _ := strconv.Atoi(declared[1])
	if expected < 16 || expected > 27 || start.Format(period.Layout) >= "2025-07-01" && expected != 27 {
		return nil, observations.Invalid("DIEESE: cobertura inesperada")
	}
	names := []string{}
	for c := range capitals {
		names = append(names, c)
	}
	sort.Strings(names)
	alternatives := []string{}
	for _, c := range names {
		alternatives = append(alternatives, regexp.QuoteMeta(c))
	}
	// Some PDFs draw the numeric cells on the line following a wrapped capital.
	// Join only known capital labels followed by a numeric/missing source token.
	for _, capital := range names {
		parts := strings.Fields(capital)
		for i := range parts {
			parts[i] = regexp.QuoteMeta(parts[i])
		}
		wrapped := regexp.MustCompile(`(?m)^([ \t]*` + strings.Join(parts, `\s+`) + `(?:[ \t]*(?:\(\d+\)|\*))?)[ \t]*\n[ \t]*(-?\d|ND|-)`)
		table = wrapped.ReplaceAllString(table, `${1} ${2}`)
	}
	first := regexp.MustCompile(`(?m)^\s*(?:` + strings.Join(alternatives, "|") + `)\s+-?\d`).FindStringIndex(table)
	if first == nil {
		return nil, observations.Invalid("DIEESE: linhas ausentes")
	}
	header := table[:first[0]]
	if p := strings.Index(header, "Capital"); p >= 0 {
		header = header[p+len("Capital"):]
	}
	cost := regexp.MustCompile(`(?i)Valor\s+da\s+cesta`).FindStringIndex(header)
	if cost == nil {
		return nil, observations.Invalid("DIEESE: coluna de custo ausente")
	}
	costColumn := len(regexp.MustCompile(`(?i)Variação`).FindAllStringIndex(header[:cost[0]], -1))
	if costColumn > 2 {
		return nil, observations.Invalid("DIEESE: ordem das colunas desconhecida")
	}
	fieldRE := regexp.MustCompile(`-?\d{1,3}(?:\.\d{3})*,\d{1,2}|\(-\)|-`)
	timeRE := regexp.MustCompile(`(?i)(\d+)\s*h\s*(\d{1,2})\s*m`)
	missingRE := regexp.MustCompile(`^[\sNDA-]+$`)
	rows := []observations.Observation{}
	for _, capital := range names {
		parts := strings.Fields(capital)
		for i := range parts {
			parts[i] = regexp.QuoteMeta(parts[i])
		}
		pattern := `(?m)^[ \t]*` + strings.Join(parts, `\s+`) + `((?:[ \t]*(?:\(\d+\)|\*)|\d+))?[ \t]*([^\n]*)$`
		matches := regexp.MustCompile(pattern).FindAllStringSubmatch(table, -1)
		if len(matches) == 0 {
			continue
		}
		footnote, rest := matches[0][1], matches[0][2]
		for _, m := range matches {
			if strings.Join(strings.Fields(m[1]), " ") != strings.Join(strings.Fields(footnote), " ") || strings.Join(strings.Fields(m[2]), " ") != strings.Join(strings.Fields(rest), " ") {
				return nil, observations.Invalid("DIEESE: capital duplicada divergente: %s", capital)
			}
		}
		fields := fieldRE.FindAllString(rest, -1)
		missing := missingRE.MatchString(rest) || len(fields) == 0 && strings.TrimSpace(footnote) != ""
		context := map[string]any{}
		value := "..."
		if missing {
			context = map[string]any{"capital": capital, "source_symbol": strings.Join(strings.Fields(footnote+rest), " "), "missing_reason": "explicit-unavailable-in-source-table", "coverage": expected}
		} else {
			if len(fields) <= costColumn {
				return nil, observations.Invalid("DIEESE: custo ausente: %s", capital)
			}
			var e error
			value, e = observations.Decimal(fields[costColumn], true)
			if e != nil {
				return nil, e
			}
			t := timeRE.FindStringSubmatch(rest)
			if t == nil {
				return nil, observations.Invalid("DIEESE: tempo de confronto inválido: %s", capital)
			}
			minutes, _ := strconv.Atoi(t[2])
			if minutes >= 60 {
				return nil, observations.Invalid("DIEESE: tempo de confronto inválido")
			}
			segment := "legacy-pre2016"
			if start.Format(period.Layout) >= "2025-04-01" {
				segment = "partnership-2025"
			} else if year >= 2016 {
				segment = "legacy-2016"
			}
			var note any
			if n := strings.TrimSpace(footnote); n != "" {
				note = n
			}
			context = map[string]any{"capital": capital, "published_work_time": t[1] + "h" + t[2] + "m", "composition": "regional-release; Palmas/SaoLuis-product-comparison-unresolved", "coverage": expected, "source_footnote": note, "identical_source_row_repeated": len(matches) > 1, "method_segment": segment}
		}
		o, e := observations.New(catalog.ByID["cv4"], start, end, value, fmt.Sprintf("table1/page%d/%s", page+1, capital), context, "BR-city-"+capitals[capital], []string{sha})
		if e != nil {
			return nil, e
		}
		rows = append(rows, o)
	}
	observed := 0
	for _, o := range rows {
		if o.Status == "observed" {
			observed++
		}
	}
	if expected != observed && expected != len(rows) {
		return nil, observations.Invalid("DIEESE: %d/%d capitais extraídas", observed, expected)
	}
	for _, o := range rows {
		o.Context["table_observed_capitals"] = observed
		o.Context["table_total_rows"] = len(rows)
	}
	return rows, nil
}
