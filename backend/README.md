# Backend Margem

Monólito modular em Go. A fase 7 implementa os pipelines privados; a fase 8 acrescenta a
[engine de indicadores](../docs/systems/indicator-engine.md). A fase 9 implementa
[publicações e API](../docs/systems/api.md). A fase 20 acrescenta a
[calculadora socioeconômica](../docs/systems/calculator.md), com POST sem cache ou persistência do perfil. Contratos e evidências estão no
[manual de operação](../docs/systems/pipelines.md) e no
[ADR-0007](../docs/adr/0007-go-modular-backend.md).

## Organização

```text
cmd/margem/                  entrada da CLI e sinais de término
internal/app/                composição de dependências e tradução de comandos
internal/catalog/            recortes, unidades, métodos e versão do catálogo
internal/ingestion/          adaptadores de fontes, HTTP, jobs e saúde operacional
internal/indicators/         fórmulas versionadas, avaliações imutáveis e linhagem
internal/calculator/         cenários declarados e orçamento familiar, sem persistência
internal/observations/       regras, identidades, aceitação de lotes e integridade
internal/publications/       preparação, projeções imutáveis, ativação e histórico
internal/api/                HTTP v1, cache, filtros, paginação e limites
internal/legacy/             importação do arquivo histórico da PoC retirada
internal/period/             períodos de calendário e janelas
internal/platform/
    canonical/               serialização determinística e SHA-256
    postgres/                migração intacta e acesso SQL gerado por sqlc
    objectstore/             raw imutável no R2 via API compatível com S3, com conferência de bytes
integration/                 cenários PostgreSQL/LocalStack em recursos temporários
```

A organização é por responsabilidade de domínio. Fontes externas são adaptadores de
ingestão. `raw`, `normalized`, `derived` e `published` são etapas dos dados, sem exigir um
módulo para cada schema. Publicações possuem regras próprias no módulo correspondente.

## Regras de dependência e consistência

- `app` monta os módulos e não concentra regras de negócio.
- Ingestão solicita aceitação ao módulo de observações; regras numéricas e de identidade
  não pertencem à CLI ou ao cliente HTTP.
- Cada módulo coordena suas escritas em `commands.go`; `queries.go` retorna DTOs específicos
  de leitura. Consultas públicas leem publicações fixadas, sem reutilizar o estado
  operacional como seleção pública.
- SQL gerado é detalhe de persistência. Não expor suas estruturas como contrato HTTP nem
  criar um repositório CRUD genérico. Regenerar consultas após editar `queries.sql`.
- A aceitação é uma unidade transacional que também confirma recibo, proveniência e sucesso
  da execução. Essa fronteira atravessa schemas, mas conserva uma única transação local.
- Cada job mantém o advisory lock de sessão na mesma conexão PostgreSQL durante a coleta.
  Não manter transação SQL aberta durante HTTP/S3. Não usar mutex local como coordenação
  entre réplicas. Falha ao liberar o lock descarta a conexão.
- Revisões acrescentam observações; uma nova captura pode reutilizar bytes e observações.
  Aceitação não ativa uma publicação pública.

As transições operacionais atuais são `running → succeeded` e `running → failed`.
As duas são terminais. Uma nova tentativa tem outro run; uma execução órfã só é marcada
como falha depois de adquirir o lock da fonte. Condições SQL e lock do run impedem uma
segunda aceitação de execução terminal. Não é necessário um framework de estados.

Requer Go 1.26.6, Docker para integração e Node/pnpm conforme o README da raiz para os
wrappers. Sem pnpm, executar `go -C backend run ./cmd/margem --help`. O provedor de produção
é Cloudflare R2; o SDK AWS acessa sua API compatível com S3. Consulte a
[configuração R2 e os valores locais](../docs/systems/pipelines.md#armazenamento-cloudflare-r2).

## Comandos

Da raiz do repositório:

```bash
pnpm pipeline --help
pnpm pipeline migrate
pnpm pipeline prepare --manifest .data/publication.json
pnpm pipeline activate --manifest .data/activation.json
pnpm pipeline current
pnpm pipeline serve
pnpm pipeline formulas
pnpm pipeline calculate --manifest .data/calculations.json
pnpm pipeline calculation --id ID
pnpm pipeline run --source bcb --from 2025-01-01 --to 2025-12-31
pnpm pipeline tick
pnpm pipeline status
pnpm pipeline verify
pnpm pipeline import-poc --root .data/ingestion
pnpm generate:backend
pnpm test:backend
```

Como `go -C backend` executa dentro de `backend/`, o caminho relativo passado a `--root`
é resolvido pelo wrapper de desenvolvimento em relação à raiz do repositório; o binário
compilado resolve caminhos em relação ao diretório em que é executado.

As variáveis e o preparo dos serviços estão em [`.env.example`](.env.example) e no
[manual](../docs/systems/pipelines.md). O servidor público inicia com `serve`; não há provisionamento automático,
fila ou scheduler residente. A imagem Docker executa um binário Go sem Python e termina
ao concluir o job. A API usa `net/http` com `chi`; publicação administrativa ocorre pela CLI.

`pnpm test:backend` verifica formatação, vet e testes com detector de corridas; requer
CGO habilitado e um compilador C disponível (por exemplo, GCC). Testes de
serviços requerem `TEST_DATABASE_URL` e `TEST_S3_ENDPOINT_URL`; `REQUIRE_INTEGRATION=1` impede
um falso sucesso por falta de configuração. O teste confere o banco efetivamente conectado
antes de aplicar migrações. Bancos e buckets de teste têm nomes aleatórios próprios.

A [regra permanente de SEO e descoberta por IA](../AGENTS.md) continua obrigatória para
qualquer evolução que afete páginas públicas, representações e a futura API.
