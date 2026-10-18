# Engine de indicadores — fase 8

A engine está implementada no [módulo indicators](../../backend/internal/indicators/domain.go)
do backend Go. Usa observações aceitas pelos pipelines, calcula com aritmética racional
exata e persiste avaliações imutáveis em PostgreSQL. A entrega é privada: API, manifestos
de publicação, ativação de canal e integração do frontend pertencem às próximas fases.

## Fórmulas e contrato

`pnpm pipeline formulas` descreve as fórmulas executáveis: versão, papéis dos inputs,
parâmetros, metodologia, precisão, arredondamento e política de ausência.

| Cálculo | Versão | Fórmula | Saída e condições |
|---|---|---|---|
| `tr2` | 1 | `nominal × base_index / current_index` | BRL/mês de dezembro de 2025 pelo INPC. Mínimo e índice corrente do mesmo mês civil/Brasil; índice-base de dezembro de 2025 na mesma base de índice |
| `cv5` | 1 | `basket / nominal × 220` | h/cesta da capital, pelo piso nacional do mesmo mês. Referência de 220 h, sem pretensão de jornada observada ou salário líquido |
| `price-income` | 1 | `basket / nominal × 100` | Cesta em % do mínimo **bruto** nacional. Não confundir com a coluna DIEESE de percentual do salário líquido |
| `relative-change` | 2 | `(current / previous − 1) × 100` | Variação relativa em %, entre períodos explicitamente escolhidos da mesma série |
| `difference` | 2 | `current − previous` | Diferença na unidade de origem; taxas em % produzem pontos percentuais |
| `rebase` | 2 | `current / base × 100` | Índice de base 100, com período-base explícito |
| `compound-change` | 2 | `(∏(1 + monthly_rate / 100) − 1) × 100` | Variação acumulada de preços em meses civis consecutivos, apenas IPCA, alimentação e INPC; sem compor níveis, proporções ou acumulados de 12 meses |

Cada resultado registra a definição integral do cálculo e os IDs dos inputs por papel.
TR2 e CV5 seguem os [contratos do MVP](mvp-indicators.md). Não há fórmula relevante no
frontend, score de bem-estar, causalidade automática ou índice composto com pesos arbitrários.

Os inputs e todas as operações intermediárias usam frações exatas; somente a saída é
arredondada para até 12 casas decimais, `half_even`. Valores são strings decimais no JSON.
Arredondamento de apresentação não altera o número armazenado. Alterar fórmula, parâmetros,
alinhamento, precisão ou política de ausência exige nova versão.

As versões 2 corrigem a seleção de taxas para composição e permitem comparar intervalos
completos de igual duração em meses. Novos manifestos dessas quatro fórmulas devem usar
`"version": "2"`; a versão 1 deixou de ser executável. Avaliações antigas permanecem
consultáveis por ID, sem reescrita. Para aplicar as correções a um resultado anterior,
materialize novamente com a versão 2 e recalcule suas dependências com os novos IDs.

## Seleção explícita e reprodução

A fase 7 não estabelece ordem oficial de edição para todas as fontes. Por isso, a engine
**não escolhe o input pela última coleta**. Um manifesto privado fixa os IDs das observações
normalizadas aceitas ou de resultados anteriores da engine. A consulta operacional ao banco
permite localizar candidatos; quem prepara o manifesto precisa conferir método e edição.
Não existe seleção pública implícita, emenda histórica de CV2 nem fallback para outro período.

```bash
pnpm pipeline migrate
pnpm pipeline formulas
pnpm pipeline calculate --manifest .data/calculations.json
pnpm pipeline calculation --id ID_RETORNADO
```

Os comandos de cálculo e leitura exigem apenas `DATABASE_URL`; não acessam fontes externas
ou R2. O wrapper resolve `--manifest` em relação ao diretório do chamador.

O arquivo é uma lista JSON. Substitua os marcadores abaixo pelos hashes de 64 caracteres
retornados pela persistência normalizada; eles não são IDs executáveis:

```json
[
  {
    "calculation": "tr2",
    "version": "1",
    "inputs": {
      "nominal": "ID_MINIMO_DO_MES",
      "current_index": "ID_INPC_DO_MES",
      "base_index": "ID_INPC_DEZEMBRO_2025"
    }
  },
  {
    "calculation": "cv5",
    "version": "1",
    "inputs": {
      "basket": "ID_CESTA_CAPITAL_MES",
      "nominal": "ID_MINIMO_DO_MES"
    }
  }
]
```

`relative-change` e `difference` usam `current` e `previous`; `rebase`, `current` e `base`.
`price-income` usa os mesmos papéis de CV5. Em `compound-change`, os papéis são
`month:2025-01`, `month:2025-02` etc., correspondentes aos meses dos inputs.
Parâmetros extras, versões desconhecidas e papéis incorretos são rejeitados.
Erros de validação retornam uma mensagem descritiva no campo `error` da CLI, antes de abrir o banco.
O manifesto admite de 1 a 10.000 avaliações, até 16 MiB; um acumulado admite até 1.200 meses.

Para localizar os inputs, uma consulta **privada** pode listar as versões aceitas, sem
ordená-las como uma seleção atual automática:

```sql
SELECT DISTINCT o.id, o.series, o.start_date, o.end_date, o.geography,
       o.value, o.status, o.context
FROM normalized.observation o
JOIN normalized.member m ON m.observation = o.id
JOIN normalized.receipt receipt ON receipt.batch = m.batch
JOIN ops.run r ON r.id = receipt.run AND r.status = 'succeeded'
WHERE o.series IN ('minimum-nominal', 'inpc-index', 'cv4')
  AND o.start_date IN ('2025-01-01', '2025-12-01');
```

## Persistência, revisões e falhas

A [migração 002](../../backend/internal/platform/postgres/002.sql) acrescenta
`derived.evaluation` e `derived.input`, sem alterar a migração 001. O migrador verifica
checksums e aplica as duas em ordem, na mesma transação. As consultas são geradas por sqlc.
O [papel de runtime](../../backend/runtime-grants.sql) pode inserir/ler avaliações e vínculos,
sem UPDATE/DELETE em registros aceitos e sem acesso de escrita a `published`.

A identidade da avaliação inclui a requisição canônica e a definição versionada completa.
Mesmos inputs e cálculo recuperam ID e primeiro `calculated_at`, inclusive sob concorrência.
A identidade da série derivada preserva o significado do cálculo e de suas bases. Em
`compound-change`, a série de origem e a duração em meses (`window_months`) definem a
medida; as datas específicas permanecem na avaliação, permitindo que janelas sucessivas
da mesma duração compartilhem a série. A revisão
de um input gera outra avaliação, conservando a anterior e suas dependências. Os vínculos
possuem FKs para observações normalizadas ou avaliações anteriores. Só dependências já
aceitas podem ser referenciadas: não há referências futuras ou ciclos no grafo.

O lote declarado é aceito em uma transação. Erro de infraestrutura, ID inexistente ou
input sem aceitação aborta todo o manifesto; a CLI retorna código 1. JSON/argumentos
inválidos são rejeitados antes de abrir o banco. Avaliações de domínio sem número são
persistidas com `status: not_computed`, `reason` e inputs, e o comando retorna normalmente:
é necessário conferir os resultados, não apenas o código de saída.

Ausência, supressão, denominador não positivo, unidade/método incompatível, período parcial,
recorte divergente ou quebra metodológica impedem número; zero válido de custo permanece zero.
Comparações verificam unidade, método, frequência, base temporal/monetária, classificação,
composição e segmento. Não misturam bases monetárias não resolvidas da PNAD. Comparações
com `previous` exigem períodos não sobrepostos em ordem temporal; rebase permite base posterior.
O horizonte de comparação participa da identidade da série: variações mensais e anuais são medidas distintas.
Acumulados podem alimentar diferença, variação relativa e base 100 quando pertencem à mesma
série e ao mesmo recorte, com intervalos completos de igual duração em meses. A validação
respeita fevereiro bissexto e rejeita intervalos parciais ou durações ausentes/incompatíveis.
`window_months` permanece no resultado e na identidade da série das operações seguintes.
Comparações com `previous` continuam exigindo intervalos não sobrepostos.

A composição aceita exclusivamente `cv1-monthly`, `cv2-old-monthly`, `cv2-current-monthly`
e `inpc-monthly`. Percentuais de inadimplência, endividamento, relações cesta/renda e taxas
calculadas entre períodos não são variações mensais de preços admitidas por essa fórmula.
A composição exige meses contíguos e aceita deflação, inclusive −100%, mas rejeita taxa inferior.

CV5 aplica explicitamente o mínimo Brasil à capital da cesta; não fabrica salário local.
Confronta o tempo publicado pelo DIEESE quando presente. A tolerância é de um minuto para
arredondamento/truncamento da divulgação. Divergência maior ou texto inválido impede saída
numérica; não se ajusta a fórmula para reproduzir um valor inconsistente da fonte.

Uma revisão não altera resultados anteriores nem os torna atuais automaticamente. Para
recalcular, enviar novo manifesto com os IDs revisados e depois recalcular as dependências.
Descoberta/agenda automática de recomputação e seleção coerente na publicação ficam para
a integração de publicação da fase 9. A engine permite recalcular as fórmulas executáveis
e consultar qualquer avaliação retida, inclusive as versões retiradas de execução.

## Validação e limites

[Testes de domínio](../../backend/internal/indicators/domain_test.go) cobrem as sete fórmulas,
arredondamento, ausência, metadados, recortes e períodos incompatíveis. Os
[testes PostgreSQL/LocalStack](../../backend/integration/engine_test.go) exercitam
`job → raw → aceitação → cálculo → consulta`, repetição, concorrência, revisão, inputs
já derivados, motivo sem número e rollback do manifesto. Usam respostas controladas;
não atestam disponibilidade de fontes remotas.

Os testes de regressão também cobrem a rejeição de níveis de inadimplência e proporções
cesta/renda na composição, comparação de acumulados (3,02% e 5,06% diferem em 2,04 pontos
percentuais), duração preservada após leitura do PostgreSQL e encadeamento de cálculos.
Intervalos parciais, durações incompatíveis, recortes divergentes e sobreposição são rejeitados.

A [amostra oficial](../../backend/internal/indicators/testdata/official-inputs.json) conserva
IDs, valores e contexto do corpus normalizado da fase 7. Não substitui os originais raw.
O teste também pode conferir o corpus local completo, sem nova coleta:

```bash
ENGINE_CORPUS="$PWD/.data/go-migration/corpus/observations.json" \
  go -C backend test ./internal/indicators -run TestRecordedOfficialInputs -v
```

A auditoria desse corpus identificou custos deslocados quando a tabela DIEESE tem decimais
com uma única casa ou um traço em uma coluna anterior. O parser passou a preservar essas
células, com fixtures de novembro/2012, março/2014 e dezembro/2019. Reprocessar os originais
cria IDs corrigidos; observações já aceitas não são sobrescritas. Há também divergência no
próprio tempo publicado de São Paulo em fevereiro/2016: R$ 443,40 / R$ 880 × 220 = 110,85 h
(110h51m), enquanto a tabela informa 110h53m. A engine registra a incompatibilidade.

A conferência dos 6.375 registros reprocessados produziu 177 resultados TR2 e 3.438 CV5,
com uma avaliação CV5 bloqueada pelo tempo inconsistente na fonte. As cinco correções
alteraram apenas os respectivos IDs de cesta; os outros 6.370 IDs permaneceram iguais.
Os [resultados da validação](evidence/engine/verification.json) registram os limites dessa evidência.

Operação Railway/R2, publicação HTTP, indexação externa e atualização automática do frontend
não foram executadas nesta fase. As páginas editoriais e sua
[regra permanente de SEO](../../AGENTS.md) continuam vigentes.
