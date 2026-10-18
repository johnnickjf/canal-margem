package ingestion

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"github.com/extrame/xls"
	"github.com/shopspring/decimal"
	"github.com/xuri/excelize/v2"
	"golang.org/x/net/html"
	"golang.org/x/text/unicode/norm"
	"io"
	"margem/backend/internal/catalog"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

//go:embed files.json
var filesJSON []byte
var fileURLs map[string]string

func init() {
	if e := json.Unmarshal(filesJSON, &fileURLs); e != nil {
		panic(e)
	}
}

const ANPIndex = "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos"
const FJPIndex = "https://fjp.mg.gov.br/deficit-habitacional-no-brasil/"

func normalized(s string) string {
	var b strings.Builder
	for _, r := range norm.NFKD.String(s) {
		if r < 128 {
			b.WriteRune(unicode.ToUpper(r))
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}
func Links(body []byte, base string) (map[string]bool, error) {
	if !utf8.Valid(body) {
		r := make([]rune, len(body))
		for i, b := range body {
			r[i] = rune(b)
		}
		body = []byte(string(r))
	}
	u, e := url.Parse(base)
	if e != nil {
		return nil, e
	}
	doc, e := html.Parse(bytes.NewReader(body))
	if e != nil {
		return nil, e
	}
	out := map[string]bool{}
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "a" {
			for _, a := range n.Attr {
				if a.Key == "href" && a.Val != "" {
					v, e := url.Parse(a.Val)
					if e == nil {
						out[u.ResolveReference(v).String()] = true
					}
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return out, nil
}
func checkZIP(body []byte) (*zip.Reader, error) {
	r, e := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if e != nil {
		return nil, observations.Invalid("ZIP inválido")
	}
	var size uint64
	for _, f := range r.File {
		if f.UncompressedSize64 > 128<<20 || size > 128<<20-f.UncompressedSize64 {
			return nil, observations.Invalid("arquivo descompactado excede 128 MiB")
		}
		size += f.UncompressedSize64
	}
	return r, nil
}
func openXLSX(body []byte) (*excelize.File, error) {
	if !bytes.HasPrefix(body, []byte("PK")) {
		return nil, observations.Invalid("assinatura XLSX ausente")
	}
	if _, e := checkZIP(body); e != nil {
		return nil, e
	}
	return excelize.OpenReader(bytes.NewReader(body), excelize.Options{RawCellValue: true, UnzipSizeLimit: 128 << 20, UnzipXMLSizeLimit: 16 << 20})
}
func rawCell(b *excelize.File, sheet, cell string) (string, error) {
	return b.GetCellValue(sheet, cell, excelize.Options{RawCellValue: true})
}
func numericCell(b *excelize.File, sheet, cell string) (string, error) {
	t, e := b.GetCellType(sheet, cell)
	if e != nil {
		return "", e
	}
	if t != excelize.CellTypeNumber && t != excelize.CellTypeUnset {
		return "", observations.Invalid("célula numérica inválida: %s", cell)
	}
	v, e := rawCell(b, sheet, cell)
	if e != nil {
		return "", e
	}
	return observations.Decimal(v, false)
}
func dateCell(b *excelize.File, sheet, cell string) (time.Time, error) {
	v, e := numericCell(b, sheet, cell)
	if e != nil {
		return time.Time{}, e
	}
	id, e := b.GetCellStyle(sheet, cell)
	if e != nil {
		return time.Time{}, e
	}
	style, e := b.GetStyle(id)
	if e != nil {
		return time.Time{}, e
	}
	isDate := style.NumFmt >= 14 && style.NumFmt <= 22 || style.NumFmt >= 27 && style.NumFmt <= 36 || style.NumFmt >= 45 && style.NumFmt <= 47 || style.NumFmt >= 50 && style.NumFmt <= 58
	if style.CustomNumFmt != nil {
		f := strings.ToLower(*style.CustomNumFmt)
		isDate = strings.Contains(f, "d") && strings.Contains(f, "y")
	}
	if !isDate {
		return time.Time{}, observations.Invalid("ANP: célula sem formato de data")
	}
	props, e := b.GetWorkbookProps()
	if e != nil {
		return time.Time{}, e
	}
	date1904 := props.Date1904 != nil && *props.Date1904
	n, e := strconv.ParseFloat(v, 64)
	if e != nil {
		return time.Time{}, e
	}
	t, e := excelize.ExcelDateToTime(n, date1904)
	if e != nil {
		return time.Time{}, e
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), nil
}
func NormalizeANP(body []byte, sheet string, w period.Window) ([]observations.Observation, error) {
	b, e := openXLSX(body)
	if e != nil {
		return nil, e
	}
	defer b.Close()
	names := b.GetSheetList()
	if len(names) != 1 || names[0] != sheet {
		return nil, observations.Invalid("ANP: abas inesperadas")
	}
	all, e := b.GetRows(sheet, excelize.Options{RawCellValue: true})
	if e != nil {
		return nil, e
	}
	var columns map[string]int
	out := []observations.Observation{}
	for ri, row := range all {
		header := false
		for _, v := range row {
			if v == "DATA INICIAL" {
				header = true
			}
		}
		if header {
			if columns != nil {
				return nil, observations.Invalid("ANP: cabeçalho duplicado")
			}
			columns = map[string]int{}
			for i, v := range row {
				if v != "" {
					columns[normalized(v)] = i + 1
				}
			}
			for _, c := range []string{"DATA INICIAL", "DATA FINAL", "PRODUTO", "UNIDADE DE MEDIDA", "PRECO MEDIO REVENDA", "PRECO MINIMO REVENDA", "PRECO MAXIMO REVENDA", "NUMERO DE POSTOS PESQUISADOS"} {
				if columns[c] == 0 {
					return nil, observations.Invalid("ANP: cabeçalho alterado")
				}
			}
			continue
		}
		if columns == nil {
			continue
		}
		cell := func(name string) string { c, _ := excelize.CoordinatesToCellName(columns[name], ri+1); return c }
		value := func(name string) string {
			col := columns[name] - 1
			if col >= len(row) {
				return ""
			}
			return row[col]
		}
		number := func(name string) (string, error) { return numericCell(b, sheet, cell(name)) }
		if value("PRODUTO") != "GASOLINA COMUM" {
			continue
		}
		start, e := dateCell(b, sheet, cell("DATA INICIAL"))
		if e != nil {
			return nil, e
		}
		end, e := dateCell(b, sheet, cell("DATA FINAL"))
		if e != nil {
			return nil, e
		}
		if end.Sub(start) != 6*24*time.Hour {
			return nil, observations.Invalid("ANP: semana não tem sete dias")
		}
		if !w.Contains(start, end) {
			continue
		}
		if normalized(value("UNIDADE DE MEDIDA")) != "R$/L" {
			return nil, observations.Invalid("ANP: unidade divergente")
		}
		price, e := number("PRECO MEDIO REVENDA")
		if e != nil {
			return nil, e
		}
		low, e := number("PRECO MINIMO REVENDA")
		if e != nil {
			return nil, e
		}
		high, e := number("PRECO MAXIMO REVENDA")
		if e != nil {
			return nil, e
		}
		posts, e := number("NUMERO DE POSTOS PESQUISADOS")
		if e != nil {
			return nil, e
		}
		p, _ := decimal.NewFromString(price)
		l, _ := decimal.NewFromString(low)
		h, _ := decimal.NewFromString(high)
		n, _ := decimal.NewFromString(posts)
		if n.Sign() <= 0 || !n.Equal(n.Truncate(0)) || l.GreaterThan(p) || h.LessThan(p) {
			return nil, observations.Invalid("ANP: postos ou preços incoerentes")
		}
		o, e := observations.New(catalog.ByID["cv3"], start, end, price, sheet+"!"+cell("PRECO MEDIO REVENDA"), map[string]any{"sampled_stations": posts, "min": low, "max": high, "comparison_note": "2017-07-30/2017-12-30: compare interleaved weeks; 2020 interruption; sample changes 2015/2022"}, "BR", []string{canonical.Hash(body)})
		if e != nil {
			return nil, e
		}
		out = append(out, o)
	}
	if columns == nil {
		return nil, observations.Invalid("ANP: cabeçalho ausente")
	}
	return out, nil
}
func NormalizeFJP(body []byte, edition string, w period.Window) ([]observations.Observation, error) {
	b, e := openXLSX(body)
	if e != nil {
		return nil, e
	}
	defer b.Close()
	legacy := edition == "2016-2019-reweighted-2023"
	sheet := "DH_Componentes"
	if legacy {
		sheet = "Ônus"
	}
	get := func(cell string) string { v, _ := rawCell(b, sheet, cell); return v }
	coords := []struct{ year, row, col int }{}
	if legacy {
		for i, v := range []string{"Ano", "DH", "Região", "Contagem"} {
			c, _ := excelize.CoordinatesToCellName(i+1, 1)
			if get(c) != v {
				return nil, observations.Invalid("FJP: cabeçalho alterado")
			}
		}
		for i, r := range []int{55, 109, 163, 217} {
			coords = append(coords, struct{ year, row, col int }{2016 + i, r, 4})
		}
	} else {
		if get("I1") != "Ônus" || get("A1") != "Ano" {
			return nil, observations.Invalid("FJP: componente alterado")
		}
		y, e := strconv.Atoi(edition)
		if e != nil {
			return nil, e
		}
		coords = append(coords, struct{ year, row, col int }{y, 56, 9})
	}
	rows := []observations.Observation{}
	for _, c := range coords {
		geoCol := "B"
		if legacy {
			geoCol = "C"
		}
		yearValue, _ := observations.Decimal(get(fmt.Sprintf("A%d", c.row)), false)
		if yearValue != strconv.Itoa(c.year) || get(fmt.Sprintf("%s%d", geoCol, c.row)) != "Brasil" {
			return nil, observations.Invalid("FJP: ano/território divergente")
		}
		start, end, e := period.Code(strconv.Itoa(c.year), "annual")
		if e != nil {
			return nil, e
		}
		if !w.Contains(start, end) {
			continue
		}
		cell, _ := excelize.CoordinatesToCellName(c.col, c.row)
		value, e := numericCell(b, sheet, cell)
		if e != nil {
			return nil, e
		}
		o, e := observations.New(catalog.ByID["cv6"], start, end, value, sheet+"!"+cell, map[string]any{"edition": edition, "comparability": "segmented-no-automatic-splice", "universe": "urban-income-up-to-3-minimums-rent-over30pct-hierarchy"}, "BR", []string{canonical.Hash(body)})
		if e != nil {
			return nil, e
		}
		rows = append(rows, o)
	}
	return rows, nil
}
func NormalizePoverty(body []byte, w period.Window) (out []observations.Observation, err error) {
	// The legacy XLS parser uses panic internally on malformed BIFF records.
	defer func() {
		if recover() != nil {
			out = nil
			err = observations.Invalid("SIS: XLS inválido")
		}
	}()
	r, e := checkZIP(body)
	if e != nil {
		return nil, e
	}
	const member = "Tabela 2.18 (Pobr_Geo).xls"
	var data []byte
	for _, f := range r.File {
		if f.Name == member {
			if data != nil {
				return nil, observations.Invalid("SIS: membro duplicado")
			}
			s, e := f.Open()
			if e != nil {
				return nil, e
			}
			data, e = io.ReadAll(io.LimitReader(s, 128<<20+1))
			s.Close()
			if e != nil {
				return nil, e
			}
		}
	}
	if data == nil {
		return nil, observations.Invalid("SIS: XLS ausente")
	}
	book, e := xls.OpenReader(bytes.NewReader(data), "utf-8")
	if e != nil {
		return nil, e
	}
	for year := 2012; year <= 2024; year++ {
		start, end, _ := period.Code(strconv.Itoa(year), "annual")
		if !w.Contains(start, end) {
			continue
		}
		var sheet *xls.WorkSheet
		for i := 0; i < book.NumSheets(); i++ {
			s := book.GetSheet(i)
			if s != nil && s.Name == strconv.Itoa(year) {
				if sheet != nil {
					return nil, observations.Invalid("SIS: ano ambíguo")
				}
				sheet = s
			}
		}
		if sheet == nil || sheet.Row(6) == nil || sheet.Row(3) == nil || sheet.Row(6).Col(0) != "Brasil" {
			return nil, observations.Invalid("SIS: território divergente")
		}
		header := normalized(sheet.Row(3).Col(4))
		if !strings.Contains(header, "6,85") || !strings.Contains(header, "2017") {
			return nil, observations.Invalid("SIS: linha/PPC alterada")
		}
		o, e := observations.New(catalog.ByID["qv1"], start, end, sheet.Row(6).Col(4), fmt.Sprintf("%s/%d!E7", member, year), map[string]any{"edition": "SIS-2025", "ppp": "2017", "poverty_line_usd_day": "6.85", "visits": "first", "xls_numeric_encoding": "IEEE754-original-in-raw"}, "BR", []string{canonical.Hash(body)})
		if e != nil {
			return nil, e
		}
		out = append(out, o)
	}
	return out, nil
}
