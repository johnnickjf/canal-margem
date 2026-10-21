# Camada Entenda — fase 14

`/entenda` reúne os 11 conceitos da fase 14: inflação, renda real, renda nominal, PIB,
PIB per capita, dívida pública, déficit, juros, Selic, informalidade e desigualdade.
Cada página responde o que é, por que importa, como interpretar e quais erros evitar,
com exemplo hipotético, indicadores relacionados e referências primárias.

## Conteúdo e navegação

O [catálogo editorial](../../src/data/concepts.ts) mantém textos, exemplos, referências e
relações explícitas com temas, indicadores e outros conceitos. As referências consultadas
são do IBGE, Banco Central e Tesouro Nacional; cada página exibe os links usados. A revisão
editorial tem autoria Margem e data própria, distinta da atualização dos dados. Os exemplos
são hipotéticos e não representam observações, previsões ou cálculos da engine.

O [índice](../../src/pages/entenda/index.astro) apresenta perguntas em linguagem cotidiana.
As [páginas de conceito](../../src/pages/entenda/[slug].astro) geram conteúdo e links em HTML,
sem depender de JavaScript ou de uma série publicada. As relações com indicadores usam o
catálogo da edição do build para evitar links para rotas ausentes. Não calculam valores nem
ampliam as séries do MVP: dívida pública, déficit, juros e Selic recebem explicação, com aviso
de que os indicadores relacionados oferecem contexto e não medem esses conceitos.

A navegação global aponta para o índice; os cinco temas levam a conceitos pertinentes.
O guia existente em `/entenda/como-ler-os-dados` mantém sua URL e conteúdo, com acesso ao índice.

## Explicação junto ao indicador

[IndicatorExplanation](../../src/components/platform/IndicatorExplanation.astro) integra
`ExplanationDrawer` às 20 páginas do catálogo local: 15 principais e cinco medidas auxiliares.
Os [guias de indicador](../../src/data/indicator-guides.ts) fornecem importância, interpretação,
cuidados e relações específicos. O painel inclui definição, fontes da edição, link para
auditoria por recorte e aprofundamento nos conceitos.

Com JavaScript, “Entenda este indicador” abre o drawer existente sem sair da visualização;
Escape e o botão de fechamento restauram o foco. O link para dados e metodologia fecha o
painel e leva à seção correspondente. Sem JavaScript, o mesmo conteúdo fica em `details`
aberto, com link por fragmento. Não há cópia separada do texto nem nova consulta à API.

As fontes dos dados vêm exclusivamente dos recortes da publicação fixada. Na ausência de
cobertura, o painel informa isso; a referência conceitual não é apresentada como fonte de
um valor. A explicação editorial permanece disponível sem API configurada.

## SEO e verificação

O [layout Entenda](../../src/layouts/EntendaLayout.astro) usa `BaseLayout` e `Seo`: título,
descrição, canonical e compartilhamento seguem a base do site. Breadcrumbs e `DefinedTerm`
descrevem o conceito, sua definição, autoria e referências. As novas rotas entram no sitemap
e permanecem liberadas em `robots.txt`, conforme a [regra permanente](../../AGENTS.md).

[Os testes de Entenda](../../tests/entenda.spec.ts) verificam os 11 conceitos sem JavaScript,
links, seções, exemplos, fontes, SEO, JSON-LD e sitemap em desktop/celular. Com JavaScript,
verificam largura e axe e exercitam o drawer por teclado, foco, fechamento, auditoria,
link direto e navegação até um conceito. [Os testes de indicadores](../../tests/indicators.spec.ts)
cobrem o conteúdo sem JavaScript nas 20 páginas. O [build isolado com API](../../tests/content-build.spec.ts)
confere fontes do painel com e sem cobertura, preservação da publicação, acessibilidade
do drawer e páginas conceituais independentes da disponibilidade dos dados.

Validação local: `pnpm test:coverage` e `pnpm test:e2e` (lint, tipos, build e navegador).
Capturas de conceito e painel ficam em `test-results/` para inspeção visual. Esses checks
não comprovam compreensão por usuários reais, leitura assistiva manual, indexação externa
ou publicação em produção. A próxima etapa é a busca da fase 15; implantação Railway/R2
continua posterior.
