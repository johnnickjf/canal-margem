package canonical

import (
	"strings"
	"testing"
)

func TestNestedStructsSortKeysAndPreserveUTF8(t *testing.T) {
	type file struct {
		Z int    `json:"z"`
		A string `json:"a"`
	}
	got, e := Bytes(map[string]any{"files": []file{{Z: 1, A: "São <Paulo> & \u2028"}}})
	if e != nil {
		t.Fatal(e)
	}
	want := "{\"files\":[{\"a\":\"São <Paulo> & \u2028\",\"z\":1}]}"
	if string(got) != want {
		t.Fatalf("%s != %s", got, want)
	}
	var value any
	if e := Decode([]byte(`{"value":3587776.79721440001}`), &value); e != nil {
		t.Fatal(e)
	}
	got, e = Bytes(value)
	if e != nil || !strings.Contains(string(got), "3587776.79721440001") {
		t.Fatal(string(got), e)
	}
}

func TestLiteralUnicodeEscapeAndTrailingJSON(t *testing.T) {
	input := `literal \u2028 and \u2029`
	b, e := Bytes(input)
	if e != nil {
		t.Fatal(e)
	}
	var got string
	if e = Decode(b, &got); e != nil || got != input {
		t.Fatal(string(b), got, e)
	}
	var value any
	for _, b := range []string{`{} {}`, `{}garbage`} {
		if e = Decode([]byte(b), &value); e == nil {
			t.Fatal("aceitou JSON concatenado")
		}
	}
}
