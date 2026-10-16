# Sistemas do Margem

O sistema existente está descrito em [Frontend editorial](frontend.md).

A fundação reutilizável da fase 1 está em [Design system](design-system.md): tokens, componentes, estados, referência navegável e validação.

[Testes e cobertura](testing.md) descreve os contratos verificados por Vitest e Playwright, a medição por módulo, os limites de cobertura e o workflow de CI.

[Modelo conceitual dos dados](data-model.md) especifica a fase 2: entidades, metadados, identidade, revisões, ausência e cálculos derivados. Os exemplos JSON são fictícios e não constituem schema executável, banco ou integração.

[Operações de leitura, escrita e consistência](data-operations.md) complementa a fase 2 com contratos de consulta, aceitação em lotes, idempotência, concorrência e publicação por manifesto. Inclui exemplos da diferença entre coleta, aceitação e ativação pública, ainda sem execução de infraestrutura.

Documentos futuros, quando houver desenho ou implementação concreta, poderão cobrir `api.md`, `ingestion.md`, `data-processing.md` e `indicator-engine.md`. A ausência desses sistemas nesta fase é intencional.

Cada documento deve distinguir estado atual de proposta e descrever responsabilidade, entradas e saídas, dependências, fluxos, configuração, falhas, validação e operação relevantes. Requisitos gerais permanecem na [arquitetura técnica](../03-technical-architecture.md); decisões ficam em [adr](../adr/README.md).
