# Páginas temáticas — fase 12

As cinco rotas `/tema/:slug` agora oferecem um nível de leitura entre a pergunta da home e
os indicadores. Cada página apresenta resumo, principais mudanças, indicadores, explicações
e acesso ao guia do comparador. As URLs editoriais `/temas/:slug` continuam acessíveis.

## Conteúdo e dados

[theme-guides.ts](../../src/data/theme-guides.ts) contém o contexto editorial específico de
trabalho e renda, custo de vida, vida financeira, qualidade de vida e economia e Estado.
Os textos explicam relações e cuidados de leitura; não afirmam resultados quantitativos
independentes da publicação. Os nomes, definições e indicadores principais vêm do catálogo
fixado pelo [build do shell](platform-shell.md).

A [página temática](../../src/pages/tema/[slug].astro) reúne comparações publicadas para os
indicadores principais do tema. Entram resultados observados das fórmulas `relative-change`,
`difference` e `compound-change`, com valor e período de comparação explícito. A lista segue
a ordem do catálogo e dos recortes, sem ranking de impacto ou interpretação causal. Índices
base 100 e outros derivados continuam nos recortes, mas não são apresentados como mudanças.
Não há subtração, variação ou agregação calculada no template.

Sem resultados elegíveis, a seção informa que não há comparação publicada e que isso não
significa estabilidade. Os cartões dos indicadores mantêm todos os recortes recebidos,
inclusive geografias e cálculos diferentes. Um `details` nativo permite abrir os valores sem
JavaScript. Não se escolhe uma capital como representante do país, nem se soma medidas de
frequências ou unidades distintas. Um período ausente ou pendente permanece ausente; o
frontend não procura um valor antigo para substituí-lo.

[ThemeReading.astro](../../src/components/platform/ThemeReading.astro) apresenta cada recorte
com geografia, série, período, valor decimal sem conversão numérica e unidade. Cálculos mostram
fórmula, versão e períodos pelo componente compartilhado `CalculationContext`. Fonte, dataset,
método, origens disponíveis e consulta JSON ficam acessíveis. O link do indicador leva à
linhagem dos inputs já implementada no shell. Todos os links JSON mantêm a publicação do build,
e a nota da edição informa o corte de coleta. Nenhuma consulta é disparada pelo navegador.

As explicações incluem limites específicos, como inflação menor não equivaler a preços
menores e PIB por pessoa não equivaler à renda individual. O acesso ao comparador leva ao
guia existente, com indicação explícita de que a seleção interativa pertence à fase 16.
Sem API configurada, as páginas mantêm os textos e definições e informam a falta de cobertura.
Uma API configurada com falha continua interrompendo o build.

## Verificação e limites

`pnpm test:coverage` verifica as funções de captura e fixação da edição já usadas pelo shell.
`pnpm test:e2e` inclui lint, checagem Astro, build e testes desktop/celular. Os testes de
[temas](../../tests/themes.spec.ts) verificam as cinco páginas sem JavaScript, navegação por
âncoras e para o comparador, SEO, breadcrumbs, acessibilidade automática e largura. Os testes
existentes preservam as jornadas da home aos indicadores e o conteúdo editorial.

O [build isolado](../../tests/content-build.spec.ts) usa uma API controlada para conferir
comparações com período, exclusão de base 100 da lista de mudanças, método, links fixados,
precisão decimal, revisão pendente sem número e cesta em duas capitais. Também confere as
cinco rotas no sitemap e os destinos locais. `robots.txt` preserva a descoberta pública.
As páginas mantêm `PlatformLayout`, `BaseLayout` e `Seo`, conforme a
[regra permanente de SEO e descoberta](../../AGENTS.md).

Essas verificações são locais. Não comprovam indexação externa, implantação remota ou
compreensão por usuários reais. As [páginas de indicador da fase 13](indicator-pages.md)
acrescentam gráficos, tabelas históricas e interpretação por medida. O comparador interativo
continua na fase 16.
