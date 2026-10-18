package ingestion

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"github.com/xuri/excelize/v2"
	"margem/backend/internal/catalog"
	"margem/backend/internal/observations"
	"margem/backend/internal/period"
	"margem/backend/internal/platform/canonical"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func testWindow() period.Window {
	w, _ := period.NewWindow("2012-01-01", "2026-09-30", time.Now())
	return w
}
func TestOfficialIBGEJSONAndMetadata(t *testing.T) {
	base := "../../../docs/systems/evidence/ingestion"
	body, e := os.ReadFile(filepath.Join(base, "tr4.json.raw"))
	if e != nil {
		t.Fatal(e)
	}
	meta, e := os.ReadFile(filepath.Join(base, "tr4-metadata.json.raw"))
	if e != nil {
		t.Fatal(e)
	}
	var data ibgeResponse
	json.Unmarshal(body, &data)
	codes := []string{}
	for c := range data[0].Results[0].Series[0].Values {
		codes = append(codes, c)
	}
	rows, e := NormalizeIBGE(body, meta, catalog.ByID["tr4"], codes, []string{"raw", "meta"})
	if e != nil || len(rows) != len(codes) {
		t.Fatal(len(rows), e)
	}
	for _, mutate := range []func(ibgeResponse){func(d ibgeResponse) { d[0].ID = "999" }, func(d ibgeResponse) { d[0].Unit = "BRL" }, func(d ibgeResponse) { d[0].Results[0].Series[0].Location.ID = "35" }} {
		var changed ibgeResponse
		json.Unmarshal(body, &changed)
		mutate(changed)
		b, _ := json.Marshal(changed)
		if _, e = NormalizeIBGE(b, meta, catalog.ByID["tr4"], codes, nil); e == nil {
			t.Fatal("aceitou recorte inválido")
		}
	}
	if _, e = NormalizeIBGE(body, meta, catalog.ByID["tr4"], append(codes, codes[0]), nil); e == nil {
		t.Fatal("período duplicado")
	}
}
func TestBCBRejectsGapsSymbolsAndWrongDay(t *testing.T) {
	w, _ := period.NewWindow("2025-01-01", "2025-12-31", time.Now())
	for _, b := range []string{`[]`, `[{"data":"02/01/2025","valor":"1"}]`, `[{"data":"01/01/2025","valor":"-"}]`, `[{"data":"01/01/2025","valor":"0"}]`, `[{"data":"01/02/2025","valor":"1320"}]`, `[{"data":"01/01/2025","valor":"1302"},{"data":"01/03/2025","valor":"1320"}]`, `[{"data":"01/01/2025","valor":1302}]`} {
		if _, e := NormalizeBCB([]byte(b), catalog.ByID["minimum-nominal"], w, nil); e == nil {
			t.Fatalf("aceitou %s", b)
		}
	}
}

//go:embed basket-pages_test.json
var basketFixtures []byte

func TestBasketHistoricalLayouts(t *testing.T) {
	var fixtures map[string]struct {
		Pages []string `json:"pages"`
	}
	if e := json.Unmarshal(basketFixtures, &fixtures); e != nil {
		t.Fatal(e)
	}
	for code, f := range fixtures {
		t.Run(code, func(t *testing.T) {
			y, _ := strconv.Atoi(code[:4])
			m, _ := strconv.Atoi(code[4:])
			rows, e := normalizeBasketPages(f.Pages, "fixture", y, m, testWindow())
			if e != nil {
				t.Fatal(e)
			}
			if e = observations.Validate(rows); e != nil {
				t.Fatal(e)
			}
			if code == "201905" {
				for _, o := range rows {
					if o.Geography == "BR-city-3550308" && (*o.Value != "507.07" || o.Context["identical_source_row_repeated"] != true) {
						t.Fatal(o)
					}
				}
			}
			if code == "202105" {
				for _, o := range rows {
					if o.Geography == "BR-city-3106200" && o.Status != "missing" {
						t.Fatal(o)
					}
				}
			}
		})
	}
	f := fixtures["202609"]
	if _, e := normalizeBasketPages(f.Pages, "fixture", 2026, 8, testWindow()); e == nil {
		t.Fatal("mês divergente aceito")
	}
	bad := []string{strings.ReplaceAll(strings.Join(f.Pages, "\n"), "São Paulo 922,51", "Unknown 922,51")}
	if _, e := normalizeBasketPages(bad, "fixture", 2026, 9, testWindow()); e == nil {
		t.Fatal("capital ausente aceita")
	}
	if _, e := NormalizeBasket([]byte("<html>blocked</html>"), 2026, 9, testWindow()); e == nil {
		t.Fatal("HTML aceito como PDF")
	}
}
func workbook(t *testing.T, sheet string, cells map[string]any) []byte {
	t.Helper()
	b := excelize.NewFile()
	b.SetSheetName("Sheet1", sheet)
	defer b.Close()
	for cell, v := range cells {
		if e := b.SetCellValue(sheet, cell, v); e != nil {
			t.Fatal(e)
		}
	}
	body, e := b.WriteToBuffer()
	if e != nil {
		t.Fatal(e)
	}
	return body.Bytes()
}
func TestFJPFractionalEstimatesAndScope(t *testing.T) {
	cells := map[string]any{"A1": "Ano", "I1": "Ônus", "A56": 2024, "B56": "Brasil", "I56": "3587776.79721440001"}
	b, e := excelize.OpenReader(bytes.NewReader(workbook(t, "DH_Componentes", cells)))
	if e != nil {
		t.Fatal(e)
	}
	defer b.Close()
	if e = b.SetCellDefault("DH_Componentes", "I56", "3587776.79721440001"); e != nil {
		t.Fatal(e)
	}
	body, _ := b.WriteToBuffer()
	rows, e := NormalizeFJP(body.Bytes(), "2024", testWindow())
	if e != nil || len(rows) != 1 || *rows[0].Value != "3587776.79721440001" {
		t.Fatal(rows, e)
	}
	for _, edit := range []map[string]any{{"B56": "Sudeste"}, {"I1": "Percentual"}, {"A56": 2023}, {"I56": -1}} {
		copy := map[string]any{}
		for k, v := range cells {
			copy[k] = v
		}
		copy["I56"] = 10
		for k, v := range edit {
			copy[k] = v
		}
		if _, e := NormalizeFJP(workbook(t, "DH_Componentes", copy), "2024", testWindow()); e == nil {
			t.Fatal(edit)
		}
	}
}
func TestDiscoveryAndAllowedURLs(t *testing.T) {
	body := []byte("<a href='/2025/boletim.pdf?x=1&amp;y=2'>S\xe3o Paulo</a>")
	links, e := Links(body, "https://www.dieese.org.br/")
	if e != nil || !links["https://www.dieese.org.br/2025/boletim.pdf?x=1&y=2"] {
		t.Fatal(links, e)
	}
	for _, u := range []string{"http://api.bcb.gov.br/a", "https://evil.example/a", "https://user@api.bcb.gov.br/a", "https://api.bcb.gov.br:9000/a", "https://api.bcb.gov.br.evil.example/a"} {
		if allowedURL(u) {
			t.Fatal(u)
		}
	}
	if !allowedURL("https://api.bcb.gov.br/a") {
		t.Fatal("fonte bloqueada")
	}
}
func minimalPDF(objects []string) []byte {
	var b bytes.Buffer
	b.WriteString("%PDF-1.4\n")
	offsets := []int{0}
	for i, o := range objects {
		offsets = append(offsets, b.Len())
		fmt.Fprintf(&b, "%d 0 obj\n%s\nendobj\n", i+1, o)
	}
	xref := b.Len()
	fmt.Fprintf(&b, "xref\n0 %d\n0000000000 65535 f \n", len(offsets))
	for _, offset := range offsets[1:] {
		fmt.Fprintf(&b, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&b, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets), xref)
	return b.Bytes()
}
func pdfStream(text string) string {
	return fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(text), text)
}
func TestPDFToUnicodeAndPositionedCells(t *testing.T) {
	cmap := "1 beginbfrange\n<01><02><0041>\nendbfrange"
	content := "BT /F1 12 Tf 1 0 0 1 20 100 Tm <0102> Tj 1 0 0 1 80 100 Tm (12.3) Tj ET"
	objects := []string{"<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Count 1 /Kids [3 0 R] >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 0 /LastChar 255 /Encoding << /Differences [1 /g115 /g349] >> /ToUnicode 6 0 R >>", pdfStream(content), pdfStream(cmap)}
	pages, e := PDFPages(minimalPDF(objects))
	if e != nil || len(pages) != 1 || !strings.Contains(pages[0], "AB") {
		t.Fatal(pages, e)
	}
	if canonical.Hash(minimalPDF(objects)) == "" {
		t.Fatal("hash ausente")
	}
}

func TestBasketKeepsSingleDecimalAndMissingRateColumns(t *testing.T) {
	var fixtures map[string]struct {
		Pages []string `json:"pages"`
	}
	if e := json.Unmarshal(basketFixtures, &fixtures); e != nil {
		t.Fatal(e)
	}
	for _, tt := range []struct{ code, city, want string }{{"201211", "Rio de Janeiro", "272.1"}, {"201403", "João Pessoa", "263.17"}, {"201403", "Florianópolis", "345.63"}, {"201403", "Vitória", "343.7"}, {"201912", "Brasília", "473.9"}} {
		y, _ := strconv.Atoi(tt.code[:4])
		m, _ := strconv.Atoi(tt.code[4:])
		rows, e := normalizeBasketPages(fixtures[tt.code].Pages, "fixture", y, m, testWindow())
		if e != nil {
			t.Fatal(e)
		}
		found := false
		for _, o := range rows {
			if o.Context["capital"] == tt.city {
				found = true
				if o.Value == nil || *o.Value != tt.want {
					t.Fatalf("%s %s: %v, wanted %s", tt.code, tt.city, o.Value, tt.want)
				}
			}
		}
		if !found {
			t.Fatal(tt)
		}
	}
}
