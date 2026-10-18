# Sistemas do Margem

O sistema existente está descrito em [Frontend editorial](frontend.md).

A fundação reutilizável da fase 1 está em [Design system](design-system.md): tokens, componentes, estados, referência navegável e validação.

[Testes e cobertura](testing.md) descreve os contratos verificados por Vitest e Playwright, a medição por módulo, os limites de cobertura e o workflow de CI.

[Modelo conceitual dos dados](data-model.md) especifica a fase 2: entidades, metadados, identidade, revisões, ausência e cálculos derivados. Os exemplos JSON são fictícios e não constituem schema executável, banco ou integração.

[Operações de leitura, escrita e consistência](data-operations.md) complementa a fase 2 com contratos de consulta, aceitação em lotes, idempotência, concorrência e publicação por manifesto. Inclui exemplos da diferença entre coleta, aceitação e ativação pública, ainda sem execução de infraestrutura.

[Indicadores do MVP](mvp-indicators.md) registra a fase 3: seleção revisada de 15 conceitos principais, incluindo alimentação, tempo de trabalho pelo piso, insegurança alimentar e moradia. Separa contextos e inputs, especifica salário mínimo real pelo INPC e tempo por cesta, e define a passagem para o catálogo da fase 4. O [mapa de fontes](../research/source-map.md) registra evidências, investigações obrigatórias e expansão; a engine continua posterior.

O [catálogo de fontes](../data-sources/README.md) documenta a fase 4, com recortes, endpoints/arquivos, amostras oficiais, histórico observado e limites por fonte. As [investigações](../research/phase-4-investigations.md) encerram as perguntas de renda/hora, Peic e inflação por renda. A [PoC da fase 5](ingestion.md) implementa TR4, CV1 e VF1 com coleta por comando, raw, validação, persistência local, revisões e exportação. A coleta recorrente continua posterior.

[Arquitetura de armazenamento](storage.md) define a fase 6 com medição da PoC e cinco ADRs:
PostgreSQL/Railway, raw no R2, histórico/cache, backup nativo/reconstrução e portabilidade/custos. Especifica migração e
restauração; serviços e ensaio remoto ainda não foram executados. A implementação do
armazenamento está nos [pipelines da fase 7](pipelines.md), com jobs das cinco
fontes, cadência, PostgreSQL e API compatível com S3 (R2 em produção), qualidade, revisões, diagnóstico e preservação da PoC.
A coleta Python original e sua repetição foram verificadas localmente; o
[backend Go modular](../adr/0007-go-modular-backend.md) preserva seus contratos, IDs e lotes.
Não há implantação remota.

Documentos futuros, quando houver desenho ou implementação concreta, poderão cobrir `api.md`, `data-processing.md` e `indicator-engine.md`. A ausência desses sistemas nesta fase é intencional.

Cada documento deve distinguir estado atual de proposta e descrever responsabilidade, entradas e saídas, dependências, fluxos, configuração, falhas, validação e operação relevantes. Requisitos gerais permanecem na [arquitetura técnica](../03-technical-architecture.md); decisões ficam em [adr](../adr/README.md).
