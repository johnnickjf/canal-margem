# Sistemas do Margem

O sistema existente está descrito em [Frontend editorial](frontend.md).

A fundação reutilizável da fase 1 está em [Design system](design-system.md): tokens, componentes, estados, referência navegável e validação.

[Testes e cobertura](testing.md) descreve os contratos verificados por Vitest e Playwright, a medição por módulo, os limites de cobertura e o workflow de CI.

[Modelo conceitual dos dados](data-model.md) especifica a fase 2: entidades, metadados, identidade, revisões, ausência e cálculos derivados. Os exemplos JSON são fictícios e não constituem schema executável, banco ou integração.

[Operações de leitura, escrita e consistência](data-operations.md) complementa a fase 2 com contratos de consulta, aceitação em lotes, idempotência, concorrência e publicação por manifesto. Inclui exemplos da diferença entre coleta, aceitação e ativação pública, ainda sem execução de infraestrutura.

[Indicadores do MVP](mvp-indicators.md) registra a fase 3: seleção revisada de 15 conceitos principais, incluindo alimentação, tempo de trabalho pelo piso, insegurança alimentar e moradia. Separa contextos e inputs, especifica salário mínimo real pelo INPC e tempo por cesta, e define a passagem para o catálogo da fase 4. O [mapa de fontes](../research/source-map.md) registra evidências, investigações obrigatórias e expansão; a engine está implementada na fase 8.

O [catálogo de fontes](../data-sources/README.md) documenta a fase 4, com recortes, endpoints/arquivos, amostras oficiais, histórico observado e limites por fonte. As [investigações](../research/phase-4-investigations.md) encerram as perguntas de renda/hora, Peic e inflação por renda. A [PoC da fase 5](ingestion.md) validou quatro séries; foi retirada após a substituição verificada pela API, com arquivo de auditoria preservado.

[Arquitetura de armazenamento](storage.md) define a fase 6 com medição da PoC e cinco ADRs:
PostgreSQL/Railway, raw no R2, histórico/cache, backup nativo/reconstrução e portabilidade/custos. Especifica migração e
restauração; serviços e ensaio remoto ainda não foram executados. A implementação do
armazenamento está nos [pipelines da fase 7](pipelines.md), com jobs das cinco
fontes, cadência, PostgreSQL e API compatível com S3 (R2 em produção), qualidade, revisões, diagnóstico e preservação da PoC.
A coleta Python original e sua repetição foram verificadas localmente; o
[backend Go modular](../adr/0007-go-modular-backend.md) preserva seus contratos, IDs e lotes.
Não há implantação remota.

A [engine de indicadores](indicator-engine.md) implementa a fase 8: TR2, CV5, relações, variações e índices com inputs explícitos, cálculo versionado e avaliações imutáveis no PostgreSQL.

A [API da fase 9](api.md) implementa preparação e ativação por manifesto, contrato HTTP v1, cache, filtros, paginação, comparação e limites de abuso.

O [shell da fase 10](platform-shell.md) integra home, temas, indicadores, entrada do comparador
e Entenda ao site editorial. O build fixa uma publicação da API no HTML e nos links de consulta;
sem API configurada, exibe definições sem valores.

A [home orientada a perguntas da fase 11](question-home.md) coloca cinco perguntas do cotidiano
na entrada principal e preserva o conteúdo editorial abaixo. As [páginas temáticas da fase 12](theme-pages.md)
acrescentam resumo, mudanças publicadas, dados por recorte e explicações. As
[páginas de indicador da fase 13](indicator-pages.md) acrescentam tendências publicadas, gráficos
e tabelas históricas, interpretação, alertas e auditoria. A [camada Entenda da fase 14](entenda.md)
acrescenta 11 conceitos econômicos com fontes e exemplos, além do painel contextual nos
indicadores. A [busca da fase 15](search.md) integra indicadores, Entenda e acervo com aliases
e filtros, recuperação de falhas e catálogo em HTML sem JavaScript. O
[comparador da fase 16](comparator.md) permite selecionar temas, indicadores, recortes e
períodos, com cálculos e regras de leitura versionados no backend e resultados auditáveis.
A [tradução em tempo de trabalho da fase 17](work-time.md) apresenta cesta em reais, percentual
do mínimo bruto e horas/minutos, com referência explícita, mesma publicação/mês e auditoria.
A [fase 18](policy-history.md) acrescenta políticas, legislação, governos e vigências,
com fontes e contexto no mesmo eixo temporal dos indicadores, sem atribuição causal.
A [fase 19](evidence.md) associa estudos e referências metodológicas às políticas e aos
indicadores, com classificação editorial da inferência, contrafactuais, hipóteses,
aplicabilidade histórica e limites explícitos. A próxima etapa é a calculadora
socioeconômica da fase 20.

Cada documento deve distinguir estado atual de proposta e descrever responsabilidade, entradas e saídas, dependências, fluxos, configuração, falhas, validação e operação relevantes. Requisitos gerais permanecem na [arquitetura técnica](../03-technical-architecture.md); decisões ficam em [adr](../adr/README.md).
