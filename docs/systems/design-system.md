# Design system — fase 1

A fase 1 consolida a identidade editorial em componentes Astro reutilizáveis. A referência navegável fica em `/design-system`; execute `pnpm dev` e abra essa rota. Os exemplos de indicadores são fictícios e estão identificados na página e nos cartões.

O contrato desta entrega é cobrir os tokens, os 16 componentes básicos e os sete componentes de indicadores enumerados na [fase 1 do roadmap](../04-roadmap.md#fase-1--fundação-do-produto-e-design-system), com estados explícitos, navegação por teclado e layout em mobile e desktop. Não há consulta a fontes, cálculo de indicadores ou modelo de persistência nesta fase.

## Tokens e identidade

A fonte de implementação é [tokens.css](../../src/styles/tokens.css). O [JSON da marca](../brand/MARGEM_design_tokens.json) permanece como referência da identidade; não existe geração automática entre esses arquivos.

| Grupo | Tokens e uso |
|---|---|
| Cores | Paleta original preservada; `--surface`, `--surface-muted`, `--control-border`, `--focus-color` e `--status-*` dão papéis aos componentes |
| Texto sobre escuro | `--red-on-dark: #e0796c`; substitui a variação anterior, cujo contraste era insuficiente para texto normal |
| Tipografia | Bebas Neue em títulos, Inter em corpo e controles, IBM Plex Mono em números e metadados; fontes locais |
| Hierarquia | `--display-*`, `--text-*`, `--heading-section`, `--heading-card`, `--data-value`; nível de heading independente do tamanho |
| Espaçamento | `--space-2xs` até `--space-3xl`: 4, 8, 16, 24, 40, 64, 96 e 144 px |
| Conteúdo | `--content-wide`/`--page-max`: 1440 px; `--content-narrow`: 760 px incluindo gutters; `--measure`: 66ch |
| Breakpoints | `--breakpoint-sm`: 720 px; `--breakpoint-nav`: 960 px; `--breakpoint-lg`: 1080 px |
| Forma | `--radius`: 0; `--radius-max`: 4 px; bordas de 1 e 2 px; `--rule` e `--rule-strong` |
| Sombras | `--shadow-none` para cartões; `--shadow-overlay` para modais e tooltips |
| Controles e foco | `--control-height`: 48 px; `--control-height-sm`: 44 px; `--focus-ring` e `--focus-offset` |
| Movimento | Tokens existentes de 150–350 ms; skeleton e spinner desativam animações com movimento reduzido |

Os tokens de breakpoint registram a escala para consulta por tooling e JavaScript. Media queries usam os valores literais, pois variáveis CSS não são substituídas nas condições de `@media`. Esta entrega não converte todos os breakpoints locais do site editorial.

O contexto `.on-dark` redefine superfície, texto, estados e foco. Concreto é uma cor decorativa; não é a cor padrão de texto essencial. Direção de uma série não determina cor de sucesso ou erro.

## Componentes básicos

Os componentes ficam em [src/components/ui](../../src/components/ui). Props nativas de HTML são encaminhadas pelos primitives que as expõem; IDs são responsabilidade da página e precisam ser únicos.

| Componente | Contrato e estados |
|---|---|
| Button | Mantém `primary`, `outline`, `text`, link e ícone; acrescenta botão `disabled` e `loading` com `aria-busy`. Links não recebem estados de botão desabilitado. Durante loading, o consumidor deve fornecer um rótulo claro |
| Link | Link sublinhado; `external` acrescenta proteção de nova aba e aviso acessível |
| Card | `article` por padrão, `div` quando não representar conteúdo independente; variantes default, muted e outline |
| Container | Reutiliza `.container`; largura wide ou narrow, sem substituir a classe existente |
| Section | Seção com padding existente e `labelledby` obrigatório, apontando para um heading da página |
| Heading | `as` obrigatório de h1 a h6; tamanhos page, section, card ou label. [Headline](../../src/components/ui/Headline.astro) continua disponível para títulos com destaque editorial |
| Tooltip | ID, rótulo e texto; aparece por foco ou ponteiro, fecha com Escape. Sem JS, o texto continua visível. Não recebe links ou controles internos |
| Modal | ID, título e texto do acionador; diálogo nativo com foco inicial no título, fechamento por botão, Escape e backdrop, e retorno de foco |
| Drawer | Usa Modal com posicionamento lateral e rolagem própria; compartilha o contrato de foco e fechamento |
| Tabs | ID do grupo, label, itens com IDs únicos e slots de mesmo nome; setas, Home e End selecionam abas. Instâncias independentes; aceita hash direto de painel |
| Badge | Estados neutral, info, warning e error; o texto nomeia o estado, sem depender da cor |
| Search | Formulário GET com campo nomeado; por padrão navega para `/busca?q=...`; label visível, hint, error e disabled. Não contém motor de busca próprio |
| Select | Select nativo com label, opções, valor inicial, hint, erro associado e disabled; preserva interação de teclado e toque do navegador |
| Skeleton | Mensagem acessível e 1–12 linhas decorativas; não apresenta números provisórios |
| EmptyState | Título, descrição e slot para ação real; ausência tem explicação própria |
| ErrorState | Título, descrição e slot para recuperação real; não substitui falhas por zero. Em atualização dinâmica, o chamador deve definir a região de anúncio adequada |

Exemplo de composição:

```astro
---
import Heading from '@/components/ui/Heading.astro';
import Section from '@/components/ui/Section.astro';
import Select from '@/components/ui/Select.astro';
---

<Section labelledby="recorte-titulo" width="narrow">
  <Heading as="h2" id="recorte-titulo">Escolha o recorte</Heading>
  <Select
    id="geografia"
    name="geografia"
    label="Geografia"
    options={[{ value: 'br', label: 'Brasil' }]}
  />
</Section>
```

Modal e Drawer têm um único conteúdo: em HTML estático ele aparece em `details` aberto, acessível por link; o script o move para [`dialog`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) e aprimora o acionador. Tabs entregam todos os painéis e links no HTML; apenas depois do aprimoramento recebem os papéis e a navegação de teclado do [padrão Tabs da WAI](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) e ocultam painéis inativos. Não coloque conteúdo necessário para compreensão apenas em tooltips.

URLs cujo fragmento aponta para o conteúdo de Modal ou Drawer abrem a sobreposição no carregamento e nas mudanças de hash, inclusive em outra aba. Links para seções externas à sobreposição, na mesma página, fecham o diálogo e levam o foco ao destino. Fechar pelo botão, por Escape ou pelo backdrop devolve o foco ao acionador. Links abertos em outra aba mantêm o diálogo original aberto.

## Componentes de indicadores

Os componentes ficam em [src/components/indicators](../../src/components/indicators). Seus contratos são de apresentação; não fixam o modelo conceitual da fase 2.

| Componente | Contrato e estados |
|---|---|
| IndicatorCard | União tipada: ready exige valor, unidade, geografia, explicação, fonte, atualização e variação; loading, empty e error têm contratos próprios. Aceita URL real de detalhe, slot contextual e aviso metodológico |
| SourceBadge | Nome da instituição, dataset e URL opcional; só anuncia fonte primária quando o chamador informa `primary`. A amostra usa uma fonte fictícia |
| DataFreshness | Referência, publicação e consulta são informações distintas; estados current, delayed, preliminary, revised e unknown vêm do chamador, sem inferir atraso pela data |
| MethodologyWarning | Título, explicação e link opcional; comunica limitações sem afirmar comparabilidade |
| Trend | Alta, queda, estabilidade ou indisponibilidade com texto. Variação e base de comparação são obrigatórias quando há variação. Avaliação favorável/desfavorável é explícita; padrão: sentido depende do contexto |
| TimeRangeSelector | Formulário GET com `action` obrigatório, opções e nome do parâmetro; quem recebe a navegação aplica o período. Não calcula séries |
| ExplanationDrawer | Definição, importância, interpretação, cuidados e fonte; slot para links de aprofundamento e relações. Conteúdo disponível em HTML estático |

Valores já formatados entram como texto. `0` é um valor válido e distinto de ausência. Componentes não calculam variação, corrigem inflação ou atribuem causalidade. Datas de publicação e consulta usam `YYYY-MM-DD`; [presentation-date.ts](../../src/lib/presentation-date.ts) rejeita datas inválidas e formata em UTC para preservar o dia.

## SEO e distribuição

A [regra permanente de SEO](../../AGENTS.md) continua obrigatória. As rotas editoriais, o BaseLayout e o componente Seo foram preservados. `/design-system` é uma referência utilitária com amostras fictícias: tem metadados e canonical, mas usa `noindex, follow` e é excluída do sitemap em [astro.config.mjs](../../astro.config.mjs). Isso não bloqueia o acervo editorial nem altera `robots.txt`.

## Validação

```bash
pnpm exec playwright install chromium  # primeira execução em uma máquina
pnpm test:e2e                         # check, build e testes desktop/mobile
```

Para usar um Chromium já instalado, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` com seu caminho. A configuração usa preview na porta 4322. `pnpm test:e2e:ui` abre a interface dos testes sobre um build existente. Capturas e traces ficam em `test-results/`, ignorado pelo Git.

A [suíte](../../tests/design-system.spec.ts) verifica estados, zero versus ausência, foco e fechamento de sobreposições, navegação para seções da página (inclusive com hash repetido), URLs de diálogo no carregamento, recarga, mudança de hash e abertura em outra aba, teclado e isolamento de abas, tooltip, submissão de formulários, acesso sem JS, overflow, movimento reduzido e verificações automáticas WCAG A/AA com axe. Também inspeciona todas as páginas do build quanto a HTML principal, heading h1, metadados, canonical, links locais, JSON-LD e presença das páginas indexáveis no sitemap, além de `robots.txt`.

Verificações automáticas e inspeção de capturas não certificam toda a experiência assistiva. Indexação externa, deploy e funcionamento com fontes reais não fazem parte desta entrega.
