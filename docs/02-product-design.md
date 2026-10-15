# Margem — Product Design e Experiência do Usuário

Este documento descreve a experiência planejada, não a interface já implementada. Valores, datas e metadados nos exemplos são ilustrativos; não representam resultados apurados.

## 1. Objetivo

A experiência do Margem deve permitir que pessoas sem conhecimento prévio em economia naveguem por informações socioeconômicas complexas sem serem expostas imediatamente à complexidade das bases de dados.

A interface deverá aplicar divulgação progressiva de informação:

> simples primeiro, complexo quando necessário.

---

## 2. Navegação inicial

Para o MVP:

- Início
- Indicadores
- Comparar
- Entenda

A futura calculadora socioeconômica poderá ser incorporada posteriormente.

---

## 3. Home

A home não deverá começar apresentando dezenas de indicadores.

A pergunta inicial será semelhante a:

> O que você quer entender?

Abaixo dela estarão cinco grandes áreas.

### Trabalho e renda

> Estou trabalhando mais e ganhando melhor?

### Custo de vida

> Meu dinheiro compra mais ou menos?

### Vida financeira

> Quanto da minha renda está indo para dívidas?

### Qualidade de vida

> As condições de vida estão melhorando?

### Economia e Estado

> A economia do país está ficando mais forte ou mais frágil?

---

## 4. Modelo de leitura

Cada indicador deverá possuir três níveis.

### Nível 1 — O que aconteceu?

Uma resposta curta.

Exemplo:

> O poder de compra do salário mínimo aumentou 6,4% no período.

### Nível 2 — O que isso significa?

Tradução do indicador para uma situação compreensível.

Exemplo:

> O salário mínimo passou a comprar mais bens e serviços da cesta usada como referência do que no início do período.

### Nível 3 — Dados e metodologia

Área destinada a usuários que desejam aprofundamento.

Deve conter:

- série histórica;
- unidades;
- fonte;
- metodologia;
- alterações metodológicas;
- dados brutos;
- fórmula;
- período;
- atualizações.

---

## 5. Linguagem

A interface deverá utilizar linguagem cotidiana como entrada.

Exemplo:

> Quanto da renda está indo para dívidas?

E somente depois apresentar:

> Indicador técnico: comprometimento da renda das famílias.

Outro exemplo:

> Quanto o governo deve?

seguido por:

> Dívida Bruta do Governo Geral — DBGG.

---

## 6. Componente “Entenda”

Todo indicador deverá possuir uma ação contextual:

> Entenda este indicador

Ela abre um painel lateral sem retirar o usuário da visualização atual.

Conteúdo esperado:

- definição;
- por que importa;
- como interpretar;
- erros comuns;
- relações com outros indicadores;
- fonte;
- links para aprofundamento.

---

## 7. Busca

A pesquisa deverá trabalhar com linguagem cotidiana.

Uma busca por:

> comida

poderá apresentar:

- inflação de alimentos;
- cesta básica;
- insegurança alimentar.

Uma busca por:

> salário

poderá apresentar:

- salário mínimo;
- rendimento médio;
- rendimento mediano;
- rendimento por hora;
- massa salarial.

O usuário não deve precisar conhecer o nome oficial da série.

---

## 8. Página de indicador

Estrutura inicial:

1. nome compreensível;
2. valor atual;
3. variação relevante;
4. gráfico principal;
5. interpretação;
6. relações materiais;
7. indicadores relacionados;
8. fonte;
9. metodologia.

Exemplo:

> Gasolina

Valor:

> R$ 6,20/litro

Complementos:

> 18 minutos de trabalho por litro

> 4,3% de determinado orçamento de transporte

> +X% em termos reais em cinco anos

---

## 9. Comparador

O comparador deverá permitir selecionar:

- período inicial;
- período final;
- eventualmente governos;
- dimensões;
- indicadores.

Resultado resumido:

> Trabalho e renda ↑

> Custo de vida ↓

> Qualidade de vida ↑

Cada resultado agregado deverá poder ser expandido.

Não haverá um score político opaco.

---

## 10. Tempo como unidade

Sempre que fizer sentido, valores monetários deverão possuir uma representação alternativa em tempo de trabalho.

Exemplo:

> Cesta básica: R$ 820

> Equivalente a 93 horas de trabalho na renda de referência selecionada.

Isso deve funcionar como uma das identidades analíticas do produto.

---

## 11. Fontes e confiança

A fonte não ficará escondida no rodapé.

Cada indicador deverá mostrar claramente:

> Fonte: IBGE — PNAD Contínua

> Referência: trimestre encerrado em agosto de 2026

> Publicado em: setembro de 2026

> Periodicidade: trimestral

A interface também poderá apresentar informações de qualidade:

- fonte primária;
- série comparável;
- quebra metodológica;
- dado preliminar;
- dado revisado.

---

## 12. Contexto temporal

Todo gráfico deverá mostrar explicitamente o período selecionado.

O usuário deverá conseguir expandir facilmente para a série completa.

O objetivo é dificultar recortes temporais enganosos.

---

## 13. Estrutura inicial de rotas

As rotas abaixo são propostas. O site atual usa `/temas/:slug`; a convivência dessa rota com `/tema/:slug` ainda precisa ser definida.

```text
/
```

Página inicial.

```text
/tema/:slug
```

Visão de uma dimensão socioeconômica.

```text
/indicador/:slug
```

Detalhes de um indicador.

```text
/comparar
```

Ferramenta de comparação.

```text
/entenda/:slug
```

Conteúdo educacional e glossário.

---

## 14. MVP

O MVP não tentará representar todas as séries existentes.

Indicadores candidatos à seleção de aproximadamente 10–15 na fase 3 do [roadmap](04-roadmap.md):

- rendimento real;
- rendimento por hora;
- salário mínimo real;
- horas trabalhadas;
- desemprego;
- informalidade;
- inflação;
- alimentação/cesta básica;
- gasolina;
- habitação;
- endividamento;
- pobreza;
- desigualdade;
- PIB per capita;
- dívida pública;
- investimento.

A prioridade é validar a linguagem e a experiência antes de ampliar a quantidade de dados.

---

## 15. Critério de UX

Informações fundamentais deverão estar acessíveis em até dois níveis de navegação a partir da home.

Exemplo:

> Home → Custo de vida → Alimentação

A experiência não deverá exigir conhecimento prévio sobre a estrutura das bases oficiais.

O sistema é responsável por traduzir essa estrutura.
