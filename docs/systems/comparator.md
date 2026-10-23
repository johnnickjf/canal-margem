# Comparador — fase 16

A rota `/comparar` permite selecionar tema, vários dos 15 indicadores principais, um
recorte por indicador e dois extremos temporais. Cada resultado informa a mudança, a
regra de leitura e os dados usados. Resultados ficam agrupados por tema, sem score agregado.

## Períodos e cálculos

O início selecionado deve coincidir com o início do período-base; o fim deve coincidir
com o fim do período final. Janeiro de 2024 a dezembro de 2025 compara janeiro de 2024 a
dezembro de 2025 em uma série mensal; não soma nem calcula médias dos dois anos. Para uma
série trimestral, as datas devem identificar trimestres completos. Não há busca pelo
período mais próximo, divisão de trimestres ou preenchimento de ausências.

A interface oferece `difference/2` e `relative-change/2`. Somente a
[engine Go](../../backend/internal/indicators/domain.go) calcula valores: diferença de
taxas percentuais usa pontos percentuais; variação relativa usa porcentagem e exige base
positiva. A engine confere série, geografia, período, frequência, unidade, método, base
monetária, composição e demais metadados. Incompatibilidade produz motivo, sem número.
Mais de um período no mesmo extremo produz `ambiguous_endpoints`, sem escolha silenciosa.

## Critérios de interpretação

A opção HTTP `assessment=material-v1` acrescenta uma leitura versionada ao cálculo. Sem
essa opção, o contrato continua matemático. As regras ficam no
[backend](../../backend/internal/api/assessment.go); mudanças exigem outra versão.

| Séries | Direção favorável nesta medida |
|---|---|
| TR1, TR2 | Maior renda real |
| TR4, TR5 | Menor desocupação ou informalidade |
| CV5, `price-income` | Menor tempo equivalente ou parcela do mínimo para a mesma cesta |
| VF1, VF2 | Menor comprometimento da renda ou inadimplência |
| QV1, QV2, QV3 | Menor pobreza, desigualdade ou insegurança alimentar |
| Demais, incluindo preços nominais, inflação, PIB e séries transformadas | Exigem contexto; não recebem conclusão automática de melhora ou piora |

`improved`, `worsened` e `stable` correspondem a “melhorou”, “piorou” e “estável nesta
medida”. Estabilidade significa igualdade exata dos valores publicados; não há tolerância
ou teste de significância. A direção compara decimais originais com precisão exata,
mesmo quando uma diferença arredonda a zero nas 12 casas da fórmula. Isso não transforma
uma diferença pequena em evidência de mudança estatisticamente significativa.

`context_required` preserva a direção matemática com explicação de seu limite.
`insufficient_data` cobre ausência e incompatibilidade, inclusive base não positiva na
variação percentual. Falha de rede, HTTP, timeout ou resposta inválida é uma consulta não
concluída; não recebe classificação. A interpretação considera apenas os extremos da mesma
medida e não resume bem-estar, causalidade ou a atuação de um governo.

## Publicação e auditoria

[comparisonCatalog](../../src/lib/comparison.ts) usa exclusivamente o catálogo e os
recortes capturados pelo build. A [página](../../src/pages/comparar.astro) entrega critérios,
definições e links dos indicadores em HTML; o JSON de configuração escapa `<`. Nenhum valor
é calculado no navegador. Sem API configurada, a página explica a indisponibilidade.
Sem JavaScript, o catálogo leva aos valores e históricos em HTML; a seleção interativa
não executa.

O [cliente](../../src/scripts/comparison-page.ts) consulta a API com a publicação do build,
`version=2` e `assessment=material-v1`. Não resolve o alias atual nem consulta provedores.
As requisições são seriais, sem credenciais e com timeout de dez segundos. Comparações usam
CORS público e cache HTTP existentes na API. Uma publicação retirada não é substituída.
O recurso depende da disponibilidade da API Margem durante a consulta; a parte estática
continua legível se ela falhar.

Cada resultado expande a regra, fórmula, versão, precisão, avisos, períodos, valores
originais, estados, contexto metodológico, fontes e coleta. Links JSON fixam a mesma
publicação para a comparação, as observações e os inputs de cálculos anteriores. A
linhagem adicional pode ser seguida pelas observações da API ou pela página do indicador.
Nenhum endereço de raw privado é exposto.

Filtros, indicadores, recortes e publicação ficam na URL. Reabrir um link da mesma edição
repete a consulta; voltar pelo histórico restaura os campos. Um link de outra edição exige
revisar os controles e comparar novamente, com mensagem explícita, sem repetição automática.
A edição da seleção cancela e invalida respostas pendentes. Resultados usam texto no DOM,
sem interpretar HTML recebido. Erros permitem nova tentativa pelo botão de comparar.

## Verificação e limites

[Testes Go](../../backend/internal/api/comparison_test.go) exercitam o handler HTTP com a
engine real: melhora, piora, igualdade, precisão, base zero, falta de dados, mudança de
método, ambiguidade e parâmetros inválidos. A
[integração de publicação](../../backend/integration/publication_test.go) verifica a leitura
interpretada sobre PostgreSQL e projeção S3 locais. Testes unitários do
[cliente](../../tests/unit/comparison.test.ts) verificam publicação e versões, contrato,
decimais, erros e retry.

O [build isolado](../../tests/content-build.spec.ts) e o
[fluxo de navegador](../../tests/fixtures/verify-comparator.ts) usam HTTP controlado para
verificar HTML real, seleção múltipla, tema, geografia, auditoria, URL/histórico, edição
antiga, resposta atrasada, falha HTTP e retry, além de teclado, axe, largura e capturas em
desktop e celular. O catálogo também é conferido sem JavaScript. A suíte do shell verifica
canonical, descrição, compartilhamento, dados estruturados e ausência de `noindex`;
`/comparar` permanece no sitemap e o rastreamento segue o `robots.txt` existente.

A validação é local. Publicação remota, comportamento da CDN, indexação externa e compreensão
por usuários reais não foram verificados. Governos e políticas públicas dependem do modelo
da fase 18; esta etapa não inventa esses registros. A próxima etapa é a tradução de preços
em tempo de trabalho da fase 17. A [regra permanente de SEO e descoberta por IA](../../AGENTS.md)
continua obrigatória.
