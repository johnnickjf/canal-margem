// Package canonical preserves the content identities used by the original pipelines.
package canonical

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"strings"
)

func Bytes(v any) ([]byte, error) {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	if err := e.Encode(v); err != nil {
		return nil, err
	}
	// Normalize structs through JSON so nested records sort keys just like maps.
	var value any
	if err := Decode(b.Bytes(), &value); err != nil {
		return nil, err
	}
	b.Reset()
	if err := e.Encode(value); err != nil {
		return nil, err
	}
	// Python's ensure_ascii=False also leaves these Unicode separators literal.
	s := strings.TrimSuffix(b.String(), "\n")
	s = unescapeSeparators(s)
	return []byte(s), nil
}
func Hash(body []byte) string { h := sha256.Sum256(body); return hex.EncodeToString(h[:]) }
func Digest(v any) (string, error) {
	b, e := Bytes(v)
	if e != nil {
		return "", e
	}
	return Hash(b), nil
}
func Decode(body []byte, target any) error {
	d := json.NewDecoder(bytes.NewReader(body))
	d.UseNumber()
	if err := d.Decode(target); err != nil {
		return err
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		if err != nil {
			return err
		}
		return errors.New("conteúdo JSON extra")
	}
	return nil
}

// Only genuine JSON Unicode escapes are replaced; literal backslash-u strings
// must retain their escaping and therefore their original content identity.
func unescapeSeparators(s string) string {
	var out strings.Builder
	for i := 0; i < len(s); {
		if s[i] != '\\' {
			out.WriteByte(s[i])
			i++
			continue
		}
		j := i
		for j < len(s) && s[j] == '\\' {
			j++
		}
		if (j-i)%2 == 1 && j+5 <= len(s) && (s[j:j+5] == "u2028" || s[j:j+5] == "u2029") {
			out.WriteString(s[i : j-1])
			if s[j:j+5] == "u2028" {
				out.WriteRune('\u2028')
			} else {
				out.WriteRune('\u2029')
			}
			i = j + 5
		} else {
			out.WriteString(s[i:j])
			i = j
		}
	}
	return out.String()
}
