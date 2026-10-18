# ADR-0006 — Runtime dos pipelines

- Status: substituído pelo [ADR-0007](0007-go-modular-backend.md).
- Data original: 17/10/2026.
- Escopo original: coleta privada e normalização da fase 7.

## Decisão original

A primeira implementação local usou Python, Psycopg, boto3, httpx, openpyxl, xlrd e pypdf.
Os leitores atendiam JSON, XLSX, ZIP/XLS legado e tabelas PDF. Um comando finito por fonte
executava a coleta, com locks PostgreSQL e sem servidor, fila ou scheduler residente.
A escolha não determinava a linguagem da futura API.

## Substituição

A orientação do responsável pelo projeto passou a ser Go para o backend, organizado como
monólito modular, com persistência SQL explícita e separação entre comandos e consultas.
O ADR-0007 registra a implementação e as condições de migração. A
[evidência original](../systems/evidence/pipelines/verification.json) permanece como registro
histórico da coleta Python: seus caminhos e hashes descrevem aquela implementação, não o
runtime atual. A [comparação Go](../systems/evidence/pipelines/go-migration.json) identifica
os originais reutilizados e as verificações da substituição.
