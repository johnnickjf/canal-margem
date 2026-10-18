package ingestion

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"github.com/ledongthuc/pdf"
	"io"
	"math"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf16"
)

// Extraction keeps text positions and honors ToUnicode even when Encoding has
// Differences. The library's convenience methods lose these properties for
// several historical DIEESE bulletins. Interpretation stays inside Go.
type pdfMatrix [3][3]float64

var identity = pdfMatrix{{1, 0, 0}, {0, 1, 0}, {0, 0, 1}}

func (a pdfMatrix) mul(b pdfMatrix) (z pdfMatrix) {
	for i := range 3 {
		for j := range 3 {
			for k := range 3 {
				z[i][j] += a[i][k] * b[k][j]
			}
		}
	}
	return z
}
func translation(x, y float64) pdfMatrix { return pdfMatrix{{1, 0, 0}, {0, 1, 0}, {x, y, 1}} }

func glyphWidth(font pdf.Font, code int) float64 {
	if font.V.Key("Subtype").Name() != "Type0" {
		return font.Width(code)
	}
	d := font.V.Key("DescendantFonts").Index(0)
	w := d.Key("W")
	for i := 0; i < w.Len(); {
		start := int(w.Index(i).Int64())
		i++
		next := w.Index(i)
		i++
		if next.Kind() == pdf.Array {
			if code >= start && code < start+next.Len() {
				return next.Index(code - start).Float64()
			}
		} else {
			end := int(next.Int64())
			width := w.Index(i).Float64()
			i++
			if code >= start && code <= end {
				return width
			}
		}
	}
	if d.Key("DW").IsNull() {
		return 1000
	}
	return d.Key("DW").Float64()
}

type textState struct {
	ctm, tm, lm                               pdfMatrix
	font                                      pdf.Font
	size, scale, leading, spacing, word, rise float64
	decode                                    func(string) string
}

func unicodeText(s string) (string, error) {
	b, e := hex.DecodeString(s)
	if e != nil || len(b)%2 != 0 {
		return "", fmt.Errorf("ToUnicode inválido")
	}
	u := make([]uint16, len(b)/2)
	for i := range u {
		u[i] = binary.BigEndian.Uint16(b[i*2:])
	}
	return string(utf16.Decode(u)), nil
}
func fontDecoder(f *pdf.Font) (func(string) string, error) {
	fallback := f.Encoder().Decode
	toUnicode := f.V.Key("ToUnicode")
	if f.V.Key("Encoding").Kind() != pdf.Dict || toUnicode.Kind() != pdf.Stream {
		return fallback, nil
	}
	stream := toUnicode.Reader()
	defer stream.Close()
	body, e := io.ReadAll(io.LimitReader(stream, 4<<20+1))
	if e != nil {
		return nil, e
	}
	if len(body) > 4<<20 {
		return nil, fmt.Errorf("ToUnicode excede limite")
	}
	mapping := map[byte]string{}
	for _, block := range regexp.MustCompile(`(?s)beginbfchar(.*?)endbfchar`).FindAllStringSubmatch(string(body), -1) {
		for _, pair := range regexp.MustCompile(`<([0-9a-fA-F]{2})>\s*<([0-9a-fA-F]+)>`).FindAllStringSubmatch(block[1], -1) {
			code, _ := strconv.ParseUint(pair[1], 16, 8)
			s, e := unicodeText(pair[2])
			if e != nil {
				return nil, e
			}
			mapping[byte(code)] = s
		}
	}
	for _, block := range regexp.MustCompile(`(?s)beginbfrange(.*?)endbfrange`).FindAllStringSubmatch(string(body), -1) {
		for _, rangeText := range regexp.MustCompile(`(?s)<([0-9a-fA-F]{2})>\s*<([0-9a-fA-F]{2})>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])`).FindAllStringSubmatch(block[1], -1) {
			a, _ := strconv.ParseUint(rangeText[1], 16, 8)
			b, _ := strconv.ParseUint(rangeText[2], 16, 8)
			if b < a {
				return nil, fmt.Errorf("ToUnicode: intervalo inválido")
			}
			if rangeText[4] != "" {
				start, e := hex.DecodeString(rangeText[4])
				if e != nil || len(start) == 0 {
					return nil, fmt.Errorf("ToUnicode inválido")
				}
				for c := a; c <= b; c++ {
					v := append([]byte{}, start...)
					carry := c - a
					for i := len(v) - 1; i >= 0 && carry > 0; i-- {
						n := uint64(v[i]) + carry
						v[i] = byte(n)
						carry = n >> 8
					}
					s, e := unicodeText(hex.EncodeToString(v))
					if e != nil {
						return nil, e
					}
					mapping[byte(c)] = s
				}
			} else {
				values := regexp.MustCompile(`<([0-9a-fA-F]+)>`).FindAllStringSubmatch(rangeText[5], -1)
				if len(values) != int(b-a+1) {
					return nil, fmt.Errorf("ToUnicode: tamanho divergente")
				}
				for i, v := range values {
					s, e := unicodeText(v[1])
					if e != nil {
						return nil, e
					}
					mapping[byte(a)+byte(i)] = s
				}
			}
		}
	}
	if len(mapping) == 0 {
		return nil, fmt.Errorf("ToUnicode sem mapa compatível")
	}
	return func(raw string) string {
		var s strings.Builder
		for _, c := range []byte(raw) {
			if v, ok := mapping[c]; ok {
				s.WriteString(v)
			} else {
				s.WriteString(fallback(string([]byte{c})))
			}
		}
		return s.String()
	}, nil
}
func extractPage(page pdf.Page) (string, error) {
	state := textState{ctm: identity, tm: identity, lm: identity, scale: 1}
	stack := []textState{}
	var text strings.Builder
	var lastX, lastY, lastWidth, lastSize float64
	haveLast := false
	var failure error
	glyphs := 0
	emit := func(raw string) {
		if failure != nil {
			return
		}
		if state.decode == nil {
			failure = fmt.Errorf("PDF: fonte ausente")
			return
		}
		step := 1
		if state.font.V.Key("Subtype").Name() == "Type0" {
			step = 2
		}
		if len(raw)%step != 0 {
			failure = fmt.Errorf("PDF: código multibyte incompleto")
			return
		}
		for offset := 0; offset < len(raw); offset += step {
			code := int(raw[offset])
			if step == 2 {
				code = int(binary.BigEndian.Uint16([]byte(raw[offset : offset+step])))
			}
			c := code
			glyphs++
			if glyphs > 2_000_000 {
				failure = fmt.Errorf("PDF: texto excede limite")
				return
			}
			glyph := state.decode(raw[offset : offset+step])

			m := pdfMatrix{{state.size * state.scale, 0, 0}, {0, state.size, 0}, {0, state.rise, 1}}.mul(state.tm).mul(state.ctm)
			x, y := m[2][0], m[2][1]
			width := glyphWidth(state.font, c) / 1000 * math.Abs(m[0][0])
			if haveLast {
				if math.Abs(y-lastY) > math.Max(4, math.Abs(lastSize)*0.45) {
					text.WriteByte('\n')
				} else if x-lastX-lastWidth > 1.5 {
					text.WriteByte(' ')
				}
			}
			text.WriteString(glyph)
			lastX, lastY, lastWidth, lastSize = x, y, width, math.Abs(m[1][1])
			haveLast = true
			move := glyphWidth(state.font, c)/1000*state.size + state.spacing
			if c == ' ' {
				move += state.word
			}
			state.tm = translation(move*state.scale, 0).mul(state.tm)
		}
	}
	nextLine := func() { state.lm = translation(0, -state.leading).mul(state.lm); state.tm = state.lm }
	pdf.Interpret(page.V.Key("Contents"), func(s *pdf.Stack, op string) {
		args := make([]pdf.Value, s.Len())
		for i := len(args) - 1; i >= 0; i-- {
			args[i] = s.Pop()
		}
		if failure != nil {
			return
		}
		require := func(n int) bool {
			if len(args) != n {
				failure = fmt.Errorf("PDF: operador %s inválido", op)
				return false
			}
			return true
		}
		switch op {
		case "q":
			stack = append(stack, state)
		case "Q":
			if len(stack) == 0 {
				failure = fmt.Errorf("PDF: pilha gráfica inválida")
				return
			}
			state = stack[len(stack)-1]
			stack = stack[:len(stack)-1]
		case "cm":
			if !require(6) {
				return
			}
			m := identity
			for i := range 6 {
				m[i/2][i%2] = args[i].Float64()
			}
			state.ctm = m.mul(state.ctm)
		case "BT":
			state.tm = identity
			state.lm = identity
		case "Tf":
			if !require(2) {
				return
			}
			state.font = page.Font(args[0].Name())
			state.size = args[1].Float64()
			state.decode, failure = fontDecoder(&state.font)
		case "Tm":
			if !require(6) {
				return
			}
			m := identity
			for i := range 6 {
				m[i/2][i%2] = args[i].Float64()
			}
			state.tm = m
			state.lm = m
		case "Td", "TD":
			if !require(2) {
				return
			}
			if op == "TD" {
				state.leading = -args[1].Float64()
			}
			state.lm = translation(args[0].Float64(), args[1].Float64()).mul(state.lm)
			state.tm = state.lm
		case "T*":
			nextLine()
		case "TL":
			if require(1) {
				state.leading = args[0].Float64()
			}
		case "Tc":
			if require(1) {
				state.spacing = args[0].Float64()
			}
		case "Tw":
			if require(1) {
				state.word = args[0].Float64()
			}
		case "Tz":
			if require(1) {
				state.scale = args[0].Float64() / 100
			}
		case "Ts":
			if require(1) {
				state.rise = args[0].Float64()
			}
		case "Tj":
			if require(1) {
				emit(args[0].RawString())
			}
		case "TJ":
			if !require(1) {
				return
			}
			v := args[0]
			for i := 0; i < v.Len(); i++ {
				x := v.Index(i)
				if x.Kind() == pdf.String {
					emit(x.RawString())
				} else {
					state.tm = translation(-x.Float64()/1000*state.size*state.scale, 0).mul(state.tm)
				}
			}
		case "'":
			if require(1) {
				nextLine()
				emit(args[0].RawString())
			}
		case "\"":
			if require(3) {
				state.word = args[0].Float64()
				state.spacing = args[1].Float64()
				nextLine()
				emit(args[2].RawString())
			}
		}
	})
	return text.String(), failure
}
