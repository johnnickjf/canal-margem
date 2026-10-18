# ADR-0007 — Backend Go em monólito modular

- Status: aceito; implementado para os pipelines da fase 7.
- Data: 17/10/2026.
- Substitui: [ADR-0006](0006-pipeline-runtime.md).
- Escopo: runtime, módulos e acesso a dados; engine e API continuam nas fases 8 e 9.

## Contexto

O responsável pelo projeto prefere Go pela filosofia da linguagem, tipagem e operação.
Os contratos existentes exigem proveniência, precisão decimal, imutabilidade, lotes atômicos,
idempotência, publicação por manifesto e coordenação entre réplicas. As fontes incluem
JSON, XLSX, XLS legado em ZIP e PDFs históricos. A migração não pode fabricar revisões ou
perder a importação conservadora da PoC.

## Alternativas

| Alternativa | Consequência |
|---|---|
| Manter Python integralmente | Aproveita os leitores existentes; mantém um runtime diferente da direção escolhida |
| Go com coletores Python | Permite migração gradual, mas mantém duas toolchains e processamento fora do processo Go |
| Go integral | Um runtime de backend; exige demonstrar equivalência dos leitores e das identidades |
| ORM como fundação | Simplifica CRUD, mas acrescenta mapeamento e comportamento sobre transações e SQL que já são explícitos |
| CQRS com bancos/fila separados | Acrescenta coordenação e operação sem necessidade demonstrada para o MVP |

## Decisão

Usar um módulo Go em `backend/`, com composição em `internal/app` e binário em `cmd/margem`.
Executar cada job finito em um processo Go, sem chamar Python, Poppler ou outros subprocessos.
`net/http` atende a coleta; a futura API usará `net/http` com `chi` quando suas rotas forem
implementadas. Não introduzir servidor sem o contrato da fase 9.

Os módulos atuais são catálogo, ingestão, observações e preservação legada. Indicadores e
publicações são fronteiras previstas, sem pacotes vazios ou implementação fictícia. Dentro
de um módulo, `commands.go` coordena mudanças; `queries.go` produz visões de leitura.
Regras de domínio ficam em tipos/funções próprios. DDD orienta linguagem e invariantes;
transaction scripts coordenam transações e transições explícitas de execução.

Usar PostgreSQL com `pgx`/`pgxpool`, consultas geradas por `sqlc`, SQL revisável e migrações
versionadas. Não usar ORM, repositório genérico, mediator, event sourcing ou broker no MVP.
A migração `001.sql` conserva os mesmos bytes e checksum. A aceitação confirma lote,
observações, proveniência, recibo, evento e sucesso na mesma transação. Downloads e S3
permanecem fora dessa transação. Cada job mantém seu lock de sessão na mesma conexão;
conexões cujo unlock falhe são descartadas em vez de voltar ao pool.

Preservar decimais textuais/`numeric`, definição e versão do catálogo, IDs de observações,
IDs de lotes e manifesto legado. JSON canônico ordena também as chaves de objetos aninhados
originados de structs, sem escape HTML ou perda de precisão numérica.

A separação de leitura e escrita começa no mesmo processo e banco. A publicação futura
continuará distinguindo aceitação interna de ativação pública. Preparação e selagem de
manifestos terão transições próprias; a ativação pertence ao canal e cria um evento com
nova geração, inclusive em retornos. Isso não exige microserviços.

## Leitores e dependências

Excelize lê XLSX sem arredondar os valores XML por float. `extrame/xls` atende o XLS SIS
fixado; originais IEEE754 permanecem preservados. `ledongthuc/pdf` lê estruturas PDF;
o adaptador posiciona texto e aplica `ToUnicode` em fontes com `Differences`, com métricas
de fontes CID. Isso cobre problemas reais dos boletins históricos sem licença comercial.
`shopspring/decimal` atende os limites numéricos; precisão/arredondamento das fórmulas
continuam responsabilidades versionadas da futura engine. O SDK AWS Go v2 acessa o Cloudflare R2 pela API compatível com S3, com
endpoint configurável, criação condicional, conferência de hash e tamanho.

## Consequências e limites

A manutenção passa a uma toolchain Go além do frontend Node. Há mais código explícito no
adaptador PDF; novos layouts e métodos continuam exigindo revisão do catálogo e testes.
Não se generaliza a validação do corpus para qualquer PDF ou XLS. O parser legado pode
lançar panic; o adaptador converte isso em falha de qualidade sem aceitar lote parcial.
Downloads têm limite de 64 MiB e arquivos descompactados de 128 MiB.

Um processo Go não elimina coordenação distribuída quando há réplicas. Locks e transações
PostgreSQL continuam necessários; goroutines e mutexes locais não os substituem. Não há
promessa medida de ganho de latência, memória ou custo frente ao Python.

## Evidências

A [verificação da migração](../systems/evidence/pipelines/go-migration.json) registra replay
dos bytes oficiais coletados pelo Python, igualdade de IDs e lotes, repetição, importação
legada e testes de falhas com PostgreSQL/LocalStack locais. A CI usa fixtures offline e serviços
isolados; não depende da disponibilidade de fontes oficiais. Railway/R2 continuam sem
implantação verificada. A [regra de SEO e descoberta por IA](../../AGENTS.md) permanece
obrigatória para as páginas públicas e a futura API.

Referências: [pgx](https://pkg.go.dev/github.com/jackc/pgx/v5),
[sqlc/pgx](https://docs.sqlc.dev/en/v1.31.1/guides/using-go-and-pgx.html),
[sqlc/transações](https://docs.sqlc.dev/en/v1.31.1/howto/transactions.html),
[Excelize](https://xuri.me/excelize/en/), [XLS](https://github.com/extrame/xls),
[PDF](https://github.com/ledongthuc/pdf) e
[AWS SDK Go v2](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/welcome.html).
