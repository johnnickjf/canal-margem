# Decisões de arquitetura

A fase 6 registra decisões aceitas para implementação, baseadas na
[medição da PoC](../systems/evidence/storage/measurement.json). Aceitação do desenho não
significa implantação: o sistema executável continua sendo a PoC local da fase 5.

| ADR | Decisão | Estado |
|---|---|---|
| [0001 — Banco principal](0001-primary-database.md) | PostgreSQL 18 na Railway; Turso e NoSQL avaliados; sem banco analítico no MVP | Aceito; implementação posterior |
| [0002 — Raw/object storage](0002-raw-object-storage.md) | Cloudflare R2 Standard privado, bytes por hash, criação condicional e bucket lock | Aceito; nenhum bucket criado |
| [0003 — Versionamento e cache](0003-data-versioning-and-cache.md) | Histórico imutável, publicação transacional e cache HTTP por manifesto | Aceito; engine/API posteriores |
| [0004 — Retenção e recuperação](0004-retention-and-recovery.md) | Backup nativo Railway e reconstrução; possível perda de versões após desastre; sem RPO/RTO fixos | Aceito; ensaios de recuperação pendentes |
| [0005 — Hospedagem e portabilidade](0005-hosting-and-portability.md) | Railway para API/jobs/banco; projeções R2; orçamento de referência e saída por protocolos | Aceito; sem contratação ou deploy |

Nomear registros sequencialmente: `0001-assunto.md`. Cada ADR deve conter status (proposto, aceito, rejeitado ou substituído), data, contexto, alternativas, decisão, consequências e evidências relacionadas. Decisões substituídas devem apontar para o novo registro.

O desenho integrado, os custos e limites, a migração e os critérios de execução estão em
[Armazenamento](../systems/storage.md). As questões ainda abertas, como coordenação dos jobs,
região, dimensionamento e contrato da API, estão na [arquitetura técnica](../03-technical-architecture.md)
e nas próximas fases do [roadmap](../04-roadmap.md).
