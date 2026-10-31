# MARGEM — site editorial

Política / Economia / Pessoas. Site estático em [Astro](https://astro.build), construído a partir do
Manual de Marca v1.0 (`docs/brand/`).

## Requisito permanente: SEO e descoberta por IA

As páginas públicas destinadas à descoberta devem priorizar SEO para que motores de busca,
indexadores e agentes de IA encontrem, leiam e compreendam o projeto e seu conteúdo de forma
eficiente. **Esta regra nunca deve ser perdida ou enfraquecida**, inclusive na evolução para a
plataforma Margem. Ela é um critério de aceitação de mudanças nas páginas, nos layouts, na
navegação e na publicação.

As [instruções permanentes do projeto](AGENTS.md) detalham os requisitos de HTML acessível,
metadados, URLs canônicas, links rastreáveis, sitemap, `robots.txt` e dados estruturados,
além das verificações necessárias antes de concluir alterações. Preserve esta referência
ao reorganizar a documentação.

## Desenvolvimento local

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm dev:full     # PostgreSQL + LocalStack + API + Astro
pnpm check        # Biome + checagem do Astro
pnpm build        # check + build estático em dist/
pnpm preview      # serve o build localmente
```

Requer Node 22.13 ou superior e pnpm 11.22.0, fixado em `packageManager`.
Se o pnpm ainda não estiver instalado, use `npm install --global pnpm@11.22.0`.
`pnpm dev:full` também requer Go 1.26.6 e Docker Compose. O comando inicia os serviços
locais de `backend/compose.yaml`, aplica as migrações no PostgreSQL local e sobe a API em
`http://127.0.0.1:8080` junto com o Astro. O frontend usa a API se a publicação ativa e sua
projeção estiverem disponíveis; sem publicação ou projeção, mostra o catálogo sem observações
e informa o problema no terminal. Pare o `pnpm dev` atual e qualquer API na porta 8080 antes
de iniciar o comando completo.
`Ctrl+C` encerra os servidores; PostgreSQL e LocalStack permanecem ativos. **O estado S3
do LocalStack local é efêmero:** ao parar ou reiniciar o serviço, os buckets e objetos podem
desaparecer mesmo que o banco mantenha referências a eles. Preserve e verifique uma cópia
antes de interrompê-lo. O comando `pnpm backup:local` copia o banco e os dois buckets locais;
consulte as [condições e limitações](docs/systems/pipelines.md#cópia-local-antes-de-interromper-os-serviços)
e o [ensaio de recuperação](docs/systems/evidence/phase-25-local/recovery.md).
O comando lê os padrões de `backend/.env.example` e aceita ajustes locais em `backend/.env`.

O lockfile do projeto é `pnpm-lock.yaml`. Em CI, use `pnpm install --frozen-lockfile`.
`pnpm-workspace.yaml` autoriza o script de instalação de `esbuild`, necessário à ferramenta de build.

---

## Evolução para a plataforma Margem

O contexto de produto, a arquitetura futura e o roadmap estão no [índice de documentação](docs/README.md).
A [auditoria do frontend](docs/systems/frontend.md) descreve a base atual, o que pode ser reutilizado e as limitações.
As fases 0 e 1 cobrem a documentação da base e o design system. A fase 2 define o
[modelo conceitual dos dados](docs/systems/data-model.md), com entidades, metadados, revisões e
cálculos derivados exemplificados em JSON. O [catálogo de operações](docs/systems/data-operations.md)
complementa o modelo com leituras, escritas e garantias de consistência, aceitação e publicação.
É uma especificação independente de banco e framework;
serviços de dados pertencem às fases seguintes. A fase 3 fixa os
[15 indicadores principais do MVP](docs/systems/mvp-indicators.md), incluindo cesta básica,
tempo de trabalho pelo salário mínimo, insegurança alimentar e moradia. O salário mínimo real
usa INPC como deflator; jornada e inadimplência acompanham a leitura como contexto.
O [mapa de fontes](docs/research/source-map.md) separa fontes necessárias e candidatas à expansão.
A fase 4 entrega o [catálogo de fontes](docs/data-sources/README.md), com recortes dos 15
principais, contextos e inputs, amostras oficiais e limites de histórico, método e acesso.
As [investigações de renda/hora, Peic e inflação por renda](docs/research/phase-4-investigations.md)
têm conclusão documental. A fase 5 implementa a [PoC de ingestão](docs/systems/ingestion.md)
com TR4, CV1 e VF1 (IBGE e BCB): quatro séries, raw preservado, validação, persistência local,
revisões e exportação JSON. A coleta real desde 2012 aceitou 587 observações; a repetição criou
zero revisões. A fase 6 define a [arquitetura de armazenamento](docs/systems/storage.md):
PostgreSQL na Railway, raw privado no Cloudflare R2, histórico por manifesto, cache HTTP
e recuperação por backup nativo da Railway ou reconstrução pelos pipelines, com decisões e custos registrados em [cinco ADRs](docs/adr/README.md). São decisões documentadas;
serviços remotos ainda não foram implantados. A fase 7 implementa os
[pipelines do MVP](docs/systems/pipelines.md): cinco jobs de fontes, PostgreSQL, raw no Cloudflare R2 pela API compatível com S3,
agendamento, qualidade, histórico e observabilidade. A coleta local real aceitou 6.375
observações; a repetição não criou versões. A importação da PoC preserva 21 arquivos e
587 observações, sem promoção pública. A migração para [Go e monólito modular](docs/adr/0007-go-modular-backend.md) preserva
os contratos e separa comandos de consultas. A fase 8 implementa a [engine de indicadores](docs/systems/indicator-engine.md): TR2, CV5,
variações, índices e relações cesta/renda, com inputs explícitos, precisão decimal e histórico
imutável. A fase 9 implementa a [API Margem](docs/systems/api.md), com publicações imutáveis,
ativação por geração, consultas versionadas, paginação, cache HTTP, comparação e limites
de abuso. O fluxo local com coleta oficial foi verificado e a [PoC foi retirada](docs/systems/ingestion.md)
após preservar 21 arquivos e 587 observações para auditoria. A fase 10 implementa o
[shell da plataforma](docs/systems/platform-shell.md), com home integrada, temas, indicadores,
entrada do comparador e conteúdo Entenda. O build fixa uma publicação da API em todas as
páginas e consultas; sem API configurada, exibe definições e indisponibilidade explícita.
A fase 11 implementa a [home orientada a perguntas](docs/systems/question-home.md): cinco
entradas do cotidiano levam aos temas e indicadores, com navegação sem JavaScript e conteúdo
editorial preservado. A fase 12 implementa as [páginas temáticas](docs/systems/theme-pages.md): resumos, mudanças
publicadas, recortes auditáveis, explicações e acesso ao guia do comparador. A fase 13 implementa as
[páginas de indicador](docs/systems/indicator-pages.md): valores por recorte, tendências publicadas,
gráficos e tabelas históricas, interpretação, alertas e auditoria. A fase 14 implementa a
[camada Entenda](docs/systems/entenda.md): 11 conceitos econômicos com referências, exemplos
hipotéticos e painel contextual nos indicadores, disponível também sem JavaScript.
A fase 15 implementa a [busca por linguagem cotidiana](docs/systems/search.md), com aliases,
filtros, indicadores, Entenda e acervo editorial no mesmo índice estático; o catálogo
continua navegável sem JavaScript. A fase 16 implementa o [comparador](docs/systems/comparator.md),
com seleção de temas, indicadores, recortes e períodos, cálculos pela API e critérios de leitura
versionados com auditoria. A fase 17 implementa a tradução de [preços em tempo de trabalho](docs/systems/work-time.md):
cesta em reais, percentual do salário mínimo bruto e horas/minutos, com referência de 220 horas
mensais, mesma edição/mês e auditoria. A fase 18 implementa [políticas públicas e linha histórica](docs/systems/policy-history.md):
catálogo editorial de políticas, legislação, governos e vigências, com fontes, relações
investigáveis e faixas no mesmo eixo temporal dos indicadores. A fase 19 implementa
[evidência e causalidade](docs/systems/evidence.md): estudos, métodos, contrafactuais,
hipóteses e limites, associados às políticas e aos indicadores sem atribuição automática
de efeitos. A fase 20 implementa a [calculadora socioeconômica](docs/systems/calculator.md):
orçamento familiar, cenário hipotético de renda, cesta por capital/mês e tempo pela renda
individual declarada, com políticas e estudos relacionados, auditoria e perfil sem persistência.
O catálogo atual não permite estimar efeitos individuais. A fase 21 implementa
[escala e performance](docs/systems/performance.md): benchmarks reproduzíveis, cache limitado
de projeções verificadas e expiração de IPs sem varredura completa por requisição. A avaliação
local adia novas camadas de infraestrutura até haver demanda medida. A fase 22 acrescenta
métricas HTTP e do cache, prontidão da publicação, logs de duração dos jobs e um check de saúde
com código de saída ou webhook para alertas externos. O [runbook](docs/systems/operations.md)
registra a configuração necessária; Railway/R2, notificações ativas, CDN e disponibilidade do
frontend permanecem posteriores. A fase 23 implementa o [histórico público de edições e a
auditoria dos dados](docs/systems/audit-transparency.md): a página `/auditoria` percorre
indicador, cálculo, série, dataset e fonte; a API pagina as ativações e preserva links para
manifestos e séries JSON. Revisões oficiais só aparecem quando incorporadas a uma nova edição;
os objetos raw continuam privados. A fase 24 acrescenta a [checagem pós-publicação](docs/systems/deployment-check.md)
do sitemap, páginas públicas, SEO e, quando informada, prontidão da API; ela não realiza deploy.
A fase 25 registra o [ensaio local da experiência editorial e da publicação](docs/04-roadmap.md):
o fluxo API → HTML foi observado, mas a cobertura permanece parcial, há objetos históricos
ausentes e a operação remota ainda não foi verificada.

```bash
MARGEM_API_URL=http://127.0.0.1:8080 pnpm build  # API já operando, origem sem caminho
MARGEM_API_URL=http://127.0.0.1:8080 pnpm build:publication  # artefato isolado com geração conferida
```

O segundo comando prepara um artefato local após ativação, sem publicar o site. Consulte as
[condições de uso e limites](docs/systems/platform-shell.md#publicação-fixada-no-build),
inclusive a necessidade de coordenar builds e conferir a geração antes da promoção.

```bash
pnpm pipeline run --source ibge --from 2025-01-01 --to 2025-12-31
pnpm pipeline prepare --manifest .data/publication.json
pnpm pipeline activate --manifest .data/activation.json
pnpm pipeline monitor
pnpm pipeline serve                # http://127.0.0.1:8080
```

Consulte [manifestos, contrato HTTP e configuração](docs/systems/api.md).
Jobs e API executam separadamente; visitas ao site não disparam coletas.

## Design system

A referência de componentes está em `/design-system` (`http://localhost:4321/design-system` no
desenvolvimento). Inclui tokens, os 16 componentes básicos e os sete componentes de indicadores
da fase 1, com dados explicitamente fictícios. Contratos, estados e limites estão na
[documentação do design system](docs/systems/design-system.md).

```bash
pnpm exec playwright install chromium  # preparação do navegador de teste
pnpm test:e2e                         # check + build + testes desktop/mobile
```

A referência utilitária usa `noindex` e fica fora do sitemap. As páginas editoriais mantêm a
[regra obrigatória de SEO e descoberta por IA](AGENTS.md).

## Testes e cobertura

```bash
pnpm test:unit      # testes unitários de datas, formatação e títulos
pnpm test:coverage  # relatório V8 e limites de cobertura por módulo
pnpm test:e2e       # lint, tipos, build e Playwright
pnpm test:backend   # gofmt + vet + go test -race; serviços por variáveis de teste
pnpm bench:backend  # microbenchmarks locais de CPU, cache e limitador; sem serviços
pnpm test           # backend + coverage + test:e2e
```

Os jobs usam Go 1.26 (imagem fixada em 1.26.6), pgx e sqlc, sem ORM; consulte
[configuração, comandos e testes de integração](docs/systems/pipelines.md).
`pnpm pipeline` acessa a CLI, inclusive `formulas`, `calculate --manifest ARQUIVO` e
`calculation --id ID`; serviços de teste usam `backend/compose.yaml`.

A CI em [`.github/workflows/tests.yml`](.github/workflows/tests.yml) executa a validação em cada
PR e push. Sua primeira execução no GitHub depende do envio dessas alterações.
Os relatórios ficam em `coverage/`; capturas e traces, em `test-results/`. Esses diretórios
são ignorados pelo Git. A CI também guarda os relatórios como artefatos por 14 dias.

A cobertura unitária inclui `src/lib/**/*.ts` e `src/scripts/**/*.ts`, inclusive arquivos sem testes.
Datas, formatação e títulos têm limites por arquivo definidos após a medição inicial.
Esse percentual não mede os templates Astro nem os fluxos do Playwright. Escopo, métricas,
testes editoriais, validação de rascunhos/RSS e limites estão na [documentação de testes](docs/systems/testing.md).

## Estrutura

```text
backend/                    Backend Go: jobs, engine, publicações, API, PostgreSQL, R2 e testes
docs/                       Visão, UX, arquitetura, roadmap e índice de documentação
  brand/                    Manual de marca, tokens e pranchas de referência
  research/                 Investigações e hipóteses
  adr/                      Decisões técnicas
  data-sources/             Catálogo das fontes do MVP e evidências da fase 4
  systems/                  Auditoria do frontend e documentação dos sistemas
public/                     favicon (M|), robots.txt
src/
  config/site.ts            Textos institucionais, navegação, canais, contato e CTAs
  content.config.ts         Schemas das coleções (validação no build)
  content/
    temas.json              Os 7 temas editoriais publicados
    videos/*.md             Episódios (16:9) e cortes (9:16)
    analises/*.md           Artigos e análises
  data/
    photos.ts               Banco de imagens: chave → arquivo, alt, crédito, ponto focal
    manifesto.ts            Teses do manifesto, fórmula editorial e voz
  lib/                      Consultas de conteúdo, formatação, títulos, bordas rasgadas
  styles/                   Tokens, texturas procedurais e base (cascade layers)
  scripts/                  Comportamentos do cliente (revelação no scroll, busca)
  layouts/BaseLayout.astro  Documento, SEO, cabeçalho e rodapé
  components/
    brand/                  Logo (MARGEM|, MARGEM/, M|, selo)
    layout/                 Header, Footer, PageHeader, Seo
    ui/                     Headline, Button, Photo, SectionHeader, MetaLine, Prose, ShareBar…
    cards/                  VideoThumb, VideoCard, CutCard, ArticleCard
    video/                  VideoPlayer (fachada leve do YouTube), VideoFacts
    sections/               Seções da home, na ordem do manual
  pages/                    Rotas (home, vídeos, temas, análises, manifesto, sobre, busca, 404, RSS)
```

## Formatação e lint

```bash
pnpm lint          # verifica lint, formatação e organização de imports
pnpm lint:fix      # aplica correções seguras, formatação e organização de imports
pnpm format        # formata os arquivos suportados
pnpm format:check  # verifica formatação sem alterar arquivos
```

A configuração está em `biome.json`: dois espaços, largura alvo de 100 colunas e aspas simples em JavaScript/TypeScript e CSS. A extensão `biomejs.biome` está recomendada para o VS Code.

O Biome verifica JS/TS, JSON/JSONC, CSS e SVG. Nos arquivos `.astro`, a configuração atual processa apenas o frontmatter entre `---`; markup, blocos `<script>` e estilos embutidos ficam fora dessa cobertura. As regras de imports/variáveis não usados e a organização automática de imports estão desativadas em `.astro`, por causa das referências nos templates. `astro check` continua no comando `pnpm check` e complementa essa cobertura.

Referências: [configuração do Biome](https://biomejs.dev/reference/configuration/) e [importação de lockfiles no pnpm](https://pnpm.io/cli/import).

## Publicando conteúdo

Vídeos e análises usam Markdown com frontmatter; os temas ficam em `src/content/temas.json`.
Os schemas de `src/content.config.ts` validam campos e referências durante o build.

### Novo episódio — `src/content/videos/m022-slug.md`

```yaml
---
episode: 22
format: longo              # longo (16:9) | corte (9:16)
title: "Quem decide [o juro?]"   # o trecho entre colchetes fica em vermelho
dek: "Uma ou duas frases de contexto."
tema: poder-economico      # id de src/content/temas.json
publishedAt: 2026-10-09
duration: "21:30"
cover: avenida-paulista    # chave de src/data/photos.ts
youtubeId: "abc123XYZ"     # opcional; sem ele, o player mostra "Estreia em breve"
featured: true             # opcional; entra em "Vídeos em destaque"
chapters:
  - { time: "00:00", label: "Abertura" }
sources:
  - { label: "Banco Central — Ata do Copom", url: "https://..." }
---

Texto de apresentação do episódio.
```

### Novo corte

Crie outro arquivo Markdown com `format: corte` e `parent: <id-do-episódio>` (nome do arquivo sem `.md`).
Preencha `episode` com o mesmo número do episódio de origem; o código não herda esse campo de `parent`.

### Nova análise — `src/content/analises/slug.md`

Campos: `title`, `dek`, `author`, `tema`, `publishedAt`, `cover`, e opcionalmente `episode`, `featured`,
`sources`, `updatedAt`, `draft`. Citações em `>` viram olho tipográfico; o primeiro parágrafo recebe capitular.

### Títulos

O manual orienta títulos de 2–5 palavras, em caixa alta (aplicada pelo CSS), com no máximo um trecho
destacado entre `[colchetes]`. O schema rejeita mais de um `[`; não valida a contagem de palavras
nem o fechamento dos colchetes.

### Rascunhos

`draft: true` mantém o item visível em `pnpm dev` e fora do build de produção.

## Imagens

As fotos são referenciadas por chave em `src/data/photos.ts`. Para usar material próprio, coloque o arquivo em
`public/images/` e troque o `src` da chave (ex.: `'/images/metro.jpg'`) — nenhum conteúdo precisa mudar.
O tratamento documental (dessaturação, contraste, grão) é aplicado pelo componente `Photo`.

As fotos atuais vêm do Unsplash (licença Unsplash) e os créditos aparecem em `/sobre#creditos`.

## Sistema visual

- **Tokens** em `src/styles/tokens.css`, baseados em `docs/brand/MARGEM_design_tokens.json`, com extensões para o site. Não há sincronização automática entre os arquivos.
- **Cor 80/15/5**: papel domina, carvão estrutura, vermelho só como marca-texto.
  `--red-on-dark` é uma variação de texto clareada na fase 1 para melhorar o contraste sobre carvão e preto. Ver [tokens e validação do design system](docs/systems/design-system.md).
- **Tipografia** auto-hospedada via Fontsource: Bebas Neue (títulos), Inter (corpo/UI), IBM Plex Mono (labels, datas, `M / 000`).
- **Texturas** procedurais em SVG (`textures.css`): papel, concreto, grunge vermelho e halftone — sem arquivos pesados.
- **Bordas rasgadas** geradas em `src/lib/torn.ts` como `clip-path` determinístico por `seed`.
- **Thumbnails** (`VideoThumb`) seguem a prancha P02 — selo, título em retalho, lower third e episódio — e
  escalam com container queries, servindo do card pequeno ao player.
- **Movimento**: tokens de 150–350 ms, com easing sem bounce. Há exceções locais, como a transição de 600 ms em `Photo`. `prefers-reduced-motion` desativa o reveal, a animação do menu e a rolagem suave; outras transições permanecem ativas.

## Configuração antes de publicar

1. Domínio definitivo em `astro.config.mjs` (`site`), `src/config/site.ts` (`url`) e `public/robots.txt`.
2. Perfis oficiais em `socials` e e-mails em `contact` (`src/config/site.ts`).
3. `youtubeId` de cada episódio publicado.
4. Revisar os textos de exemplo em `src/content/` — eles ilustram o formato e o tom, não são pautas apuradas.

## Acessibilidade

O código inclui corpo base de 16px, foco visível, link "Pular para o conteúdo", menu mobile em `<dialog>`
nativo e fotos com `alt`. Labels e alguns textos de UI usam tamanhos menores que 16px.
O player solicita legendas ao YouTube; a exibição depende das legendas disponíveis no vídeo.

O manual exige contraste WCAG AA e estados que não dependam só de cor. A conformidade de todos os estados
ainda precisa de validação visual e assistiva; o build não comprova esses requisitos.

---

## Imagens de posts (redes sociais)

A pasta `posts/` guarda as imagens usadas nos posts agendados no Buffer. O Buffer lê essas imagens por link público (`raw.githubusercontent.com/.../posts/...`), então **não renomeie nem mova arquivos dessa pasta** depois de agendar um post.
