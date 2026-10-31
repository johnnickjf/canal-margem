# Pipelines do MVP — fase 7

## Entrega e evidência

O backend em [`backend/`](../../backend/) coleta as cinco fontes necessárias aos 15 conceitos
selecionados. Há jobs por fonte, migração PostgreSQL, raw privado no Cloudflare R2 pela API compatível com S3, validação, revisões,
recibos, agendamento e diagnóstico. A [verificação histórica Python](evidence/pipelines/verification.json)
registra coleta real desde 2012: **6.375 observações**, com 177 boletins mensais da cesta.
A repetição integral reutiliza os lotes e não acrescenta versões.

A [migração Go](evidence/pipelines/go-migration.json) reproduz os originais preservados e
verifica IDs, lotes e repetição. A coleta original e o replay comprovam fluxos locais com
PostgreSQL 18 e LocalStack, emulador da API S3 usada pelo cliente R2. O replay não representa nova consulta às fontes oficiais;
a CLI Docker também foi exercitada com coleta real BCB de janeiro/fevereiro de 2025.
Esses ensaios não comprovam operação na Railway, bucket lock R2, backup nativo, indexação externa
ou publicação de indicadores. A configuração do cron está entregue; o serviço remoto não foi
criado. TR2 e CV5 são calculados pela [engine da fase 8](indicator-engine.md), com seleção explícita dos inputs aceitos.

Critérios desta entrega: todas as fontes selecionadas percorrem coleta → raw confirmado →
normalização → aceitação relacional; repetição não duplica observações/lotes; revisões mantêm
o histórico; falhas deixam o último lote aceito disponível; originais e observações têm vínculos
diretos; fontes têm locks e cadência independentes; falhas e atraso são consultáveis. A migração
da PoC preserva os originais e as identidades sem inventar ordem oficial de edições.

## Componentes e fronteiras

| Código | Responsabilidade |
|---|---|
| [`catalog`](../../backend/internal/catalog/) | 28 séries/recortes externos, métodos, unidades, classificações e cadências |
| [`api_sources.go`](../../backend/internal/ingestion/api_sources.go) | IBGE e SGS; JSON, metadados, períodos e recortes exatos |
| [`file_sources.go`](../../backend/internal/ingestion/file_sources.go) | Descoberta de arquivos ANP, Conab/DIEESE e FJP |
| [`spreadsheets.go`](../../backend/internal/ingestion/spreadsheets.go) | XLSX e ZIP/XLS SIS, preservando decimais |
| [`basket.go`](../../backend/internal/ingestion/basket.go) e [`pdf_text.go`](../../backend/internal/ingestion/pdf_text.go) | Cesta, texto posicionado, fontes e ToUnicode |
| [`http.go`](../../backend/internal/ingestion/http.go) | Timeout, três tentativas, captura, limite de bytes e redirects por fontes permitidas |
| [`observations`](../../backend/internal/observations/) | Regras de domínio, aceitação transacional e consultas de integridade |
| [`commands.go`](../../backend/internal/ingestion/commands.go) e [`queries.go`](../../backend/internal/ingestion/queries.go) | Jobs, locks, cadência e visões de saúde |
| [`legacy`](../../backend/internal/legacy/) | Inventário/importação da PoC sem promoção |
| [`postgres`](../../backend/internal/platform/postgres/) e [`objectstore`](../../backend/internal/platform/objectstore/) | SQL gerado por sqlc/pgx, migração 001 intacta e cliente da API compatível com S3 do R2 |

O [ADR-0007](../adr/0007-go-modular-backend.md) substitui Python por Go integral, em monólito
modular, com DDD e comandos/consultas separados no mesmo processo e PostgreSQL. Não há ORM,
broker ou event sourcing. O [ADR-0006](../adr/0006-pipeline-runtime.md) registra o estado anterior.
O site Astro permanece estático, sem importar o backend ou consultar provedores durante visitas.
Engine, publicação e API permanecem nas fases seguintes, com `net/http`/`chi` previstos para a API.

`raw` guarda objetos e capturas; `normalized` guarda observações, membros de lotes,
recibos e proveniência. `derived` e `published` são schemas reservados para as fases 8 e 9,
sem dados ou leitores públicos. Não existe ativação automática do lote mais recente.
`ops` guarda catálogo, migração, execuções e eventos; `legacy` preserva a PoC separadamente.

## Recortes e qualidade

| Fonte | Dados aceitos e cuidados |
|---|---|
| IBGE | TR1/TR4/TR5, jornada, participação, subutilização, IPCA, alimentação no domicílio em dois segmentos, INPC, Gini, segurança alimentar e PIB per capita; QV1 vem do ZIP/XLS SIS 2025 |
| BCB | SGS 29265, 21084 e 1619, por mês; não aceitar dia diferente de 01, buracos internos, duplicatas, taxas fora do domínio ou mínimo não positivo |
| ANP | Gasolina comum, Brasil ponderado, R$/L; dois históricos, datas originais da semana, postos e mínimo ≤ médio ≤ máximo; lacunas catalogadas de 2015/2020 explícitas |
| Conab/DIEESE | Tabela 1 de cada PDF descoberto, valor nominal por capital; cobertura declarada, notas e tempo publicado para confronto, sem calcular CV5 |
| FJP | Sete valores de 2016–2019 reponderados e 2022–2024, segmentados por edição; domicílios urbanos estimados, sem truncar frações ou emendar métodos |

A janela padrão é 01/01/2012 até hoje. Só períodos inteiros entram no lote: a coleta em outubro
não aceita um mês que termina depois do dia da execução. Não é promessa de cobertura desde
2012 para toda série: a primeira referência depende da fonte. Não interpolar FJP em 2020/2021,
segurança alimentar antes de 2023 ou séries ainda não publicadas. A disponibilidade de períodos
do IBGE é capturada junto dos metadados; observações devem corresponder exatamente ao pedido.

Decimais são strings canônicas na aplicação e `numeric` no banco. Nas planilhas XLSX, os números
vêm dos valores XML originais, sem round-trip por float. XLS guarda números IEEE754; o original
binário é preservado e a saída textual mantém sua representação recuperável. Símbolos SIDRA
são tratados somente no adaptador IBGE. Em PDFs, `ND`, traços e notas de ausência viram estado
`missing` com o símbolo original, nunca custo zero.

A leitura histórica encontrou mudanças de ordem das colunas, espaços não separáveis,
nomes quebrados entre linhas, notas junto ao nome e tabelas entre páginas. Há 16 layouts de
boletins representados por extratos nos testes. Maio/2019 repete exatamente São Paulo no PDF:
a normalização conserva uma observação e registra a repetição; linhas divergentes bloqueiam.
Novembro/2019 anuncia 17 capitais, mas marca Brasília sem dados; maio/2021 marca Belo Horizonte
sem dado. O lote conserva essas ausências e a contagem efetivamente observada.
As coberturas antigas e a parceria de 2025 têm segmentos próprios, sem afirmar continuidade.

TR1 conserva a indicação de base real da divulgação **ainda não resolvida para publicação**;
a engine/API deverá incorporar a nota monetária da edição antes de expor valores comparáveis.
FJP usa edições cadastradas e bloqueia novas planilhas desconhecidas no índice. QV1 fixa
SIS 2025/PPC 2017/US$ 6,85 e exige alteração explícita de catálogo para outro anuário ou linha.
Mudanças de método não se resolvem escolhendo o arquivo mais novo. As condições de
redistribuição e limites das [fichas de fontes](../data-sources/README.md) continuam aplicáveis.

## Histórico, atomicidade e recuperação

O SHA-256 identifica bytes; a observação identifica série, período, território, valor, estado,
método, normalização e localizador. Capturas novas preservam URL, horário, status e headers
relevantes mesmo quando reutilizam bytes. Cada observação aceita aponta para suas capturas;
o IBGE inclui também os metadados. Alterar bytes sem alterar o conteúdo normalizado não
fabrica revisão. Alterar valor ou contexto acrescenta observação e lote, mantendo os anteriores.

Sem vintage oficial verificável, a identidade é de conteúdo/captura, sem ordem oficial
inventada. Um recibo relaciona cada execução ao lote aceito. Se uma fonte voltar a um conteúdo
antigo, outro recibo registra essa captura, reutilizando o conteúdo; não se cria um ciclo de
predecessores. A [publicação da fase 9](api.md) exige seleção explícita de IDs e justificativa da edição; não promove automaticamente a última chegada.

Upload usa `If-None-Match: *`, com leitura e conferência de hash/tamanho. Outra verificação
precede o commit. Downloads não mantêm uma transação SQL aberta. Observações, membros,
recibo, evento de aceitação e estado de sucesso são confirmados juntos. Uma falha SQL depois
do upload deixa raw sem lote aceito; a repetição reutiliza os objetos. O comando `verify`
confere todos os objetos conhecidos e a existência dos vínculos das observações aceitas.

A importação da PoC adquire o mesmo lock local dos comandos antigos, verifica nomes/hashes,
seleções, predecessores, lotes, capturas e metadados. Copia todos os arquivos para o armazenamento raw (R2 em produção) e registra
um manifesto imutável em `legacy`, além das observações com seus IDs, valores e timestamps
originais. Não apaga arquivos nem converte capturas em edições oficiais. A repetição foi
conferida sobre os 21 arquivos e 587 observações locais. Isso é preservação do histórico
experimental. A CLI TypeScript foi retirada após verificar o fluxo job → banco → API da fase 9; o importador Go continua como ferramenta de preservação.

Para reconstruir, aplicar migrações numa base nova e executar os jobs para as fontes disponíveis.
A coleta real desta entrega começou com uma base vazia. As versões recuperadas são as que a
fonte disponibiliza agora; não se atribuem timestamps antigos à reconstrução. Para preservar
recibos e capturas anteriores, é necessário recuperar também o banco e seus objetos.
Um dump PostgreSQL local foi restaurado em outra base e teve as 6.375 observações e os
352 objetos raw conhecidos conferidos. Esse ensaio reutiliza o mesmo bucket e não representa
restauração do object storage nem backup nativo Railway. O backup nativo e a restauração do
volume Railway permanecem um ensaio da implantação,
conforme [armazenamento e recuperação](storage.md). Não foram contratados ou simulados como
se fossem backups remotos verificados.

## Armazenamento: Cloudflare R2

O provedor de produção é **Cloudflare R2 Standard**, em bucket privado para raw.
S3 designa a interface compatível usada pelo cliente, pelas variáveis `S3_*` e pelo
AWS SDK Go v2; não há bucket AWS S3 previsto. LocalStack emula essa interface nos testes
locais e na CI, sem validar credenciais, bucket lock ou operação do serviço R2.

Na Railway, definir as variáveis abaixo pelos segredos do serviço:

| Variável | Valor em produção |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL da Railway, com o login de runtime |
| `S3_ENDPOINT_URL` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, endpoint da conta R2 |
| `RAW_BUCKET` | Nome do bucket raw privado criado no R2 |
| `AWS_ACCESS_KEY_ID` | Access Key ID emitido para o bucket R2 |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key emitido para o bucket R2 |
| `AWS_DEFAULT_REGION` | `auto` (padrão do cliente se ausente) |

Os nomes `AWS_*` são a convenção do SDK; seus valores são credenciais R2, não credenciais
de uma conta AWS. O endpoint é obrigatório e o cliente não assume um endpoint AWS.
O arquivo `backend/.env.example` contém somente valores locais; a CLI não carrega `.env`
automaticamente. Exportar as variáveis no shell ou configurá-las no serviço Railway.

Referências: [exemplo Go oficial do R2](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-go/)
e [compatibilidade da API S3](https://developers.cloudflare.com/r2/api/s3/api/).

## Executar localmente

Requer Go 1.26.6 (mesma versão da CI e da imagem), Docker e, para os comandos
`pnpm`, Node/pnpm nas versões do README. Para uso direto: `go -C backend run ./cmd/margem --help`. As dependências ficam em [`go.mod`](../../backend/go.mod) e
[`go.sum`](../../backend/go.sum). O compose usa portas locais 55437 e 59007. O bucket deve
ser provisionado antes dos jobs; no LocalStack, o comando abaixo cria apenas o bucket local.

Para iniciar a API e o frontend juntos, execute `pnpm dev:full` na raiz. O comando sobe
PostgreSQL/LocalStack, aplica migrações locais e inicia os dois servidores. Se o banco ainda
não tiver publicação ativa ou a projeção não estiver disponível no LocalStack, o frontend usa
o catálogo local sem observações e informa o problema no terminal. O comando de desenvolvimento
não provisiona buckets nem executa coleta; os comandos abaixo continuam necessários para
preparar os dados dos pipelines.

```bash
docker compose -f backend/compose.yaml up -d --wait
go -C backend mod download
cp backend/.env.example backend/.env
set -a
source backend/.env
set +a
docker compose -f backend/compose.yaml exec s3 awslocal s3 mb s3://margem-raw
pnpm pipeline migrate
pnpm pipeline import-poc --root .data/ingestion   # se houver a PoC local
pnpm pipeline run --source ibge
pnpm pipeline run --source bcb
pnpm pipeline run --source anp
pnpm pipeline run --source dieese
pnpm pipeline run --source fjp
pnpm pipeline tick
pnpm pipeline status
pnpm pipeline monitor
pnpm pipeline verify
```

`--from` e `--to` recebem datas ISO, por exemplo `--from 2025-01-01 --to 2025-12-31`.
Janelas mensais começam no dia 01. Janelas sem observações elegíveis falham explicitamente.
O compose não configura persistência para o estado S3: parar ou reiniciar o LocalStack pode
perder buckets e objetos, mesmo quando o PostgreSQL ainda conserva as referências. O volume
anônimo por si só não é backup. Preserve e confira uma cópia antes de interromper os serviços;
veja o [ensaio local](evidence/phase-25-local/recovery.md). Não usar senhas locais em serviços
externos. Segredos ficam no ambiente; nunca vão para o frontend ou o Git.

`verify` confere tamanho e SHA-256 de cada objeto raw registrado e, se todos estiverem
íntegros, procura observações aceitas sem vínculo de captura. No sucesso retorna `verified`,
quantidade e bytes verificados. Para chaves ausentes ou bytes divergentes, retorna código 1
e JSON em stderr com o total de falhas e até 100 hashes com motivo `missing` ou `corrupt`;
`objects` e `bytes` contam somente objetos íntegros. Quando há falhas raw, a etapa de vínculos
não é executada. Falhas de conexão, autenticação ou bucket não são classificadas como perda
individual de objetos e interrompem a execução. O comando não altera nem restaura dados.

### Cópia local antes de interromper os serviços

Com PostgreSQL e LocalStack do `backend/compose.yaml` ativos, pare os jobs, ativações e outros
escritores e execute `pnpm backup:local`. O comando usa exclusivamente o banco local `margem`
e os buckets locais `margem-raw` e `margem-public`: não usa nem faz backup de Railway ou R2.
Ele salva um dump `pg_dump -Fc`, confere sua leitura com `pg_restore -l`, copia os dois buckets
e compara tamanho e SHA-256 de cada objeto registrado no banco. Objetos não registrados também
são copiados e listados com hashes. A saída fica sob `.data/local-backups/` com diretório 0700
e manifesto local; trate a cópia como dado privado e proteja-a também ao transferi-la.

O manifesto registra `objects_verified` quando as referências examinadas existem e coincidem,
ou `partial` quando faltam objetos ou há divergências. Uma cópia parcial fica disponível para
investigação, mas o comando retorna código 1; falhas de execução também retornam 1 e podem
deixar um diretório sem manifesto. Confira `manifest.json` e não interprete a mera existência
do diretório como sucesso. Se houver jobs em execução no início ou no fim, ou o inventário de
objetos e a geração mudarem durante a cópia, a execução não valida o artefato.

As consultas antes e depois detectam algumas mudanças, mas **não bloqueiam escritores** nem
tornam a captura transacional entre PostgreSQL e S3. Desligar os escritores durante todo o
procedimento continua obrigatório. O comando não restaura nem agenda cópias; `pg_restore -l`
não substitui um ensaio de restauração, e uma cópia no mesmo disco não é backup independente.
O [ensaio local](evidence/phase-25-local/recovery.md) registra a restauração e as ausências
conhecidas.

## Agendamento e observabilidade

[`railway.toml`](../../backend/railway.toml) prepara `tick` no minuto 17 de cada hora UTC;
o processo termina ao concluir. Configurar Root Directory `/backend`. O scheduler consulta
IBGE/BCB/DIEESE a cada 24 horas e ANP/FJP a cada sete dias, com reconciliação integral da
janela. A cadência é de consulta, não garantia de divulgação. `run` força uma execução manual.

Cada fonte usa lock de sessão PostgreSQL. Um segundo worker retorna `busy`; fontes distintas
podem executar separadamente. Após obter o lock, o worker marca como falha uma execução
antiga ainda `running`, pois o dono anterior já perdeu a sessão. `tick` registra uma falha e
continua nas outras fontes. Retorna código 1 se algum job falhar. A cadência considera o catálogo e a janela: uma execução com início posterior ou fim
anterior ao necessário não adia a reconciliação mais ampla. Para a janela que avança até hoje,
o fim precisa cobrir pelo menos o dia UTC em que a execução anterior começou; assim, a
mudança de dia não transforma jobs semanais em diários. Uma consulta falha da mesma janela volta
na próxima cadência; HTTP 429/5xx e transporte têm até três tentativas com espera limitada.
Erros de schema e HTTP 4xx restantes não recebem retries automáticos.

Eventos JSON vão para stderr e `ops.event`; dados completos de cada execução ficam em
`ops.run`. `status` retorna código 1 se falta sucesso, houve falha mais recente, a consulta
venceu duas cadências ou a última referência está atrasada. Tolerâncias iniciais: semanal
21 dias; mensal 90, exceto VF1 com 120; trimestral 200; anual 1.100. Segmentos encerrados,
como CV2 antigo, não são cobrados como atuais. São limites operacionais configurados no
código, não SLAs oficiais. O relatório calcula a cobertura sobre todo o histórico aceito no catálogo atual, por série,
período e território, usando o conteúdo da execução mais recente para cada referência, sem
contar revisões ou repetições como novos períodos. Um lote parcial não apaga a cobertura
anterior do diagnóstico. `missing_series` identifica recortes do catálogo sem observações
aceitas; `stale_series` identifica séries abertas cuja última referência venceu a tolerância.
Ambas as condições tornam a fonte não saudável, inclusive quando a série ausente pertence
a um segmento histórico encerrado. A tolerância de atraso só se aplica a séries abertas. Um monitor
externo pode executar `status`; a fase 22 acrescenta `pnpm pipeline monitor`, com o mesmo
critério, `checked_at` e estado geral, para uso em schedulers. O comando retorna 1 quando o
diagnóstico está insalubre. Os jobs registram início, status e duração estruturados. O comando
pode enviar eventos a um webhook HTTPS configurado ou deixar o scheduler notificar pelo código
de saída. A configuração está em [Observabilidade e operação](operations.md).

## Implantação e validação

A imagem é construída por [`backend/Dockerfile`](../../backend/Dockerfile), executa como usuário
sem privilégios e inclui a CLI instalada. Banco, bucket e credenciais não são criados pelo job.
Antes de operar na Railway/R2, executar a migração com credencial administrativa; criar o
grupo `margem_worker NOLOGIN`, um login de runtime membro desse grupo e aplicar
[`runtime-grants.sql`](../../backend/runtime-grants.sql) como administrador. A importação
`import-poc` também usa credencial administrativa: o worker não recebe acesso ao schema `legacy`.
O worker recebe leitura e inserção necessárias e atualização restrita de execuções; não recebe
DDL, exclusão ou alteração de histórico. Habilitar bucket lock indefinido em `raw/` e credencial
sem gestão de regras, conforme ADR-0002. Multipart está desabilitado: cada resposta tem limite
de 64 MiB, e ZIP descompactado de 128 MiB. Não há limpeza automática de raw ou histórico.

```bash
pnpm test:backend
TEST_DATABASE_URL='postgresql://margem:local-only@127.0.0.1:55437/margem' TEST_S3_ENDPOINT_URL='http://127.0.0.1:59007' pnpm test:backend
docker build -t margem-pipeline backend
docker run --rm margem-pipeline --help
```

O detector de corridas requer CGO habilitado e um compilador C (por exemplo, GCC).
Os testes criam um banco e bucket exclusivos e os removem ao final; o login de teste precisa
criar bancos e papéis. Sem essas duas variáveis, os testes de serviços são explicitamente
ignorados; `REQUIRE_INTEGRATION=1` torna a ausência uma falha. A CI configura PostgreSQL e LocalStack, exige a integração, verifica sqlc e constrói a imagem.
Os testes não fazem chamadas às fontes oficiais. A coleta Python original fica no [registro histórico](evidence/pipelines/verification.json);
a substituição está no [registro Go](evidence/pipelines/go-migration.json).
A [regra permanente de SEO e descoberta por IA](../../AGENTS.md) permanece obrigatória para as
futuras páginas e a API pública.

## Verificar a migração com originais preservados

O corpus privado contém `urls.json` (URL, status, headers e SHA-256), `raw/<sha256>` e
`observations.json` (IDs/resultados Python). Não é baixado durante a CI. Com serviços locais
preparados, executar:

```bash
MIGRATION_CORPUS=/caminho/absoluto/corpus go -C backend test ./internal/ingestion -run TestMigrationOfficialCorpus -v
MIGRATION_CORPUS=/caminho/absoluto/corpus MIGRATION_POC=/caminho/absoluto/poc REQUIRE_INTEGRATION=1 go -C backend test ./integration -run TestOfficialMigrationEndToEnd -v
pnpm generate:backend
```

O primeiro teste compara os 6.375 IDs normalizados. O segundo percorre coleta HTTP simulada
com bytes originais → LocalStack (API S3) → PostgreSQL duas vezes, exige os mesmos cinco IDs de lote e nenhuma
nova versão na repetição. Importa também a PoC, quando indicada, preservando seu manifesto,
21 arquivos e 587 observações. Novos originais ou mudanças de normalização precisam de outro
corpus/evidência; não atualizar os IDs esperados apenas para fazer um teste passar.
