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
pnpm check        # Biome + checagem do Astro
pnpm build        # check + build estático em dist/
pnpm preview      # serve o build localmente
```

Requer Node 22.13 ou superior e pnpm 11.22.0, fixado em `packageManager`.
Se o pnpm ainda não estiver instalado, use `npm install --global pnpm@11.22.0`.

O lockfile do projeto é `pnpm-lock.yaml`. Em CI, use `pnpm install --frozen-lockfile`.
`pnpm-workspace.yaml` autoriza o script de instalação de `esbuild`, necessário à ferramenta de build.

---

## Evolução para a plataforma Margem

O contexto de produto, a arquitetura futura e o roadmap estão no [índice de documentação](docs/README.md).
A [auditoria do frontend](docs/systems/frontend.md) descreve a base atual, o que pode ser reutilizado e as limitações.
As fases 0 e 1 cobrem a documentação da base e o design system; serviços de dados pertencem às fases seguintes.

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
pnpm test           # validação completa: coverage + test:e2e
```

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
docs/                       Visão, UX, arquitetura, roadmap e índice de documentação
  brand/                    Manual de marca, tokens e pranchas de referência
  research/                 Investigações e hipóteses
  adr/                      Decisões técnicas
  data-sources/             Catálogo futuro de fontes
  systems/                  Auditoria do frontend e documentação dos sistemas
public/                     favicon (M|), robots.txt
src/
  config/site.ts            Textos institucionais, navegação, canais, contato, newsletter, CTAs
  content.config.ts         Schemas das coleções (validação no build)
  content/
    temas.json              Os 12 pilares editoriais
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
3. Endpoint da newsletter em `newsletter.action` (Buttondown, Substack, Mailchimp ou próprio). Enquanto vazio,
   o JavaScript bloqueia o envio e informa que as inscrições abrem em breve. Sem JavaScript, o formulário
   pode enviar um POST para a página atual; revisar esse estado antes de publicar.
4. `youtubeId` de cada episódio publicado.
5. Revisar os textos de exemplo em `src/content/` — eles ilustram o formato e o tom, não são pautas apuradas.

## Acessibilidade

O código inclui corpo base de 16px, foco visível, link "Pular para o conteúdo", menu mobile em `<dialog>`
nativo e fotos com `alt`. Labels e alguns textos de UI usam tamanhos menores que 16px.
O player solicita legendas ao YouTube; a exibição depende das legendas disponíveis no vídeo.

O manual exige contraste WCAG AA e estados que não dependam só de cor. A conformidade de todos os estados
ainda precisa de validação visual e assistiva; o build não comprova esses requisitos.

---

## Imagens de posts (redes sociais)

A pasta `posts/` guarda as imagens usadas nos posts agendados no Buffer. O Buffer lê essas imagens por link público (`raw.githubusercontent.com/.../posts/...`), então **não renomeie nem mova arquivos dessa pasta** depois de agendar um post.
