package api

import "math/big"

type assessment struct {
	Version   string `json:"version"`
	Status    string `json:"status"`
	Direction string `json:"direction"`
	Rule      string `json:"rule"`
}

// material-v1 is an explicit reading of a measure, never a theme score or a
// causal judgment. Keep these rules immutable; changes require another version.
func materialAssessment(series string, previous, current *string) assessment {
	a := assessment{Version: "material-v1", Status: "insufficient_data", Direction: "unavailable", Rule: "Sem dois períodos observados e comparáveis, não há conclusão."}
	if previous == nil || current == nil {
		return a
	}
	p, okP := new(big.Rat).SetString(*previous)
	c, okC := new(big.Rat).SetString(*current)
	if !okP || !okC {
		return a
	}
	direction := c.Cmp(p)
	a.Direction = map[int]string{-1: "down", 0: "flat", 1: "up"}[direction]
	preference := -1
	switch series {
	case "tr1", "tr2":
		preference = 1
		a.Rule = "Maior renda real representa maior poder de compra nesta medida; não descreve sua distribuição."
	case "tr4":
		a.Rule = "Menor taxa de desocupação é favorável nesta medida; participação e qualidade do trabalho exigem leitura conjunta."
	case "tr5":
		a.Rule = "Menor taxa de informalidade é favorável nesta medida; não resume renda ou qualidade das ocupações."
	case "cv5", "price-income":
		a.Rule = "Menor parcela do salário mínimo ou tempo equivalente para comprar a mesma cesta é favorável nesta medida."
	case "vf1", "vf2":
		a.Rule = "Menor comprometimento da renda ou inadimplência é favorável nesta medida; acesso ao crédito exige contexto."
	case "qv1", "qv2", "qv3":
		a.Rule = "Menor pobreza, desigualdade ou insegurança alimentar é favorável na medida selecionada, mantendo linha e metodologia."
	default:
		a.Status = "context_required"
		a.Rule = "A direção desta série não define melhora ou piora por si só. Preços nominais, inflação, crescimento e séries transformadas exigem contexto; menor inflação não significa preços menores."
		return a
	}
	a.Status = "stable"
	if direction != 0 {
		a.Status = "worsened"
		if direction == preference {
			a.Status = "improved"
		}
	}
	a.Rule += " Estável significa igualdade exata dos valores publicados, sem teste de significância ou tolerância. A leitura compara os extremos, não todo o intervalo, e não atribui causalidade."
	return a
}
