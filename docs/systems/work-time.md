# Tempo de trabalho — fase 17

As páginas de cesta básica e tempo por cesta apresentam o preço em reais, a parcela do
salário mínimo bruto e o equivalente em horas e minutos. A referência é o piso nacional
nominal do mesmo mês, com 220 horas mensais. Não é uma estimativa da jornada observada,
do salário líquido ou da renda local de quem consulta o site.

A primeira tradução material do MVP é a cesta, conforme o [contrato CV5](mvp-indicators.md#contrato-do-tempo-de-trabalho-por-cesta).
Gasolina e outras rendas/hora continuam como expansão: não se associa uma semana da ANP
a uma renda mensal sem definir um contrato próprio de alinhamento.

## Dados e cálculos

O [handler Go](../../backend/internal/api/work_time.go) atende:

```text
GET /api/v1/work-time?publication=ID&series=cv4&geography=BR-city-3550308&from=2025-01-01&to=2025-01-31
```

`series` aceita `cv4`, `cv5` e `price-income`; `from` e `to` identificam o período
exato do recorte selecionado, sem procurar o período anterior ou mais próximo. Todas
as leituras exigem uma publicação ativada. O handler usa exclusivamente os slots
`cv4` da capital e `minimum-nominal`/Brasil da mesma publicação e do mesmo mês.
Uma avaliação derivada publicada tem seus inputs fixados pela consistência do manifesto;
a consulta não seleciona revisões pela data da coleta.

A [engine](indicator-engine.md) executa `cv5/1` (`basket × 220 / nominal`) e
`price-income/1` (`basket / nominal × 100`). A resposta contém `price` e `income`, com
observações e origens, e `hours` e `share`, com definição integral, parâmetros, versão,
IDs dos inputs e saída decimal. São avaliações puras para leitura, como no comparador;
a consulta não persiste novas avaliações nem promove uma nova publicação.

`rounded_minutes` formata a saída decimal de horas multiplicando-a por 60 e arredondando
ao inteiro mais próximo, com empates para o par. É uma string inteira. O HTML apresenta
esse total também como horas inteiras e minutos restantes, sem aritmética de ponto
flutuante. As horas decimais originais continuam acessíveis na auditoria; o arredondamento
de apresentação não altera os valores usados pela engine.

Exemplo hipotético: cesta de R$ 750 e piso de R$ 1.500 correspondem a 50% do mínimo,
110 h 0 min ou aproximadamente 6.600 minutos. Os números não são uma observação oficial.

## Ausência e incompatibilidade

A resposta usa `status: computed` somente quando as duas avaliações têm número.
`not_computed` preserva o motivo. Período fora da cobertura, recorte indisponível,
falta de preço/renda e referência indisponível têm motivos distintos. A engine impede
saída numérica para renda não positiva, custo negativo, unidades/métodos incompatíveis,
período parcial, supressão ou divergência superior a um minuto com o tempo divulgado pelo
DIEESE. Custo zero observado permanece zero; ausência nunca vira zero.

A falta de renda no mês não autoriza usar o salário mais recente. O piso real deflacionado,
rendimento médio e jornada observada não substituem os inputs do método CV5. Os erros de
parâmetro usam o contrato HTTP comum; resultados válidos de ausência continuam HTTP 200.
Cache imutável, ETag, HEAD e limites de abuso são os mesmos dos outros recursos versionados.

## Build e leitura

[capturePlatform](../../src/lib/platform-build.ts) consulta a conversão para cada recorte
elegível no seu último período, sempre com a publicação resolvida uma única vez no build.
Verifica publicação, catálogo, série, geografia, período e presença dos valores/referências.
Uma API configurada que falha ou devolve contexto divergente interrompe o build.

[WorkTime](../../src/components/platform/WorkTime.astro), integrado à página de indicador,
entrega valores, explicação, auditoria expansível, fontes e links JSON no HTML estático.
Não depende de JavaScript nem consulta fontes oficiais durante visitas. Quando a conversão
é inviável, mostra o motivo; sem API configurada, continuam as definições e o aviso geral
de ausência de cobertura. As rotas, metadados e a [regra permanente de SEO](../../AGENTS.md)
permanecem.

## Verificação local e limites

- [Testes HTTP](../../backend/internal/api/work_time_test.go): cálculo, custo zero,
  arredondamento com passagem de hora, renda zero/ausente, período anterior, método,
  unidade, divergência da fonte, parâmetros inválidos, cache e ETag.
- [Integração PostgreSQL/S3](../../backend/integration/work_time_test.go): ingestão e
  aceitação, materialização de CV5 e percentual, preparação/ativação, leitura pelos três
  recortes, revisão do custo e preservação da publicação anterior.
- [Captura do build](../../tests/unit/platform-build.test.ts): mês e publicação fixos,
  ausência sem substituição, rejeição de contexto e números/referências ausentes.
- [Build e navegador](../../tests/content-build.spec.ts): reais, percentual, horas/minutos,
  indisponibilidade, auditoria por teclado, links, SEO, axe, largura e capturas em desktop
  e celular com JavaScript desabilitado.

As fontes da integração são controladas; S3 é emulado por LocalStack. Esses testes não
comprovam operação Railway/R2, disponibilidade das fontes oficiais, compreensão por
usuários reais ou indexação externa. A fase 18 acrescentará contexto de políticas públicas;
não há causalidade ou score político nesta tradução.
