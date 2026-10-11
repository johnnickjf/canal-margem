# MARGEM — site editorial

Política / Economia / Pessoas. Site estático em [Astro](https://astro.build), construído a partir do
Manual de Marca v1.0 (`docs/brand/`).

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # checagem de tipos + build estático em dist/
npm run preview   # serve o build localmente
```

Requer Node 22.12 ou superior.

---

## Estrutura

```text
docs/brand/                 Manual de marca, tokens e pranchas de referência
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

## Publicando conteúdo

Todo conteúdo é Markdown com frontmatter validado. Um campo errado interrompe o build com uma mensagem clara.

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

Mesmo arquivo, com `format: corte` e `parent: <id-do-episódio>` (nome do arquivo sem `.md`).
O corte herda a numeração `M / 022`.

### Nova análise — `src/content/analises/slug.md`

Campos: `title`, `dek`, `author`, `tema`, `publishedAt`, `cover`, e opcionalmente `episode`, `featured`,
`sources`, `updatedAt`, `draft`. Citações em `>` viram olho tipográfico; o primeiro parágrafo recebe capitular.

### Títulos

Regra do manual: 2–5 palavras, caixa alta (automática), no máximo **um** trecho destacado entre `[colchetes]`.
O schema rejeita mais de um destaque.

### Rascunhos

`draft: true` mantém o item visível em `npm run dev` e fora do build de produção.

## Imagens

As fotos são referenciadas por chave em `src/data/photos.ts`. Para usar material próprio, coloque o arquivo em
`public/images/` e troque o `src` da chave (ex.: `'/images/metro.jpg'`) — nenhum conteúdo precisa mudar.
O tratamento documental (dessaturação, contraste, grão) é aplicado pelo componente `Photo`.

As fotos atuais vêm do Unsplash (licença Unsplash) e os créditos aparecem em `/sobre#creditos`.

## Sistema visual

- **Tokens** em `src/styles/tokens.css`, espelhando `docs/brand/MARGEM_design_tokens.json`.
- **Cor 80/15/5**: papel domina, carvão estrutura, vermelho só como marca-texto.
  `--red-on-dark` é uma variação clareada do vermelho apenas para texto sobre preto (contraste AA).
- **Tipografia** auto-hospedada via Fontsource: Bebas Neue (títulos), Inter (corpo/UI), IBM Plex Mono (labels, datas, `M / 000`).
- **Texturas** procedurais em SVG (`textures.css`): papel, concreto, grunge vermelho e halftone — sem arquivos pesados.
- **Bordas rasgadas** geradas em `src/lib/torn.ts` como `clip-path` determinístico por `seed`.
- **Thumbnails** (`VideoThumb`) seguem a prancha P02 — selo, título em retalho, lower third e episódio — e
  escalam com container queries, servindo do card pequeno ao player.
- **Movimento**: 150–350 ms, `ease-out`, sem bounce; tudo desativado com `prefers-reduced-motion`.

## Configuração antes de publicar

1. Domínio definitivo em `astro.config.mjs` (`site`), `src/config/site.ts` (`url`) e `public/robots.txt`.
2. Perfis oficiais em `socials` e e-mails em `contact` (`src/config/site.ts`).
3. Endpoint da newsletter em `newsletter.action` (Buttondown, Substack, Mailchimp ou próprio). Enquanto vazio,
   o formulário não envia dados e informa que as inscrições abrem em breve.
4. `youtubeId` de cada episódio publicado.
5. Revisar os textos de exemplo em `src/content/` — eles ilustram o formato e o tom, não são pautas apuradas.

## Acessibilidade

Contraste WCAG AA, corpo mínimo 16px, foco visível em vermelho, link "Pular para o conteúdo", menu mobile em
`<dialog>` nativo (foco preso e `Esc`), estados que não dependem só de cor, `alt` descritivo em todas as fotos e
player do YouTube com legendas ativadas por padrão.

---

## Imagens de posts (redes sociais)

A pasta `posts/` guarda as imagens usadas nos posts agendados no Buffer. O Buffer lê essas imagens por link público (`raw.githubusercontent.com/.../posts/...`), então **não renomeie nem mova arquivos dessa pasta** depois de agendar um post.
