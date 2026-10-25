# Calculadora socioeconômica — fase 20

A rota `/calculadora` recebe renda familiar, moradores, despesas de moradia, transporte e
outras despesas, capital, mês, vínculo de trabalho e prioridades. O resultado separa o
orçamento declarado, um cenário hipotético de renda, a referência publicada da cesta e as
políticas com estudos relacionados. Não calcula score, voto, elegibilidade ou efeito causal
individual. O catálogo empírico atual descreve o Bolsa Família anterior a 2023; não contém
um modelo que permita transportar impactos para a família informada.

## Cálculos e significado

O módulo [calculator](../../backend/internal/calculator/domain.go) centraliza o método
`profile-v1`. O navegador envia entradas e apresenta saídas; não calcula valores econômicos.

| Saída | Fórmula |
|---|---|
| Renda por pessoa | renda familiar / moradores |
| Despesas declaradas | moradia + transporte + demais despesas |
| Saldo | renda familiar − despesas declaradas |
| Comprometimento declarado | despesas / renda × 100 |
| Renda do cenário | renda + mudança hipotética |
| Cesta como parcela da renda | preço publicado / renda familiar × 100 |
| Tempo individual equivalente, opcional | preço × horas individuais / renda individual do trabalho |

O cenário mantém despesas e moradores. A renda individual opcional não muda com o cenário.
Renda zero admite saldo e renda por pessoa, mas não proporções com denominador zero.
Saldo negativo e comprometimento acima de 100% são resultados válidos. Não há classificação
estatística de pobreza, custos presumidos, escala por idade ou previsão comportamental.
A cesta para um adulto não é multiplicada pelos moradores nem somada às despesas; alimentação
já pertence às demais despesas declaradas. O comprometimento não é a série de dívida do BCB.

Entradas monetárias são strings decimais, até duas casas, com valor absoluto até
999.999.999,99; valores negativos só são permitidos na mudança hipotética. O cenário não
pode ter renda negativa. Moradores: inteiro de 1 a 100. Para tempo individual, renda do
trabalho e horas devem ser fornecidas juntas, positivas; renda individual integra a renda
familiar e horas não excedem 744 por mês. Cálculos usam decimais e divisão com 12 casas,
empate para o par, sem arredondamento intermediário da divisão. A interface preserva as
casas devolvidas, trocando apenas o separador decimal.

Valores declarados e preço da cesta são nominais do mês selecionado. Não se compara renda
atual com uma cesta histórica implicitamente. Não há deflação nem comparação entre meses
nesta ferramenta; o [comparador](comparator.md) trata períodos publicados.

## Publicação e referência auditável

O build entrega as capitais da série `cv4` capturadas na publicação. O usuário escolhe um
mês explicitamente, inclusive meses sem cobertura, ou informa que sua região não está
na lista. Nenhuma capital substitui automaticamente outra região.

O [handler](../../backend/internal/api/calculator.go) lê a publicação imutável enviada e
procura exatamente `cv4`, geografia e mês civil completo. Confere estado observado, unidade,
método, frequência, base temporal, identidade e período da observação. Ausência, pendência
ou incompatibilidade mantém o orçamento declarado, sem proporção ou tempo da cesta.
Não usa alias atual, período mais próximo, cesta familiar estimada ou fonte governamental
em tempo de consulta.

A auditoria expõe publicação, versão, entradas declaradas, fórmulas, resultados, critérios
editoriais e revisões dos catálogos. Uma referência observada inclui ID, contexto, fontes e
coleta da observação; o link JSON fixa a mesma publicação. Os valores do perfil ficam no
DOM até nova edição, limpeza ou saída da página, sem URL compartilhável ou exportação automática.

## Políticas e evidências relacionadas

`relevance-v1`, em [calculator.ts](../../src/lib/calculator.ts), relaciona prioridades aos
indicadores das fichas de políticas. Alimentação, por exemplo, relaciona tempo por cesta e
insegurança alimentar; trabalho relaciona renda, mínimo, desocupação e informalidade.
Aposentadoria/pensão também abre a investigação da reforma previdenciária. Demais vínculos
não geram efeitos presumidos. Sem correspondência, a ferramenta informa ausência no catálogo.
A ordem é editorial, sem pontuação ou classificação de vantagem.

Os resultados mostram motivo da relação, limites da política, estudos empíricos, população,
método, achados históricos, contrafactual e hipóteses quando aplicáveis. Referência
metodológica não aparece como estimativa empírica. As fichas completas fornecem fontes e
legislação. A relação com o programa anterior a 2023 permanece explícita. Acrescentar um
modelo de impacto individual exigirá dados e hipóteses próprios, não multiplicação automática
de coeficientes históricos. O cenário de renda é uma hipótese digitada pelo usuário, nunca
um efeito atribuído a uma política.

## Contrato HTTP e privacidade

`POST /api/v1/calculator`, `Content-Type: application/json`, sem parâmetros na URL:

```json
{
  "publication": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "version": "profile-v1",
  "geography": "BR-city-3550308",
  "month": "2025-01",
  "profile": {
    "income": "3000",
    "members": 3,
    "housing": "1000",
    "transport": "250.25",
    "other": "749.75",
    "income_change": "500",
    "labor_income": "1500",
    "monthly_hours": "200"
  }
}
```

A resposta usa o envelope `publication`, `catalog_revision`, `data`. `data` inclui versão,
precisão, arredondamento, geografia, mês, `baseline`, `scenario`, `basket_share`,
`basket_hours`, `reference_status`, motivo opcional, preço opcional e fórmulas. Valores
numéricos são strings; divisões indefinidas são `null`. `reference_status` é `observed` ou
`not_computed`; motivos: `endpoint_not_covered`, `endpoint_unavailable`, `incompatible_reference`.

O corpo é limitado a 4096 bytes, inclusive transferência sem Content-Length conhecido.
Campos desconhecidos, tipos incorretos, JSON adicional, versão inválida e entradas fora dos
limites produzem 400; mídia incorreta, 415. Edição retirada preserva 410; limites e capacidade
usam os 429/503 existentes. O POST compartilha timeout, limite por IP e oito consultas
simultâneas da API. CORS permite POST/Content-Type somente neste recurso; GETs existentes
continuam rejeitando corpos. Esta operação não escreve no PostgreSQL/R2, não registra o
corpo e responde sempre `no-store`, sem ETag ou 304. Proxies externos devem preservar essa
regra e não registrar corpos; a configuração remota não foi verificada.

O [cliente](../../src/scripts/calculator-page.ts) não envia cookies, não usa localStorage,
sessionStorage ou query string e não envia vínculo/prioridades ao backend. Verifica o
contrato e fixa publicação, mês e geografia. A consulta tem limite de dez segundos;
erros permitem nova tentativa. Editar/limpar cancela a consulta e invalida respostas
pendentes, removendo resultados anteriores. Conteúdo recebido entra por `textContent`,
sem interpretação de HTML. A limpeza também remove os valores do formulário.

## HTML, validação e limites operacionais

Métodos, limites, políticas, estudos e links dos indicadores são entregues em HTML.
Sem JavaScript, o formulário fica oculto; sem API configurada, a página informa a
indisponibilidade. A simulação interativa exige a API; o conteúdo estático permanece legível.
A navegação inclui a calculadora. SEO usa o layout compartilhado, canonical, descrição,
Open Graph, breadcrumb JSON-LD e sitemap, mantendo `robots.txt` aberto conforme a
[regra permanente](../../AGENTS.md).

Os [testes Go](../../backend/internal/api/calculator_test.go) exercitam HTTP e cálculo real,
com precisão, renda zero, déficit, mês/geografia ausentes, pendência, incompatibilidade,
validação, limites do corpo, CORS, mídia, métodos e ausência de cache. Os
[testes unitários](../../tests/unit/calculator.test.ts) verificam contrato, publicação,
transporte e seleção editorial. O [fluxo no navegador](../../tests/fixtures/verify-calculator.ts)
usado pelo build isolado verifica HTML com API controlada, desktop/celular, teclado,
resultados, auditoria, privacidade local, erro/retry, edição durante consulta e limpeza.
A [suíte da página](../../tests/calculator.spec.ts) cobre conteúdo sem JavaScript, SEO,
links, largura e acessibilidade automática. Não comprova compreensão por usuários,
indexação externa nem funcionamento da infraestrutura remota.

A próxima etapa é escala e performance (fase 21), guiada por evidências de uso.
