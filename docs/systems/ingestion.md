# Ingestão — PoC da fase 5

## Estado e escopo

A PoC implementa `fetch → validate → raw → normalize → persist → expose` por comando local,
com TR4, CV1 e VF1: três indicadores, quatro séries externas e duas fontes. O código está em
[`src/ingestion`](../../src/ingestion/), separado do build e do JavaScript entregue ao navegador.
A coleta não acontece durante uma visita ao site. Não há novas rotas públicas.

O contrato desta entrega é obter as quatro séries oficiais, preservar bytes e proveniência,
validar os recortes, aceitar um lote inteiro, ler os dados sem conexão com os provedores e
conservar revisões. Repetição sem mudança deve reutilizar observações e aceitação; falha em
qualquer recorte deve manter o snapshot anterior. Logs, timestamps, timeout, retries e estado
da atualização precisam ser inspecionáveis. A evidência exigida é execução local e testes de
falha, sem comprovação de operação em produção.

| ID local | Indicador / fonte | Referência e medida |
|---|---|---|
| `tr4` | TR4 — IBGE `4099/4099` | Trimestre civil; taxa de desocupação, pessoas de 14+; % da força de trabalho |
| `cv1-monthly` | CV1 — IBGE `1737/63` | Mês civil; variação mensal do IPCA; % |
| `cv1-12m` | CV1 — IBGE `1737/2265` | Referência mensal; variação oficial acumulada em 12 meses; % |
| `vf1` | VF1 — BCB SGS `29265` | Referência mensal; média móvel trimestral do serviço da dívida/RNDBF, sem ajuste sazonal; % |

Geografia: Brasil. Um trimestre nunca vira um mês. A data `01/MM/AAAA` do BCB é um rótulo
mensal; a média móvel de VF1 permanece explícita no catálogo exportado. CV1 em 12 meses
é obtido da fonte, sem soma de taxas ou cálculo no frontend.

## Uso

Com as dependências instaladas e Node >=22.13:

```bash
pnpm ingestion fetch --from 2025-01 --to 2025-12
pnpm ingestion read --series tr4
pnpm ingestion read --series vf1 --history
pnpm ingestion status

# Reconciliação: busca novamente a janela histórica completa nas duas fontes.
pnpm ingestion fetch --from 2012-01 --to 2026-10

# Salvar o contrato local em arquivo, sem consultar a fonte novamente.
pnpm ingestion read > /tmp/margem-indicators.json
```

`--store DIRETÓRIO` muda o armazenamento, cujo padrão é `.data/ingestion/`, ignorado pelo Git.
Datas são meses inclusivos, com início >=2012-01, término até o mês corrente e ao menos um
trimestre civil completo dentro do intervalo. Intervalos parciais excluem trimestres que não
cabem inteiros. Ambos os limites são obrigatórios: não há consulta ilimitada ou janela móvel
implícita. Reexecutar a mesma janela verifica também revisões históricas.

`fetch` escreve logs JSON em stderr e o recibo em stdout; erro retorna código 1. `read`
exporta JSON com catálogo, proveniência, cobertura, último sucesso e observações selecionadas.
`--history` inclui predecessores; `--snapshot HASH` fixa uma versão local imutável. A cobertura
informa primeiro/último período observado, quantidade e janelas dos lotes canônicos em
`accepted_windows`. `last_success.window` registra a janela da última coleta aceita, mesmo se
ela reutilizar um lote anterior sem novos dados; término solicitado não é promessa de publicação
até aquela data. Snapshots anteriores à inclusão deste campo continuam legíveis, mas não
informam essa janela em `last_success`; consulte o registro do run correspondente.
`publication: null` identifica que a aceitação local
não é uma publicação pública do Margem. `status` separa última tentativa de último sucesso;
`freshness: unknown` evita equiparar sucesso de coleta a cumprimento do calendário estatístico.

## Fluxo, arquivos e atomicidade

1. `catalog.ts` fixa os recortes, identidades, métodos locais e URLs oficiais. O IBGE recebe
   períodos explícitos e `N1[1]`; o BCB recebe datas delimitadas. Cada execução consulta dois
   metadados IBGE e três endpoints de dados, em sequência.
2. `pipeline.ts` faz GET com timeout de 20 segundos por tentativa, sem seguir redirects, com
   até três tentativas para 429, 5xx, falha de conexão ou timeout. O backoff é de 1 e 2 segundos.
   Erros permanentes, JSON inválido e violações de schema não são repetidos.
3. Cada resposta recebida é preservada em `raw/<sha256>` antes de interpretar ou normalizar,
   inclusive HTML de bloqueio e erros HTTP. O JSONL do run registra URL, hash, número de bytes,
   status, Content-Type, ETag, Last-Modified, coleta e tentativa. Resposta incompleta por timeout
   não é tratada como raw completo. Raw e snapshots são escritos e sincronizados em arquivo
   temporário antes de serem disponibilizados por hard link, sem sobrescrever o destino.
   Falha na escrita não deixa um artefato definitivo parcial; artefatos existentes têm checksum
   conferido e conflitos não são sobrescritos. Arquivos parciais produzidos pela implementação
   anterior continuam sendo rejeitados e exigem inspeção manual antes de uma nova coleta.
4. `normalize.ts` valida schema em execução: tipos, IDs, cardinalidade de variáveis/resultados,
   Brasil, classificações vazias, frequência, unidade, calendário, janela, decimais e domínio.
   Unidade vazia do IBGE só é resolvida pelo metadado preservado da tabela/variável exata.
   BCB exige primeiro dia do mês, unicidade e ordem crescente.
5. A cobertura deve começar no primeiro mês/trimestre inteiro solicitado e não pode ter
   lacunas internas. Ausências explícitas são mantidas; caudas ainda não retornadas pela fonte
   ficam sem cobertura. As duas medidas de CV1 precisam cobrir os mesmos meses. Omissão de
   período previamente aceito dentro da janela rejeita o lote, inclusive na cauda.
6. `store.ts` prepara observações, vínculos de revisão e recibo de aceitação em memória.
   Grava um snapshot completo em `snapshots/<sha256>.json`; depois troca `current` por rename
   de arquivo temporário sincronizado. Leituras usam um snapshot inteiro. Falha antes da troca
   não aceita parcialmente os dados; snapshots já gravados continuam recuperáveis por hash.
7. `cli.ts` lê somente arquivos locais, confere o hash do snapshot e exporta a seleção atual
   ou seu histórico, ordenados por série, período e aceitação.

```text
.data/ingestion/
  raw/<sha256>                 bytes originais; nunca sobrescritos
  runs/<run>.jsonl             eventos e proveniência por tentativa
  runs/<run>.json              running, succeeded ou failed; resumo operacional
  snapshots/<sha256>.json      observações, seleção, lotes e último sucesso
  current                     hash do snapshot aceito
  writer.lock/owner.json       exclusão de escritores; PID e criação
```

Um lock exclusivo cobre toda a execução; outro escritor falha antes de coletar. A liberação
ocorre em `finally`. Após interrupção abrupta, um lock pode permanecer. Confira o PID de
`owner.json` e o processo antes de remover **apenas** `.data/ingestion/writer.lock/`; não há
expiração automática que permita dois escritores. Um resumo `running` também pode ser órfão;
ele não comprova que o processo continua vivo. Arquivos temporários e snapshots sem referência
podem sobrar após falha e não entram nas leituras.

O recibo e `last_success` são gravados no mesmo snapshot dos dados. Se o comando perder a
resposta ou falhar ao escrever o relatório depois da troca de `current`, confira `status` e
o `last_success` do snapshot antes de concluir que não houve aceitação. Repetir a coleta não
duplica observações ou o lote canônico sem mudanças.

## Valores, revisões e limites do modelo

Decimais são strings canônicas, sem arredondamento binário. Deflação é válida; TR4/VF1 ficam
entre 0 e 100. Na legenda SIDRA, `...` é ausência, `..` não se aplica, `X` é inibição e `-`
é zero absoluto; a regra não se transfere para BCB. Ausência nova substitui o número na
seleção atual, com `value: null`, motivo e predecessor, sem apagar o histórico.

Mesmos valores/estados/notas preservam IDs e `accepted_at`. Uma alteração acrescenta observação
com `supersedes`, `revision_status: revised` e nota de detecção. Um retorno A → B → A cria
três versões. O fingerprint e os IDs selecionados permitem reutilizar o lote em repetição
sem mudança. Raw e logs da nova coleta permanecem mesmo quando o lote é reutilizado.

Os endpoints não fornecem edição nem data de publicação por observação. Por isso:

- `published_at` é `null`, com nota explícita; `release_status` é `unknown`;
- a primeira versão tem `revision_status: unknown`, sem afirmar que nunca foi revisada;
- `vintage` identifica a captura local em `runs/`, **não** um `Vintage.order` oficial;
- a seleção representa consultas correntes serializadas, não reconstrói o histórico de
  divulgações anterior à primeira coleta e não aceita replay arbitrário como nova edição;
- `methodology_version` identifica o contrato local catalogado, sem inventar uma versão
  oficial da metodologia. Mudanças de pesos/método/edição exigem revisão do contrato;
- `normalization_version: poc-1` é separada. Uma versão diferente do armazenamento é rejeitada;
  não há migração ou correção local de normalização automática.

A PoC exercita a parte de ingestão das garantias G01–G03 e G07–G09 do
[catálogo de operações](data-operations.md): preservação, indivisibilidade, repetição e
exclusão de escritores. Não implementa todo W01–W09, ordenação oficial de vintages, publicação
por canal, autenticação, paginação, cache, engine ou API de produção. O contrato local de exportação
não antecipa o contrato da fase 9.

## Evidências e verificações

Em 17/10/2026, a execução real obteve 40 observações de 2025; a repetição criou zero versões.
Em seguida, a reconciliação desde 2012 aceitou outras 547, totalizando **587 observações**:

| Série | Períodos observados | Quantidade |
|---|---|---:|
| TR4 | 2012T1–2026T2 | 58 |
| CV1 mensal | jan/2012–set/2026 | 177 |
| CV1 em 12 meses | jan/2012–set/2026 | 177 |
| VF1 | jan/2012–jul/2026 | 175 |

A repetição integral criou zero observações e reutilizou o lote anterior. O
[registro de execução](evidence/ingestion/verification.json) preserva horários, comandos,
hashes, URLs, resultados e cobertura. Os cinco corpos da reconciliação estão em
`evidence/ingestion/*.json.raw`, byte a byte, sem formatação; o manifesto os referencia por hash.
Os corpos das duas coletas iniciais de 2025 permanecem apenas no armazenamento local ignorado;
seus resultados e metadados foram registrados no manifesto. Não há revisão oficial real observada
nessa repetição: revisão, retorno, ausência nova e falhas são verificados por cenários controlados.

[`pipeline.test.ts`](../../tests/unit/ingestion/pipeline.test.ts) cobre o fluxo completo com
amostras oficiais preservadas, leitura via CLI, idempotência, revisão histórica, retorno de valor,
ausência, falha parcial, gravação interrompida, corrupção detectável, concorrência, retries,
schema, lacunas e períodos. Também verifica a janela da última coleta em `read`/`status`,
mesmo com lote reutilizado, e a compatibilidade de snapshots sem esse campo.
[`store.test.ts`](../../tests/unit/ingestion/store.test.ts) verifica a retomada da coleta após
escrita parcial ou falha de sincronização, checksums e gravações concorrentes sem sobrescrita.
Os testes não dependem da rede. A captura real preservada também é
reexecutada offline para conferir hashes, contagens e repetição. `pnpm test` inclui esses testes,
cobertura, lint, tipos, build e regressões editoriais/SEO no navegador.

Auditoria de conclusão em 17/10/2026:

| Critério | Evidência | Resultado |
|---|---|---|
| Quatro séries oficiais percorrem todo o fluxo | Duas coletas reais por janela, exportação por CLI e replay offline dos cinco corpos preservados | 587 observações; leitura local independente das fontes |
| Raw e metadados permanecem rastreáveis | SHA-256 e tamanho dos cinco corpos conferidos; localizadores por observação e eventos de coleta | Atendido; originais preservados antes da normalização |
| Repetição e revisão não corrompem histórico | Repetição real com zero versões; testes de revisão, A → B → A e ausência explícita | Atendido; sem revisão oficial nova observada na captura |
| Falhas e concorrência não aceitam lote parcial | Testes de HTML, schema, lacunas, falha de gravação e dois escritores | Snapshot anterior preservado; conflito explícito |
| Logs, timestamps, retries e atualização são verificáveis | Eventos/recibos, último sucesso separado da última tentativa, testes 429/503/timeout | Atendido na execução local; freshness permanece desconhecida |
| Qualidade e regressões do site | `pnpm test`: 87 testes unitários e 35 testes de navegador/build; lint e tipos sem erros | Atendido; build de 38 páginas, incluindo verificações locais de SEO |
| Documentação e capturas são consistentes | Links locais existentes, cinco checksums/tamanhos e `git diff --check` | Atendido |

**DONE — fase 5 concluída no escopo de PoC local.** Não há bloqueios conhecidos para esta
entrega. Indexação externa, implantação, durabilidade de produção e recorrência não foram
verificadas e não são resultados desta fase.

## Decisões posteriores

### Retirada obrigatória após a substituição

Esta PoC tem ciclo de vida temporário. Após verificar as integrações reais e o backend com
API própria, sua retirada deve cumprir o
[critério de transição da fase 9 para a fase 10](../04-roadmap.md#critério-de-transição-para-a-fase-10--retirada-da-poc).
Adaptadores, validações e testes úteis serão incorporados ao backend; a CLI, a persistência
local provisória e os demais artefatos exclusivos da experimentação serão removidos, junto
com comandos e referências obsoletos. Não será mantida uma implementação paralela da PoC.

As capturas em `evidence/ingestion/` também entram nessa revisão: remover as que perderem
utilidade, manter somente fixtures necessárias aos testes definitivos e transferir evidências
de auditoria ainda exigidas para o armazenamento definido na fase 6 antes de excluir cópias.
A retirada só se encerra com o fluxo real verificado, as dependências migradas e as validações
afetadas aprovadas. Esta regra registra o trabalho futuro; os artefatos ainda usados pela PoC
não são removidos nesta entrega.

### Armazenamento e operação

O filesystem local é o mecanismo descartável da experimentação, sem dependências novas. O custo
é regravar todo o estado por coleta e reter snapshots completos: não é uma decisão de banco,
object storage ou retenção de produção. A [fase 6](storage.md) mediu essa base e definiu
PostgreSQL/Railway, R2, histórico/cache, backup nativo/reconstrução e portabilidade em cinco ADRs. A implementação e o ensaio
de restauração ainda são posteriores; a PoC permanece ativa até a substituição verificada. O rename dá atomicidade local; não foi verificada durabilidade contra falha do disco,
filesystem de rede ou múltiplas máquinas.

Não há agendamento, alerta ou SLA de atualização; são trabalhos das fases 7 e 22. As consultas
observadas não medem quota ou disponibilidade contínua. O catálogo das demais fontes e os
15 principais continuam no escopo. A publicação dos dados exige cumprir as condições de
atribuição e redistribuição das [fichas IBGE](../data-sources/ibge.md) e [BCB](../data-sources/bcb.md).
O site editorial continua sujeito à [regra permanente de SEO e descoberta por IA](../../AGENTS.md).
