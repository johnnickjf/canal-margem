# Sistemas do Margem

O sistema existente está descrito em [Frontend editorial](frontend.md).

A fundação reutilizável da fase 1 está em [Design system](design-system.md): tokens, componentes, estados, referência navegável e validação.

[Testes e cobertura](testing.md) descreve os contratos verificados por Vitest e Playwright, a medição por módulo, os limites de cobertura e o workflow de CI.

Documentos futuros, quando houver desenho ou implementação concreta, poderão cobrir `api.md`, `ingestion.md`, `data-processing.md` e `indicator-engine.md`. A ausência desses sistemas nesta fase é intencional.

Cada documento deve distinguir estado atual de proposta e descrever responsabilidade, entradas e saídas, dependências, fluxos, configuração, falhas, validação e operação relevantes. Requisitos gerais permanecem na [arquitetura técnica](../03-technical-architecture.md); decisões ficam em [adr](../adr/README.md).
