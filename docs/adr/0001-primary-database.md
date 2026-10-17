# ADR-0001 — PostgreSQL como banco principal

- Status: aceito para implementação; infraestrutura ainda não implantada.
- Data: 17/10/2026.
- Escopo: dados agregados do MVP; não altera as coleções editoriais do Astro.

## Contexto

A [medição da fase 6](../systems/evidence/storage/measurement.json) registra 587 observações
em quatro séries, oito raw somando 18.584 bytes e um snapshot atual de 782.551 bytes.
`persist` em `src/ingestion/store.ts` serializa todo o estado; `prepareStore` limita a PoC
a um escritor local. São mecanismos suficientes para o experimento, sem coordenação entre
máquinas ou constraints relacionais. O [catálogo de operações](../systems/data-operations.md)
exige unicidade, referências, aceitação indivisível, idempotência e publicação por manifesto.

## Alternativas

| Alternativa | Adequação e custo |
|---|---|
| Manter snapshots JSON | Sem serviço novo, mas repete o histórico e depende de lock/rename locais; inadequado como autoridade compartilhada |
| SQLite | Transações e operação local simples; uma única máquina seria suficiente para a carga observada, mas a expansão para jobs/API separados exigiria coordenar acesso ao arquivo ou migrar |
| PostgreSQL | Constraints, decimal exato e transações para jobs/API; acrescenta serviço, migrações e administração |
| Turso Cloud/libSQL | SQL remoto e franquia inicial atraente; evita compartilhar arquivo entre jobs. Não equivale à engine nova com MVCC; exige tratar decimais e validar os contratos de transação/recuperação |
| Turso Database com MVCC | Engine aberta em Rust com `BEGIN CONCURRENT`; permite escritores simultâneos e exige novas tentativas em conflitos. O material do Cloud consultado ainda descreve a concorrência como early preview |
| MongoDB | Tem transações entre documentos em replica set e Decimal128; exige configurar essa topologia e impor integridade entre observações, inputs e publicações na aplicação |
| CouchDB | Replicação de documentos seria útil para sincronização offline, ausente no MVP; operações bulk não são atômicas e exigiriam outro protocolo de aceitação |
| Cloudflare KV | Adequado a projeções distribuídas; consistência eventual e falta de transação entre chaves não atendem à autoridade de aceitação/ativação |
| Banco analítico dedicado | Útil para varreduras extensas; a PoC não demonstrou essa carga e ele não substitui a autoridade de aceitação/publicação |

## Decisão

Usar PostgreSQL 18 na Railway como autoridade de catálogo, observações, lotes, proveniência, linhagem,
recibos e publicações. A escolha deriva das relações e dos contratos de concorrência,
sem alegar que o volume atual exige um servidor de banco.

A escolha fica encerrada para o MVP. Precisão decimal, referências e transações já são
requisitos; SQLite/Turso demandariam decisões adicionais para representá-los. MVCC no Turso
é uma capacidade válida, mas não há gargalo de escrita medido que justifique depender desse
recurso do Cloud em preview. A comparação não afirma que Turso ou MongoDB sejam incapazes
de implementar o domínio. PostgreSQL reduz o trabalho de impor as garantias já especificadas
e permite trocar de hospedagem mantendo engine, SQL e ferramentas de backup.

Identidades e referências estruturantes ficam em colunas e constraints; extensões de metadados
podem usar JSONB sem substituir FKs e unicidade. Usar `numeric` para decimais finitos e strings
na serialização. Não usar ponto flutuante para valores oficiais. O schema deve rejeitar NaN,
infinidades, estados/valores incompatíveis e períodos inválidos. Validar entradas antes da escrita.

Aceitação confirma observações e recibo na mesma transação; ativação confirma evento e ponteiro
juntos com lock de linha e geração esperada. Unicidade de domínio também vale entre chaves
de idempotência distintas. Para verificações com múltiplas leituras, escolher isolamento e locks
explicitamente; `Read Committed` sozinho não garante uma visão estável entre comandos.

Começar com índices para série/período/vintage e publicação/seleção, sem particionamento,
extensão de séries temporais, réplica, warehouse ou materialized views obrigatórios.
Avaliar banco analítico somente com carga medida que prejudique os fluxos principais.

## Consequências e limites

PostgreSQL exige migrações, monitoramento, permissões e backup. O backend ganha uma autoridade
acessível por jobs/API sem compartilhar arquivos. Lotes grandes podem exigir staging e aceitação
por partições explícitas; staging continua invisível. Railway é a hospedagem inicial definida
no [ADR-0005](0005-hosting-and-portability.md); região e limites de recursos serão configurados
na implantação. Constraints não substituem validação estatística ou da linhagem.

Turso fica adiado, sem PoC comparativa obrigatória para prosseguir. Reabrir a decisão se o
custo real do banco ultrapassar o orçamento do ADR-0005 apesar do dimensionamento e das
projeções cacheáveis, ou se o produto passar a exigir banco embarcado/sincronização offline.
Nesse caso, comparar precisão, aceitação indivisível, conflitos, exportação e restauração
com o fluxo completo. Novos fornecedores não devem exigir reescrever os contratos públicos.

## Evidências e validação

Referências locais e migração estão em [Armazenamento](../systems/storage.md).
Os contratos de execução deverão provar rollback do lote, disputa de unicidade, repetição após
timeout e ativação concorrente. Nenhum desses comportamentos foi testado em PostgreSQL nesta fase.
As capacidades de isolamento e decimal exato foram conferidas na documentação oficial de
[transações](https://www.postgresql.org/docs/18/transaction-iso.html) e
[tipos numéricos](https://www.postgresql.org/docs/18/datatype-numeric.html).

Alternativas consultadas em 17/10/2026: [MVCC do Turso](https://docs.turso.tech/tursodb/concurrent-writes),
[estado da concorrência no Cloud](https://turso.tech/blog/concurrent-writes-in-practice),
[preços do Turso](https://turso.tech/pricing), [transações do MongoDB](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/),
[Decimal128](https://www.mongodb.com/docs/manual/reference/bson-types/),
[bulk do CouchDB](https://docs.couchdb.org/en/stable/api/database/bulk-api.html) e
[consistência do KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/).
Essas fontes sustentam a comparação documental; não houve benchmark entre bancos.
