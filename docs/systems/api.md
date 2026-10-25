# API Margem — fase 9

A API Go usa `net/http` e `chi`, no mesmo monólito dos jobs. Serve somente publicações já
ativadas. O visitante não consulta provedores nem executa ingestão. O contrato HTTP começa
em `/api/v1`; mudanças incompatíveis exigem outro prefixo. A integração do frontend está no
[shell da fase 10](platform-shell.md), com publicação fixada no build.

A entrega inclui preparação, selagem por hash, projeção JSON, ativação transacional,
consultas, cache HTTP, filtros, paginação, comparação e limites de abuso. A
[evidência local](evidence/api/verification.json) registra coleta oficial e verificações.
Railway, R2 remoto, domínio público, CDN, CORS na borda e backup remoto não foram implantados.

## Publicar dados

Aplicar migrações com o proprietário do banco, executar jobs com o papel de worker e
publicar com uma identidade própria. O servidor público só precisa de leitura em `published`
e no bucket de projeções. As permissões estão em
[api-grants.sql](../../backend/api-grants.sql),
[publisher-grants.sql](../../backend/publisher-grants.sql) e
[runtime-grants.sql](../../backend/runtime-grants.sql). Não usar o dono dos schemas no servidor.
Não há endpoint administrativo HTTP: a autorização de escrita é a identidade operacional da CLI.

```bash
pnpm pipeline migrate
pnpm pipeline run --source ibge --from 2025-01-01 --to 2025-12-31
pnpm pipeline prepare --manifest .data/publication.json
pnpm pipeline activate --manifest .data/activation.json
pnpm pipeline current
pnpm pipeline serve
```

`prepare` recebe um manifesto com IDs aceitos, recortes completos e justificativa da edição:

```json
{
  "actor": "editor-responsavel",
  "key": "ibge-2025-preparacao-1",
  "base_activation": 0,
  "data_cutoff": "2026-10-18T12:00:00Z",
  "selection_reason": "Edição capturada e conferida pelo responsável; IDs escolhidos explicitamente.",
  "scope": [
    {
      "series": "tr4", "geography": "BR",
      "start": "2025-01-01", "end": "2025-03-31",
      "id": "SUBSTITUIR_PELO_ID_ACEITO_DE_64_CARACTERES"
    },
    {
      "series": "tr2", "geography": "BR",
      "start": "2025-01-01", "end": "2025-01-31",
      "status": "pending_recalculation", "reason": "Input revisado; cálculo ainda não materializado."
    }
  ]
}
```

O exemplo é um modelo de preenchimento. IDs e corte devem corresponder ao banco real.
Para obter IDs sem confundir chegada com ordem oficial, consultar o lote conferido:

```sql
SELECT o.id,o.series,o.start_date,o.end_date,o.geography,o.value,o.status
FROM normalized.member m JOIN normalized.observation o ON o.id=m.observation
WHERE m.batch='ID_DO_LOTE_CONFERIDO'
ORDER BY o.series,o.geography,o.start_date,o.end_date,o.id;
```

A seleção é explícita porque as fontes ainda não oferecem uma ordem oficial de edições
verificável para todos os datasets. Não existe promoção automática da última captura.
O responsável inclui todos os recortes desejados; fora deles não há cobertura nem fallback.
Um item tem ID, ou `not_covered`/`pending_recalculation` com motivo. O catálogo completo dos
15 conceitos acompanha a publicação, mesmo quando alguns não têm cobertura.

Preparação valida IDs, períodos e geografia, corte de coleta/aceitação e dependências
transitivas. Todos os inputs precisam estar selecionados nos mesmos recortes; uma derivada
com input antigo é rejeitada. A base INPC de dezembro de 2025 precisa constar do escopo ao
publicar TR2. TR2/CV5 usam aliases `tr2`/`cv5`; `price-income` identifica a relação cesta/mínimo.
Outros resultados da engine usam seu `observation.series` (`derived:` seguido de hash),
conservando a identidade semântica de índices, variações e acumulados.
A base monetária não resolvida de TR1 bloqueia publicação numérica; declarar a lacuna.
Cálculos sem número são publicados como indisponibilidade explícita com motivo.

O manifesto fixa o catálogo de apresentação, fontes, séries e fórmulas, além do corte,
escopo e IDs de dependências. O ID é seu SHA-256 canônico. Valores e origens são materializados
numa projeção em `publications/ID/v1/snapshot.json`, em bucket distinto do raw privado.
O banco registra localizador, hash e tamanho somente depois de verificar o objeto.
O manifesto referencia dados aceitos; não sobrescreve nem replica suas observações no banco.
Não há transação SQL aberta durante I/O no armazenamento de objetos.

`activate` recebe:

```json
{
  "actor": "editor-responsavel", "key": "ibge-2025-ativacao-1",
  "publication": "SUBSTITUIR_PELO_ID_RETORNADO_POR_PREPARE",
  "expected_generation": 0,
  "reason": "Qualidade e cobertura conferidas.", "return": false
}
```

A primeira geração é zero. A ativação verifica os bytes da projeção e, sob lock do canal,
confere geração e base do candidato. Evento, ponteiro e recibo confirmam juntos.
Apenas um concorrente vence a mesma geração. Repetir operação/ator/chave e conteúdo retorna
o resultado original; mudar conteúdo conflita. Isso permite recuperar sucesso após timeout.
Para retornar a uma publicação anteriormente ativada, usar `return: true`, nova chave,
justificativa e geração atual esperada. O retorno cria outra geração e preserva o histórico.
A CLI `current` consulta a autoridade sem cache. Recibos também podem ser auditados em
`published.receipt` por `(operation, actor, key)`, com operações `prepare`, `activate` e `return`.

## Contrato de leitura

Resolver primeiro:

```text
GET /api/v1/publications/current
GET /api/v1/publications/current?at=2026-10-18T12%3A00%3A00Z
```

Retorna `generation`, `publication`, `previous_activation`, `activated_at`,
`catalog_revision` e `data_cutoff`. `at` é um instante passado com fuso; antes da primeira
ativação há `not_covered`. Usar o ID retornado em **todas** as próximas consultas:

| Rota GET | Filtros além de `publication` | Resultado |
|---|---|---|
| `/api/v1/themes` | `limit`, `cursor` | Cinco dimensões de produto, ordenadas por slug |
| `/api/v1/themes/:slug` | — | Nome e pergunta do tema |
| `/api/v1/indicators` | `theme`, `q`, `role`, `limit`, `cursor` | Conceitos, perguntas, definições e limitações; role é `primary`, `context` ou `input` |
| `/api/v1/indicators/:slug` | `series`, `geography` | Definição, recorte, unidade, fonte, dataset, método e último período, inclusive ausência |
| `/api/v1/indicators/:slug/series` | `limit`, `cursor` | Opções de séries/geografias no escopo |
| `/api/v1/series/:series` | `geography`, `from`, `to`, `limit`, `cursor` | Observações e lacunas declaradas no escopo |
| `/api/v1/sources/:id` | — | Identidade e URL institucional |
| `/api/v1/observations/:id` | — | Observação, método, aceitação, origens e cálculo/inputs quando derivados |
| `/api/v1/comparisons` | `series`, `geography`, `from`, `to`, `calculation`, `version`, `assessment` | Comparação entre extremos explícitos da mesma publicação |
| `/api/v1/work-time` | `series`, `geography`, `from`, `to` | [Cesta em reais, percentual do mínimo e tempo equivalente](work-time.md), com inputs e fórmulas versionadas |
| `/api/v1/publications/:id` | Nenhum, ID no caminho | Manifesto completo, catálogo e dependências da publicação ativada |

Os slugs dos indicadores são fixados em
[indicators.json](../../backend/internal/publications/indicators.json); não são os slugs dos
12 temas editoriais. Exemplos: `desemprego`, `inflacao`, `cesta-basica`, `salario-minimo-real`.
Séries usam IDs do catálogo, como `tr4`, `cv1-monthly`, `cv1-12m` e `cv4`.
Geografias preservam os IDs de origem normalizados, como `BR` e `BR-city-3550308`.
`q` faz busca textual sem distinguir caixa em nome, pergunta e slug, limitada a 200 bytes;
a [busca de produto da fase 15](search.md) implementa aliases e normalização de acentos
no índice estático do site, sem alterar esse filtro HTTP.

As respostas de recursos usam:

```json
{
  "publication": "ID_IMUTAVEL", "catalog_revision": "ID_DO_CATALOGO",
  "data": [], "next_cursor": "CURSOR_OPACO_QUANDO_HOUVER_PROXIMA_PAGINA"
}
```

Valores são strings decimais, nunca floats JSON. Cada ponto informa série, geografia,
início, fim, estado e nó com observação/contexto, ou motivo de indisponibilidade.
Origem inclui URL, SHA-256 e horário de coleta; a aceitação tem horário distinto.
Datas de publicação desconhecidas da fonte permanecem desconhecidas. O raw privado e suas
credenciais não são expostos. A auditoria limita-se aos IDs e origens fixados no manifesto;
uma publicação antiga não revela revisões posteriores.

`from`/`to` usam `YYYY-MM-DD`, inclusivos: só entram períodos inteiramente contidos.
Um filtro mensal não fatia um trimestre. Sem filtro, vale o escopo finito da publicação.
A série exige geografia quando houver várias opções; o resumo exige série/recorte quando
ambíguo. O último período indisponível não é substituído por um número anterior.
Uma lista sem correspondência retorna `data: []`. Um conceito sem cobertura informa
`status: not_covered`, com definição preservada.

Comparação exige as seis entradas da tabela. `from` identifica o início do período-base;
`to`, o fim do período final. Não escolhe o período mais próximo. A versão inicial aceita
`difference` e `relative-change`, ambas versão `2`, calculadas pela engine sobre IDs da
publicação, sem escrita. O resultado traz extremos, fórmula, inputs, valor ou motivo.
Datas sem cobertura ou dados incompatíveis produzem `not_comparable`, sem número.
A opção `assessment=material-v1` acrescenta direção e leitura por medida com regra explícita,
conforme o [comparador da fase 16](comparator.md). Versões desconhecidas são rejeitadas.
Sem essa opção, a resposta continua matemática. Mais de um período no extremo solicitado
produz `ambiguous_endpoints`, sem número. Não há score agregado nem atribuição de causalidade.

Paginação tem padrão de 50 e máximo de 200 itens. O cursor base64 opaco fixa operação,
publicação, filtros, limite, ordenação e posição. Não é um token de autorização.
Mudar o contexto exige reiniciar; uma ativação não troca o conjunto paginado.
As séries ordenam por início/fim dentro do recorte; há no máximo um ID por recorte/período.

## Calculadora de perfis

A fase 20 acrescenta `POST /api/v1/calculator`, com perfil e publicação no corpo JSON
limitado a 4096 bytes. O resultado é um cenário declarado, sem persistência, ativação ou
escrita em indicadores. Responde `no-store`, sem ETag; CORS deste recurso aceita
POST/OPTIONS e Content-Type. O [contrato da calculadora](calculator.md) documenta campos,
cálculos, referências e privacidade. As leituras GET existentes continuam sem corpo.

## Cache, erros e limites

| Resposta | Cache-Control |
|---|---|
| Alias atual/histórico bem-sucedido | `public, max-age=0, s-maxage=60, must-revalidate` |
| Leitura por publicação e projeção bem-sucedidas | `public, max-age=31536000, immutable` |
| Calculadora de perfis, inclusive sucesso | `no-store`, sem ETag |
| Erro, saúde ou requisição com Authorization/Cookie | `no-store` |

GET e HEAD oferecem ETag de bytes canônicos e `If-None-Match`/304. CORS da API permite
origem `*`, GET/HEAD/OPTIONS nas leituras, sem credenciais. A calculadora aceita
POST/OPTIONS com Content-Type, sem credenciais. O [ADR-0003](../adr/0003-data-versioning-and-cache.md)
define configuração obrigatória da CDN/R2, domínio e CORS dos objetos; os headers locais
não comprovam cache na borda. Não servir alias vencido em erro nem armazenar 4xx/5xx.

Erros usam `{"error":{"code":"...","message":"..."}}` e `no-store`:

| HTTP | Códigos |
|---|---|
| 400 | `invalid_request`, `cursor_context_mismatch` |
| 404 | `not_found`, `not_covered` |
| 409 | `ambiguous_selection` |
| 405 | `method_not_allowed` |
| 415 | `invalid_request`, tipo de mídia incorreto na calculadora |
| 429 | `rate_limited`, com Retry-After |
| 503 | `temporarily_unavailable`, inclusive objeto retido ausente/corrompido |

Parâmetros desconhecidos, repetidos, vazios, datas inválidas, intervalos invertidos e
cursores de outro contexto são rejeitados. Nunca trocar para a publicação atual em falha.
Não há expiração automática de contexto nesta entrega.

Limites iniciais: URI de 4 KiB, headers de 16 KiB, corpo proibido nas leituras, intervalo
explícito de até 100 anos, oito consultas simultâneas, timeout de consulta de 10 s e escrita
HTTP de 15 s. Há 120 requisições por minuto por IP da conexão, por processo, com tabela
limitada a 10 mil IPs; saturação de concorrência retorna 503. Headers de proxy enviados pelo
cliente não alteram a identidade. Em proxy, o limite agrega conexões do proxy; proteção
por IP final exige configurar uma camada confiável na implantação. A proteção local não
substitui limite de tráfego distribuído. Não há benchmark de carga de produção.

Manifestos/projeções têm até 16 MiB, 20 mil recortes, 30 mil dependências e profundidade 32.
A API lê a projeção completa, limitada e verificada por hash, antes de filtrar/paginar.
Isso simplifica consistência para o volume atual; leitura seletiva e projeções particionadas
podem ser avaliadas se volume/latência medidos exigirem. A [fase 21](performance.md)
adiciona cache residente de projeções verificadas: até duas edições, orçamento serializado
de 16 MiB e validade de 60 s, sem renovação em acertos. A autorização da publicação continua
consultada no PostgreSQL em cada leitura. Objeto removido pode permanecer legível no cache
até essa validade; depois dela, falhas retornam 503 sem conteúdo vencido. Mapas e ponteiros
do snapshot são compartilhados somente para leitura. Perfis/resultados pessoais e aliases
não entram nesse cache. `API_SNAPSHOT_CACHE=false` o desativa no comando `serve`.

## Configuração e verificação

Além das variáveis de [pipelines](pipelines.md), definir `PUBLIC_BUCKET`, distinto de
`RAW_BUCKET`. O mesmo endpoint S3 atende ambos, com credenciais apropriadas ao processo.
`API_ADDR` tem padrão `127.0.0.1:8080`; para um container publicado, configurar endereço
externo explicitamente. A imagem aceita `margem serve` como comando em vez do cron `tick`.
`GET /healthz` indica processo vivo; não certifica disponibilidade de uma publicação.
O servidor encerra com os sinais do processo e prazo de 10 s para conexões em andamento.

```bash
TEST_DATABASE_URL=postgresql://margem:local-only@127.0.0.1:55437/margem \
TEST_S3_ENDPOINT_URL=http://127.0.0.1:59007 REQUIRE_INTEGRATION=1 pnpm test:backend
```

[Testes de integração](../../backend/integration/publication_test.go) exercitam job, raw,
aceitação, publicação, API, repetição, revisão, concorrência, rollback, retorno, corte,
linhagem, paginação e permissões em bancos/buckets temporários. Os
[testes HTTP](../../backend/internal/api/http_test.go) cobrem cache, ETag/HEAD, CORS,
erros, ambiguidade, períodos inteiros e limites de abuso. A
[PoC foi retirada](ingestion.md) após preservar o arquivo e comprovar a substituição.
A [regra permanente de SEO/descoberta](../../AGENTS.md) continua obrigatória na integração
do frontend: HTML e dados devem fixar a mesma publicação. Esta fase não altera páginas públicas.

Referências de implementação: [chi](https://github.com/go-chi/chi) e
[net/http](https://pkg.go.dev/net/http).
