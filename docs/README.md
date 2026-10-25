# Documentação do Margem

O Canal Margem está preparando a evolução do site editorial para uma plataforma de análise socioeconômica verificável. A base inclui a documentação da fase 0, o design system da fase 1, o modelo conceitual dos dados da fase 2, a seleção de indicadores da fase 3, o catálogo de fontes da fase 4, a PoC local de ingestão da fase 5 e as decisões de armazenamento da fase 6.

## Ordem de leitura

1. [Visão e fundamentos](01-project-vision.md): propósito, princípios e dimensões de análise.
2. [Product Design e UX](02-product-design.md): experiência pretendida, navegação e interpretação dos indicadores.
3. [Arquitetura técnica](03-technical-architecture.md): requisitos futuros para dados, proveniência e distribuição.
4. [Roadmap](04-roadmap.md): fases 0–23 e critérios do futuro MVP.
5. [Auditoria do frontend atual](systems/frontend.md): implementação observada, identidade reutilizável, limitações e próximo passo.
6. [Design system](systems/design-system.md): tokens, componentes básicos e de indicadores, estados e validação da fase 1.
7. [Testes e cobertura](systems/testing.md): suíte unitária, navegador, build editorial, medição por módulo e CI.
8. [Modelo conceitual dos dados](systems/data-model.md): entidades, relações, identidade de séries, metadados, revisões e linhagem de cálculos; exemplos fictícios em JSON.
9. [Operações e consistência](systems/data-operations.md): catálogo de leituras e escritas, aceitação de lotes, publicação, idempotência, concorrência e consulta histórica pública/interna.
10. [Indicadores do MVP](systems/mvp-indicators.md): seleção revisada de 15 conceitos principais nas cinco dimensões, com alimentação, tempo de trabalho pelo piso, insegurança alimentar e moradia; contextos e entradas auxiliares separados.
11. [Mapa de fontes](research/source-map.md): evidências da revisão, fontes necessárias, investigações de renda/hora, Peic e inflação por faixa de renda, e fontes para expansão.
12. [Catálogo de fontes](data-sources/README.md): matriz dos 15 principais, contextos e inputs, cinco fichas, consultas e arquivos identificados, amostras reais e critérios para a PoC.
13. [Investigações da fase 4](research/phase-4-investigations.md): conclusões sobre renda/hora publicada pelo IBGE, acesso à Peic e histórico de inflação por renda do Ipea.
14. [PoC de ingestão](systems/ingestion.md): comandos, quatro séries IBGE/BCB, raw, validação, persistência local, revisões, exportação e evidências da fase 5.
15. [Arquitetura de armazenamento](systems/storage.md): medição da PoC, PostgreSQL na Railway, raw no R2, histórico/cache, retenção, backup nativo Railway, reconstrução planejada e migração; decisões em [ADRs](adr/README.md).

16. [Pipelines do MVP](systems/pipelines.md): jobs das cinco fontes, PostgreSQL e API compatível com S3 (R2 em produção), agendamento, revisões, importação da PoC e evidência real da fase 7.

17. [Engine de indicadores](systems/indicator-engine.md): fórmulas versionadas, inputs fixados por ID, cálculos reproduzíveis e persistência da fase 8.
18. [API Margem](systems/api.md): publicações, ativação, consultas HTTP v1, cache e comparação da fase 9.
19. [Shell da plataforma](systems/platform-shell.md): rotas, convivência editorial, publicação fixada no build e validação da fase 10.
20. [Home orientada a perguntas](systems/question-home.md): cinco entradas do cotidiano, caminhos até os indicadores e validação da fase 11.
21. [Páginas temáticas](systems/theme-pages.md): contexto, mudanças publicadas, indicadores por recorte e explicações da fase 12.
22. [Páginas de indicador](systems/indicator-pages.md): valores, tendências publicadas, gráficos, tabelas históricas, interpretação e auditoria da fase 13.
23. [Camada Entenda](systems/entenda.md): 11 conceitos econômicos, referências, exemplos hipotéticos, relações e painel contextual da fase 14.
24. [Busca por linguagem cotidiana](systems/search.md): aliases, filtros, índice estático integrado, recuperação de erros e catálogo em HTML da fase 15.
25. [Comparador](systems/comparator.md): períodos, temas, indicadores e recortes, cálculos pela API, critérios versionados e auditoria da fase 16.
26. [Tempo de trabalho](systems/work-time.md): cesta em reais, percentual do mínimo bruto e horas/minutos com referência e auditoria da fase 17.
27. [Políticas públicas e linha histórica](systems/policy-history.md): catálogo de políticas, legislação, governos e vigências; contexto no eixo dos indicadores, fontes e limites da fase 18.
28. [Evidência e causalidade](systems/evidence.md): estudos associados às políticas e aos indicadores, classificação da inferência, contrafactuais, hipóteses, aplicabilidade e limites da fase 19.

29. [Calculadora socioeconômica](systems/calculator.md): orçamento declarado, cenários, referência de cesta, políticas e evidências relacionadas, privacidade e contrato da fase 20.
30. [Escala e performance](systems/performance.md): benchmarks locais, cache limitado de projeções verificadas, expiração de IPs por fila e avaliação das alternativas da fase 21.

Os quatro documentos numerados partem dos textos fornecidos pelo responsável pelo projeto e receberam ajustes de clareza e precisão. Definem o produto planejado; a auditoria do frontend registra a fase 0, e os documentos de sistemas registram as entregas posteriores. Exemplos do modelo e do design system são ilustrativos. As amostras em `data-sources/evidence/` são dados oficiais consultados na fase 4, com proveniência, sem integração ao site.

## Estado e limites

| Assunto | Estado nesta entrega |
|---|---|
| Site editorial Astro, conteúdo local e identidade visual | Implementado; inventariado na auditoria |
| Documentação central e roadmap | Organizados nesta fase |
| Gerenciamento de pacotes e qualidade | pnpm 11.22.0 e Biome 2.5.15 configurados; cobertura descrita no README |
| Testes automatizados e CI | Vitest com cobertura e limites por módulo; Playwright para componentes, fluxos editoriais e build; workflow preparado, execução remota ainda não verificada |
| Design system da plataforma | Implementado na fase 1; referência em `/design-system`, com exemplos fictícios |
| Modelo conceitual dos dados | Especificado na fase 2, com exemplos de revisão e derivação e catálogo de operações/consistência; especificação geral; a PoC implementa o recorte documentado de ingestão |
| Seleção de indicadores | 15 conceitos principais definidos na fase 3, mais contextos e inputs; fontes catalogadas na fase 4; PoC preservada como arquivo histórico, sem ampliar o escopo dos 15 |
| Catálogo de fontes | Fase 4 documentada: recortes e amostras oficiais conferidos, histórico observado e limites por fonte; investigações concluídas; sem comprovação de operação recorrente ou comparabilidade irrestrita |
| Shell da plataforma | Fase 10 implementada: entrada na home, temas socioeconômicos, definições/recortes de indicadores, entrada do comparador e guia Entenda; publicação fixada no build |
| Home orientada a perguntas | Fase 11 implementada: cinco perguntas como entrada principal, temas e indicadores em dois cliques; conteúdo editorial preservado |
| Páginas temáticas | Fase 12 implementada: resumos, mudanças publicadas, dados por recorte, explicações e guia do comparador |
| Páginas de indicador | Fase 13 implementada: valores por recorte, tendências, histórico paginado, gráfico SVG, tabela, interpretação e auditoria |
| Camada Entenda | Fase 14 implementada: índice, 11 conceitos, referências e painel contextual com navegação sem JavaScript |
| Busca por linguagem cotidiana | Fase 15 implementada: aliases, filtros, indicadores, Entenda e acervo; catálogo navegável sem JavaScript |
| Tempo de trabalho | Fase 17 implementada: cesta em reais, percentual do mínimo bruto e horas/minutos; inputs da mesma publicação/mês e auditoria |
| Comparador interativo | Fase 16 implementada: seleção múltipla, cálculos e critérios versionados no backend, resultados expansíveis, publicação fixada e recuperação de erros |
| Políticas públicas e linha histórica | Fase 18 implementada: quatro políticas federais, legislação, governos e vigências; faixas no eixo dos indicadores, relações investigáveis e fontes; sem causalidade atribuída |
| Evidência e causalidade | Fase 19 implementada: três referências iniciais, classificação editorial da inferência, contrafactual/hipóteses para estimativas causais, vínculos históricos explícitos, fichas, JSON e busca; sem transporte automático de efeitos |
| Calculadora socioeconômica | Fase 20 implementada: orçamento familiar, cenário hipotético, referência de cesta por capital/mês e tempo individual, políticas e estudos relacionados; perfil sem persistência e sem efeito individual presumido |
| Escala e performance | Fase 21 implementada e medida localmente: cache de projeções limitado por edição/tamanho/TTL, expiração de IPs por fila e avaliação de infraestrutura; sem capacidade de produção comprovada |
| Ingestão e persistência local | PoC da fase 5 retirada após substituição verificada na fase 9; 21 arquivos e 587 observações preservados |
| Arquitetura de armazenamento | Fase 6 definida em cinco ADRs: PostgreSQL/Railway, R2, histórico/cache, backup nativo/reconstrução e portabilidade/custos; serviços ainda não implantados |
| Pipeline do MVP | Fase 7 implementada e verificada localmente: cinco fontes, 6.375 observações, PostgreSQL e API compatível com S3 (R2 em produção), repetição, revisões, falhas e importação da PoC |
| Engine de indicadores | Fase 8 implementada no backend Go: TR2, CV5, variações, índices e relações, com avaliações imutáveis |
| API de indicadores | Fase 9 implementada: publicação, ativação, HTTP v1, cache, filtros, paginação, comparação e limites; verificação local |
| Publicação e operação em produção | Não verificadas; Dockerfile e cron Railway preparados, sem serviço remoto implantado |

As rotas editoriais `/temas/:slug`, `/videos/:slug` e `/analises/:slug` convivem com
`/tema/:slug`, `/indicador/:slug`, `/comparar` e `/entenda/como-ler-os-dados` no
[shell da fase 10](systems/platform-shell.md). `/temas` mantém os 12 pilares editoriais;
`/tema` apresenta as cinco dimensões socioeconômicas, sem substituir URLs existentes.

O conjunto sugerido de indicadores em UX é uma lista de candidatos. A [seleção da fase 3](systems/mvp-indicators.md) fixa 15 conceitos principais; cesta e tempo por cesta têm recorte por capital. O critério de MVP exige pelo menos 10 indicadores disponíveis e tradução de preços em tempo de trabalho, cuja primeira entrega é a cesta na referência do salário mínimo, implementada na [fase 17](systems/work-time.md). Os cálculos de TR2 e CV5 estão implementados na fase 8; o shell da fase 10 apresenta recortes quando há uma publicação configurada. A publicação remota e as próximas camadas de produto permanecem posteriores. O [modelo da fase 2](systems/data-model.md) fixa `dataset`, `revision_status`, `methodology_version` e `calculation_version`, distingue revisão de atualização e define `derived` como observações calculadas e `published` como projeção validada de observações externas ou derivadas. Essas camadas não determinam schemas físicos. Exemplos de API com `:id` e `:slug` também não fixam o contrato final.

O [manual de marca](brand/MARGEM_Manual_Marca_Conteudo_Site.md) define a direção visual, não certifica sua implementação. Diferenças observadas, limites de contraste e pendências do conteúdo de exemplo estão na [auditoria do frontend](systems/frontend.md).

## Organização

| Diretório | Uso |
|---|---|
| [brand](brand/MARGEM_Manual_Marca_Conteudo_Site.md) | Manual, tokens JSON e pranchas existentes; referência visual preservada |
| [research](research/README.md) | Investigações e hipóteses, separadas de decisões |
| [adr](adr/README.md) | Decisões técnicas com contexto, alternativas e consequências |
| [data-sources](data-sources/README.md) | Catálogo da fase 4, matriz dos indicadores, fichas e evidências de acesso |
| [systems](systems/README.md) | Componentes próprios e estado de implementação |

Manter detalhes de infraestrutura fora da visão e do documento de UX. Registrar decisões técnicas em ADR com as evidências que as sustentam. Documentos de sistemas devem distinguir implementação de proposta; investigações ficam em `research/`.

## Próxima entrega

A próxima etapa é observabilidade e operação (fase 22). A [fase 21](systems/performance.md)
mede o caminho local de leitura, implementa cache limitado e expiração de IPs por fila,
e condiciona novas camadas de infraestrutura a demanda observada. A
[calculadora da fase 20](systems/calculator.md) usa orçamento declarado, cenário hipotético,
cesta publicada e políticas/estudos relacionados, com métodos explícitos e perfil sem persistência.
A [fase 19](systems/evidence.md) associa estudos e avaliações, distinguindo análise contábil,
estimativa causal condicionada e referência metodológica, com aplicabilidade e limites explícitos.
A [fase 18](systems/policy-history.md) apresenta políticas, legislação, governos e vigências junto aos indicadores, sem atribuição automática de causalidade.
A [fase 17](systems/work-time.md) traduz o preço da cesta em percentual do mínimo bruto e horas/minutos.
O [comparador da fase 16](systems/comparator.md) permite comparar períodos com critérios explícitos e auditoria.
A [busca da fase 15](systems/search.md) integra indicadores, Entenda e acervo editorial.
A fase 10 fixa a mesma publicação no HTML e nas consultas, conforme o [contrato da API](systems/api.md).
A PoC foi retirada após preservação e substituição verificadas. Implantação Railway/R2 e backup remoto continuam sem ensaio. A
[regra permanente de SEO e descoberta por IA](../AGENTS.md) continua obrigatória.
