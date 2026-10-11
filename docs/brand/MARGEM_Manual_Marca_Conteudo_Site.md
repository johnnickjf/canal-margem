# MARGEM — Manual de Marca, Conteúdo e Handoff para Site
Versão 1.0

> **MARGEM** é uma marca editorial de opinião sobre política, economia e vida cotidiana.  
> A identidade deve parecer **crítica, humana, contemporânea, documental e acessível** — nunca panfletária, partidária ou excessivamente “tech”.

---

## 1. Essência da marca

### Nome
**MARGEM**

### Assinatura principal
**POLÍTICA / ECONOMIA / PESSOAS**

### Frase institucional
**OUTRO PONTO DE VISTA É POSSÍVEL.**

### Frases-chave
- **A VIDA REAL TAMBÉM É POLÍTICA.**
- **O QUE OS NÚMEROS NÃO CONTAM.**
- **ECONOMIA É GENTE.**
- **REALIDADE CONTRA DISCURSO.**
- **DA MARGEM TAMBÉM SE CONSTRÓI UM PAÍS.**
- **MESMAS PESSOAS. OUTRAS PERGUNTAS.**
- **POLÍTICA COMEÇA NA VIDA REAL.**

### Posicionamento
> Análise crítica do Brasil real: política, economia e sociedade com contexto, dados e olhar humano.

A marca deve partir das **condições materiais da vida cotidiana**: trabalho, renda, aluguel, comida, transporte, cidade, tempo, serviços públicos, desigualdade, poder e democracia.

A estética pode carregar referências sutis ao pensamento de esquerda e ao materialismo, mas **sem símbolos partidários ou comunistas explícitos**. O objetivo é convidar o público à reflexão antes de rotulá-lo ideologicamente.

---

## 2. Personalidade

### A marca é
- Crítica
- Clara
- Humana
- Popular sem ser simplista
- Objetiva
- Contextual
- Curiosa
- Urbana
- Documental
- Séria sem ser sisuda
- Inteligente sem ser professoral

### A marca NÃO é
- Partidária visualmente
- Panfletária
- Acadêmica demais
- Agressiva por padrão
- “Coach”
- Corporate
- Futurista / neon
- Clickbait vazio
- Cheia de efeitos
- Vermelha em excesso

---

## 3. Paleta oficial

| Token | Cor | Hex | Uso |
|---|---|---:|---|
| `paper` | Papel | `#E8E2D9` | Fundo principal |
| `paper-light` | Papel claro | `#F2EEE7` | Áreas de leitura |
| `burnt-red` | Vermelho queimado | `#8F2D24` | Destaques |
| `charcoal` | Carvão | `#1F1F1F` | Texto / base |
| `video-black` | Preto vídeo | `#0D0D0D` | Fundo escuro |
| `concrete` | Concreto | `#9A9A9A` | Secundário |
| `ink-muted` | Tinta cinza | `#66625D` | Texto secundário |

### Regra 80/15/5
- **80%** papel / claro
- **15%** carvão / preto
- **5%** vermelho queimado

O vermelho deve funcionar como **marca-texto**, não como fundo dominante em todas as peças.

---

## 4. Tipografia

### Títulos
**Bebas Neue**
- Caixa alta
- 2 a 5 palavras sempre que possível
- Tracking baixo a normal
- Alto contraste
- Ideal para thumbnails, chamadas, hero, títulos de vídeo

### Corpo / UI
**Inter**
- Regular 400 para corpo
- Medium 500 para labels
- SemiBold 600 para destaques
- Excelente legibilidade em site e mobile

### Números / códigos / episódios
**IBM Plex Mono**
- Episódios: `M / 021`
- Datas
- Categorias
- Labels editoriais
- Dados pontuais
- Pequenas notas técnicas

### Fallbacks web
```css
--font-display: "Bebas Neue", "Arial Narrow", sans-serif;
--font-body: "Inter", system-ui, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, monospace;
```

---

## 5. Sistema de logo

### Principal
`MARGEM` + barra vertical em vermelho queimado.

### Variações
- `MARGEM|`
- `MARGEM/`
- `M|`
- Selo preto com `MARGEM|` em claro

### Uso
- Fundo claro → logo carvão + barra vermelha
- Fundo escuro → logo papel + barra vermelha
- Vídeo → selo preto no canto superior esquerdo
- Favicon → `M|`

### Área de segurança
Nunca encostar o logo nas bordas.  
Em vídeo Full HD, usar pelo menos **48 px** de margem.

---

## 6. Texturas

Texturas oficiais:
1. Papel rasgado / fibroso
2. Concreto cinza
3. Grunge vermelho e preto
4. Halftone preto e branco

### Regra de uso
Textura é **camada**, não protagonista.

Use em:
- fundo
- transições
- máscaras
- bordas
- colagens
- detalhes de cards
- áreas vazias

Evitar:
- textura forte atrás de texto longo
- vários tipos de textura competindo
- ruído visual excessivo

---

## 7. Fotografia e imagem

### Priorizar
- Pessoas reais
- Transporte público
- Mercado
- Trabalho
- Mãos
- Ruas
- Prédios
- Habitação
- Comércio
- Filas
- Recibos
- Preços
- Cidades
- Trabalhadores
- Multidões
- Contrastes urbanos

### Tratamento
- Documental
- Saturação levemente reduzida
- Contraste médio/alto
- Grão sutil
- Preto e branco quando fizer sentido
- Vermelho como interferência gráfica pontual

### Princípio
> Política não acontece só em Brasília. Política acontece na vida cotidiana.

---

## 8. Títulos e copy

### Padrão visual
- 2–5 palavras
- Caixa alta
- Bebas Neue
- Uma palavra ou trecho pode receber vermelho
- Nunca destacar tudo

### Exemplos
- **QUEM PAGA?**
- **QUEM GANHA?**
- **POR QUE SUBIU?**
- **NÃO É ACASO**
- **O PREÇO DO ALUGUEL**
- **QUEM DECIDE?**
- **O QUE OS NÚMEROS NÃO CONTAM**
- **A VIDA REAL TAMBÉM É POLÍTICA**

### Estrutura de títulos
Prefira perguntas e conflitos concretos em vez de conclusões ideológicas.

Em vez de:
> “A burguesia controla o Estado”

Preferir:
> **QUEM REALMENTE INFLUENCIA ESSA DECISÃO?**

Em vez de:
> “Mais-valia”

Preferir:
> **PARA ONDE VAI O VALOR QUE VOCÊ PRODUZ?**

---

## 9. Vídeos

### Horizontal — YouTube / site
Formato: **16:9**

Fluxo visual:
1. Textura / ruído — 0,3 a 0,8s
2. Logo MARGEM — 0,4 a 0,8s
3. Título curto — 0,7 a 1,2s
4. Começa o vídeo

**Abertura total sugerida: 1,5 a 3 segundos.**

### Vertical — Shorts / Reels / TikTok
Formato: **9:16**
- Marca d'água topo esquerdo
- Título forte na metade superior ou centro
- Legenda no terço inferior
- Lower third apenas quando acrescentar contexto
- Respeitar safe areas dos apps

### Marca d'água
- Topo esquerdo
- Opacidade: 85–100%
- Não animar continuamente
- Pequena e reconhecível

### Lower third
Campos:
- TEMA PRINCIPAL
- SUBTÍTULO OU CONTEXTO
- `M / 021`

Máximo: **2 linhas**.

---

## 10. Legendas

### Estilo
- Inter SemiBold
- Máximo 2 linhas
- Branco/papel como padrão
- Destaques pontuais em vermelho
- Sem rainbow captions
- Fundo preto semitransparente apenas quando necessário

### Conteúdo
Corrigir manualmente:
- nomes
- siglas
- números
- instituições
- termos econômicos
- datas

---

## 11. Thumbnails

### Princípio
**Uma ideia visual + uma frase curta.**

### Estrutura
- Rosto / pessoa / objeto forte em 35–50% da área
- Título em Bebas Neue
- 2–5 palavras idealmente
- Contraste alto
- Vermelho apenas no termo principal
- Textura sutil
- Logo discreto

### Evitar
- Texto demais
- Muitos rostos
- Setas amarelas genéricas
- Emojis
- “YouTube face”
- Poluição visual

---

## 12. Pilares editoriais

1. Trabalho
2. Renda
3. Custo de vida
4. Habitação
5. Cidade
6. Serviços públicos
7. Democracia
8. Desigualdade
9. Tecnologia e trabalho
10. Tributação
11. Poder econômico
12. Vida cotidiana

---

## 13. Voz editorial

### Fazer
- Fazer perguntas diretas
- Explicar causas
- Dar contexto histórico quando necessário
- Mostrar dados
- Traduzir economia para a vida real
- Apresentar contrapontos honestos
- Usar exemplos cotidianos
- Manter linguagem acessível

### Evitar
- Jargão sem explicação
- “Você precisa entender que…”
- Tom professoral
- Moralismo
- Humilhação gratuita
- Jargão partidário em títulos
- Defender conclusão antes de construir argumento

### Fórmula recomendada
**GANCHO → PROBLEMA → DADO → CONTEXTO → EXEMPLO → CONTRAPONTO → INTERPRETAÇÃO → CONCLUSÃO**

---

## 14. Descrições oficiais dos canais

### YouTube
**Política, economia e pessoas. Análises críticas do Brasil real, com contexto, dados e olhar humano.**

Versão expandida:
> MARGEM é um espaço de análise sobre política, economia e vida cotidiana. Trabalho, renda, cidade, poder, desigualdade e democracia explicados a partir da vida real — com dados, contexto e perguntas que nem sempre cabem no centro do debate.

### Instagram / TikTok / Shorts
**Política, economia e vida real. Cortes, análises e ideias para entender o Brasil além do óbvio.**

### X / Threads / Bluesky
**Política, economia, trabalho e vida cotidiana. Dados, contexto e opinião. Outro ponto de vista é possível.**

### LinkedIn
**Economia, trabalho, renda, tecnologia e política vistas pela vida real. Análises com contexto, dados e perspectiva humana.**

### Site
**Um espaço editorial sobre trabalho, renda, cidade, democracia e cotidiano.**

---

## 15. Bio curta

Opção principal:
> Política, economia e pessoas.  
> O que os números não contam.

Alternativa:
> A vida real também é política.  
> Economia, poder e cotidiano.

---

## 16. CTAs

Preferidos:
- **Assista ao vídeo completo.**
- **Salve para rever.**
- **Envie para quem precisa ver isso.**
- **Comente sua leitura.**
- **Compartilhe com contexto.**
- **Veja a análise completa.**

Evitar:
- “DEIXA O LIKE AGORA”
- excesso de caixa alta
- urgência artificial

---

## 17. Sistema de episódios

Formato recomendado:
`M / 001`

Exemplos:
- `M / 001`
- `M / 021`
- `M / 104`

Uso:
- vídeo
- thumbnail
- lower third
- artigo
- página do episódio
- metadata interna

---

## 18. Estrutura inicial do site

### Header
- Logo
- Vídeos
- Temas
- Manifesto
- Sobre
- Busca

### Hero
Headline:
**O QUE OS NÚMEROS NÃO CONTAM**

Subheadline:
**Análises para além do óbvio.**

CTAs:
- **VER VÍDEOS**
- **LER MANIFESTO**

### Seções
1. Vídeos em destaque
2. Últimos cortes
3. Temas
4. Manifesto
5. Artigos / análises
6. Newsletter
7. Sobre a MARGEM
8. Contato

### Cards
Devem parecer páginas/editoriais, não cards SaaS.
- Pouco raio de borda
- Linhas finas
- Textura sutil
- Imagem documental
- Labels mono
- Muito respiro

---

## 19. Direção para o site — Claude / implementação

### Sensação desejada
“Revista independente brasileira contemporânea com linguagem documental.”

### Não fazer
- UI de startup SaaS
- Cards flutuantes com blur
- Glassmorphism
- Gradientes neon
- Bordas arredondadas demais
- Sombras grandes
- Ícones genéricos em excesso

### Fazer
- Grid editorial
- Linhas
- Bordas de 1px
- Colunas
- Tipografia grande
- Recortes
- Textura de papel
- Fotografia documental
- Motion curto
- Scroll com ritmo editorial

### CSS tokens sugeridos
```css
:root {
  --paper: #E8E2D9;
  --paper-light: #F2EEE7;
  --red: #8F2D24;
  --charcoal: #1F1F1F;
  --black: #0D0D0D;
  --concrete: #9A9A9A;
  --muted: #66625D;

  --font-display: "Bebas Neue", "Arial Narrow", sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --line: rgba(31,31,31,.24);
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 40px;
  --space-xl: 64px;
  --space-2xl: 96px;
}
```

### Border radius
Preferência: `0px` a `4px`.

### Animação
- 150–350ms
- ease-out
- leves deslocamentos
- reveal de texto
- clipping/masking
- evitar bounce
- evitar efeitos chamativos

---

## 20. Responsividade

### Desktop
Grid editorial 12 colunas.

### Tablet
6–8 colunas.

### Mobile
1 coluna dominante, preservando:
- headline
- imagem
- labels
- linhas divisórias

No mobile, não tentar manter colagens complexas pequenas demais. Simplificar.

---

## 21. Acessibilidade

- Contraste mínimo WCAG AA
- Corpo mínimo 16px
- Não depender apenas do vermelho para transmitir estado
- Alt text descritivo
- Legenda em todo vídeo
- Focus states visíveis
- Botões com labels claros
- Evitar texto sobre textura muito intensa

---

## 22. SEO / metadata

### Title padrão
`{Título} | MARGEM`

### Meta description base
> Política, economia e vida cotidiana com dados, contexto e olhar humano. Análises para além do óbvio.

### Open Graph
Usar thumbnail editorial 16:9 com:
- headline curto
- logo
- imagem documental
- alto contraste

---

## 23. Estrutura de arquivos / assets

Sugestão:
```text
/margem
  /brand
    /logo
    /watermark
    /textures
    /icons
    /fonts-reference
  /video
    /16x9
    /9x16
    /lower-thirds
    /openers
  /social
    /thumbnails
    /feed-1x1
    /stories
  /site
    /photos
    /textures
    /og
```

---

## 24. Convenção de nomes

```text
MARGEM_EP001_LONG_16x9_v01.mp4
MARGEM_EP001_CUT01_9x16_v01.mp4
MARGEM_EP001_THUMB_A.jpg
MARGEM_EP001_THUMB_B.jpg
MARGEM_POST_2026-10-06_01.png
```

---

## 25. Checklist antes de publicar

### Conteúdo
- [ ] A tese está clara?
- [ ] O primeiro trecho prende?
- [ ] Há contexto suficiente?
- [ ] Dados foram conferidos?
- [ ] O título não promete mais do que entrega?

### Visual
- [ ] Logo correto?
- [ ] Vermelho usado como acento?
- [ ] Máximo 2 linhas de legenda?
- [ ] Safe area respeitada?
- [ ] Thumbnail legível no celular?

### Técnico
- [ ] 16:9 ou 9:16 correto?
- [ ] Áudio normalizado?
- [ ] Legendas revisadas?
- [ ] Descrição preenchida?
- [ ] Link / CTA correto?

---

## 26. Regra-mãe

> **Humano antes do efeito. Contexto antes do ruído. A vida real antes da estética.**

A identidade visual deve servir ao conteúdo, não competir com ele.

