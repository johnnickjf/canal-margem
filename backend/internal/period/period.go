// Package period defines calendar periods independently of storage and transports.
package period

import (
	"fmt"
	"strconv"
	"time"
)

const Layout = "2006-01-02"

func Date(s string) (time.Time, error) { return time.Parse(Layout, s) }
func Month(y int, m time.Month) (time.Time, time.Time) {
	s := time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
	return s, s.AddDate(0, 1, -1)
}
func Code(code, frequency string) (time.Time, time.Time, error) {
	if len(code) != 4 && len(code) != 6 {
		return time.Time{}, time.Time{}, fmt.Errorf("código de período inválido")
	}
	y, e := strconv.Atoi(code[:4])
	if e != nil || y < 1 || y > 9999 {
		return time.Time{}, time.Time{}, fmt.Errorf("ano inválido")
	}
	if frequency == "annual" && len(code) == 4 {
		return time.Date(y, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(y, 12, 31, 0, 0, 0, 0, time.UTC), nil
	}
	if len(code) != 6 {
		return time.Time{}, time.Time{}, fmt.Errorf("período inválido")
	}
	n, e := strconv.Atoi(code[4:])
	if e != nil {
		return time.Time{}, time.Time{}, e
	}
	if frequency == "quarterly" && n >= 1 && n <= 4 {
		s, _ := Month(y, time.Month(n*3-2))
		_, end := Month(y, time.Month(n*3))
		return s, end, nil
	}
	if frequency == "monthly" && n >= 1 && n <= 12 {
		s, e := Month(y, time.Month(n))
		return s, e, nil
	}
	return time.Time{}, time.Time{}, fmt.Errorf("frequência ou período inválido")
}

type Window struct{ Start, End time.Time }

func NewWindow(start, end string, now time.Time) (Window, error) {
	s, e := Date(start)
	if e != nil {
		return Window{}, e
	}
	t, e := Date(end)
	if e != nil {
		return Window{}, e
	}
	today, _ := Date(now.Format(Layout))
	if start < "2012-01-01" || t.Before(s) || t.After(today) {
		return Window{}, fmt.Errorf("janela inválida")
	}
	return Window{s, t}, nil
}
func (w Window) Contains(s, e time.Time) bool { return !s.Before(w.Start) && !e.After(w.End) }
