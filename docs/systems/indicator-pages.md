# Páginas de indicador — fase 13

As rotas `/indicador/:slug` respondem ao que aconteceu, ao significado da medida e à origem
dos dados. Mantêm todos os recortes da publicação: não escolhem uma capital como Brasil,
não misturam unidades e não substituem o último período indisponível por um número antigo.

## Leitura e interpretação

A [página](../../src/pages/indicador/[slug].astro) apresenta o último período de cada recorte
na entrada, seguido de interpretação, dados e metodologia, limites e indicadores relacionados.
Os [guias dos 15 indicadores principais](../../src/data/indicator-guides.ts) explicam o
significado e os cuidados específicos, incluindo IPCA mensal versus 12 meses, Gini, pobreza,
média móvel do comprometimento da renda e composição regional da cesta. As medidas auxiliares
mantêm a definição e os limites do catálogo. Relações entre indicadores são contexto editorial,
sem atribuição causal. O acesso ao guia de leitura permanece disponível; a camada Entenda
com conceitos dedicados continua na fase 14.

[IndicatorDetail](../../src/components/platform/IndicatorDetail.astro) exibe valor decimal,
unidade, período, geografia, frequência, base temporal, fonte, método, dataset e alertas recebidos.
Comparações publicadas das fórmulas `relative-change`, `difference` e `compound-change` mostram
alta, queda ou estabilidade conforme o sinal decimal, com fórmula/versão e referência temporal.
Não há cálculo de variação no frontend. Sem comparação publicada, a ausência é explícita e não
significa estabilidade. Índices de base 100 permanecem identificados como índices, sem receber
um rótulo de variação. As origens mostram datas de coleta, distintas do período de referência
e da divulgação pela fonte; a edição informa seu corte. Inputs de cálculos preservam a linhagem
transitiva e os links JSON da fase 10. Quando a avaliação inclui a definição, a página
expõe também a fórmula, a descrição metodológica e seus parâmetros.

## Histórico e gráficos

O [build](../../src/lib/platform-build.ts) pagina `/api/v1/series/:series` para cada geografia,
fixando publicação e revisão do catálogo em todas as consultas. Não trunca a primeira página.
Rejeita cursor repetido, datas inválidas, períodos duplicados, outro recorte, decimal numérico
e divergência entre o último período do histórico e o resumo. Uma falha da API configurada
interrompe o build. Sem API, as definições continuam disponíveis sem valores fictícios.

[IndicatorHistory](../../src/components/platform/IndicatorHistory.astro) gera SVG e tabela no
HTML estático, acessíveis sem JavaScript. O eixo horizontal usa o fim do período e distância
temporal proporcional. Unidade, limites da escala e datas ficam explícitos. A escala vertical
acompanha os valores e pode não começar em zero. Lacunas explícitas e mudanças de método
interrompem a linha, inclusive em segmentos metodológicos ou bases monetárias distintas;
nenhum ponto é interpolado. Histórico com unidades diferentes mantém a tabela com unidade
por observação e informa por que o gráfico está indisponível. Um ponto único continua visível; sem valores
observados, o componente informa a indisponibilidade do gráfico. Períodos fora do escopo da
publicação não são inventados como observações ausentes.

[As coordenadas](../../src/lib/indicator-history.ts) usam inteiros decimais (`BigInt`) antes
da conversão para pixels, evitando perder diferenças pequenas sobre valores grandes. Os valores
exibidos permanecem strings decimais completas; só o separador muda. Essa transformação é
geométrica e não calcula indicadores. A tabela apresenta todos os períodos, valores exatos,
estados, motivos de ausência e links de auditoria por observação. Uma região com rolagem
horizontal mantém a tabela acessível em telas estreitas.

## Verificação e limites

`pnpm test:coverage` verifica captura paginada, edição fixada, divergências, ausência, sinal
decimal, precisão geométrica, valores negativos, zero, ponto único e interrupções da linha.
`pnpm test:e2e` executa lint, tipos, build e navegador. Os testes de
[indicadores](../../tests/indicators.spec.ts) cobrem os 15 principais sem JavaScript em desktop
e celular. O [build com API HTTP controlada](../../tests/content-build.spec.ts) verifica também
histórico em duas páginas, lacuna intermediária, último período pendente com número anterior,
duas capitais, tendência publicada, tabela, auditoria, ausência de cobertura, largura e axe.
Capturas do gráfico em desktop/celular ficam em `test-results/` para inspeção visual.

SEO permanece na base compartilhada: título, descrição, canonical, metadados sociais,
breadcrumbs estruturados, sitemap e `robots.txt`. Os testes inspecionam o HTML gerado e links
locais; a [regra permanente de descoberta](../../AGENTS.md) continua obrigatória.

As evidências são locais e usam respostas controladas. Não comprovam indexação externa,
leitura assistiva manual, compreensão por usuários reais ou implantação Railway/R2. O build
continua estático: uma nova publicação de dados exige reconstruir e publicar o site.
Comparação interativa de períodos e tradução ampliada em tempo de trabalho continuam nas
fases 16 e 17.
