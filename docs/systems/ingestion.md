# PoC de ingestão — registro histórico da fase 5

A PoC de IBGE/BCB validou coleta, raw por hash, normalização, revisões e exportação local.
Aceitou 587 observações de quatro séries; a repetição não criou versões. Esses resultados
orientaram armazenamento e pipelines. O [resumo histórico](evidence/ingestion/verification.json)
conserva as contagens e a identidade do arquivo de auditoria.

Na fase 9, o fluxo definitivo `job → PostgreSQL → publicação → API` foi verificado com coleta
oficial do IBGE e testes de revisões, repetição e falhas. A implementação TypeScript,
CLI, persistência provisória, comando de coleta, testes e capturas exclusivos da PoC foram
removidos. O sistema vigente está nos [pipelines](pipelines.md), na
[engine](indicator-engine.md) e na [API](api.md).

Antes da remoção, o importador Go preservou 21 arquivos e 587 observações, com os IDs,
timestamps, vínculos e manifesto originais. Os arquivos estão no raw compatível com S3;
as relações ficam no schema `legacy`, sem promoção automática para `normalized` ou
`published`. Os cinco raw retirados da pasta de evidências foram conferidos byte a byte no destino.
Dois continuam como fixtures úteis do adaptador Go em `backend/internal/ingestion/testdata/`;
as três capturas usadas exclusivamente pela PoC saíram do Git.
A [evidência da transição](evidence/api/verification.json) registra hashes e limites.
O ensaio foi local com PostgreSQL e LocalStack; não houve envio para R2 remoto.
Uma cópia local dos objetos por hash e um dump do banco ficam em `.data/phase9/archive/`.

O importador `pnpm pipeline import-poc --root DIRETÓRIO` permanece como ferramenta de
preservação de arquivos históricos; não coleta fontes, não oferece uma segunda persistência
operacional e não participa das leituras públicas. Seus testes cobrem integridade e
repetição da importação. A antiga pasta local de dados permanece preservada fora do Git;
não é necessária para executar os jobs ou a API.
