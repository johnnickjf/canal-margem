# Diagnóstico e recuperação local — 27/10/2026

Estado: parcial. Este ensaio usa PostgreSQL e LocalStack locais; não comprova backup ou
recuperação na Railway/R2 e não fornece persistência ou agendamento automáticos.

## Objetos ausentes

No início do ensaio, 18 dos 102 objetos registrados em `raw.object` não estavam no bucket.
Dezessete pertenciam aos 21 arquivos da PoC importada em `legacy.file`; o outro era uma
captura HTTP 200 de uma execução BCB de 18/10 que terminou em falha, sem vínculo em
`normalized.provenance`. A PoC original já havia sido retirada e não foi encontrada em
`.data`. Uma das cópias faltantes, SHA-256
`8a08dbe82e3dcf8e1f0ef947d64c3cd63939ab8e15c01ce2443a43ff6ab39d45`, foi localizada em
`backend/internal/ingestion/testdata/tr4.json.raw`. Seu hash foi conferido antes e depois do
upload para a chave original; não se criou captura, lote nem data de coleta. Restam 16
arquivos da PoC e a captura da execução BCB falha sem bytes disponíveis neste ambiente.

A edição de geração 5, ativa no momento do ensaio, não seleciona observações cujo vínculo em
`normalized.provenance` aponta aos 17 objetos ainda ausentes. Seus 35 objetos raw distintos
vinculados às observações selecionadas foram baixados do armazenamento local e tiveram seus
SHA-256 verificados. A dependência transitiva dos cálculos foi exigida pela preparação da
edição. Essa conferência não restaura o histórico da PoC nem prova a integridade de todas as
edições anteriores. `pipeline verify` segue falhando enquanto houver objetos registrados e
ausentes; não foram apagados registros para contornar a falha.

## Backup e restauração isolados

Sem jobs ativos no início, um `pg_dump -Fc` do banco local e cópias dos buckets raw e público
foram gravados sob `.data/phase25-backup-*`. Um manifesto local calculou tamanho e SHA-256 de
90 arquivos: o dump e 89 objetos. Antes da restauração, os 90 foram lidos novamente e
conferidos. O backup não é uma captura transacional conjunta entre PostgreSQL e S3 e não é uma
cópia externa ou uma política de backup. Deve ser protegido e não substitui recuperação dos
objetos ausentes.

O dump foi restaurado em banco separado; os buckets foram recriados com nomes separados e os
89 objetos copiados do backup. A primeira tentativa parou depois do banco por uma opção não
suportada da CLI; a segunda retomou os buckets sem apagar nem recriar o banco. Os 89 objetos
restaurados foram baixados e conferidos por tamanho e SHA-256. Uma API local separada respondeu
com a mesma geração 5, o mesmo ID de edição e o mesmo corte da API original; a consulta à
publicação retornou com sucesso. O `pipeline verify` no ambiente restaurado falha, pois a
restauração conserva as ausências anteriores. Os serviços isolados não são uma operação
recorrente nem verificam credenciais, retenção, lock ou alertas dos provedores de produção.

Um build Astro separado, com a API restaurada e saída em `.data/phase25-restored-site`, gerou
89 páginas. O HTML de desemprego manteve a edição de geração 5 e o valor de 5,1% para o fim de
2025; o de cesta manteve São Paulo, R$ 845,95 e 122 h 36 min. Isso ensaia a reconstrução a
partir da cópia local disponível, sem provar a recuperação dos objetos já perdidos.

Após ativar a geração 6 e coletar o histórico IBGE, outra cópia local reuniu 141 arquivos,
incluindo dump, registros da ativação antes/depois e 138 objetos. Não havia job ativo no
início e a geração permaneceu igual durante a cópia; isso não impede que outro escritor inicie
durante ela nem a torna transacional entre serviços. Os 141 arquivos foram conferidos antes de
restaurar; os 138 objetos restaurados em buckets separados passaram na conferência de tamanho e
hash. A API em banco e buckets isolados retornou a mesma geração 6 e corte. Um build separado
gerou 89 páginas e mostrou desemprego de 5,4% até junho, gasolina a R$ 6,49 até 24/10 e cesta
de São Paulo a R$ 922,51 em setembro/2026. Os 17 objetos históricos ausentes continuam fora do
backup; a operação foi local e não valida recuperação em Railway/R2.

Pendentes: recuperar ou documentar a perda dos 17 objetos ainda ausentes; ensaiar backups com
coordenação de escritores e uma cópia independente; testar restauração no ambiente alvo;
configurar e verificar agenda, monitoramento e alertas reais.

## Retomada local — 31/10/2026

Os contêineres existentes estavam parados. Após iniciá-los sem recriação, o banco ainda
apontava para a geração 6, mas o LocalStack não listava buckets. A cópia local da geração 6
foi conferida contra seu manifesto: 141 arquivos, sem divergências. Os buckets vazios foram
recriados e os 138 objetos da cópia restaurados; todos foram novamente baixados e conferidos
por tamanho e SHA-256. A API voltou a responder HTTP 200 para a edição ativa. A verificação
global `pipeline verify` continua falhando: a cópia já não continha todos os objetos históricos.
O comando informa apenas erro do armazenamento, sem inventário detalhado nessa execução.
Um build separado com `MARGEM_API_URL` apontando para a API local gerou 89 páginas; no HTML
de desemprego foram encontrados o ID da geração 6, 5,4% e o fim de junho de 2026. Essa
checagem confirma a reconstrução desse recorte, não a validação de todos os valores.
Esta recuperação local não elimina a necessidade de persistência e backup independentes.

Na mesma retomada, o inventário do banco foi confrontado com o manifesto da cópia: 17
objetos registrados não constam nela. Seus hashes foram procurados nos arquivos de
`docs/data-sources/evidence`, `backend/internal/ingestion/testdata` e `.data`, limitados a
30 MB por arquivo; nenhuma cópia exata foi encontrada. A busca não cobriu outros discos,
máquinas ou backups externos e não comprova que os objetos sejam irrecuperáveis.

Em um contêiner separado com a imagem `localstack/localstack:3.8` (versão informada 3.8.1),
criou-se um bucket e um objeto sintéticos, parou-se o contêiner normalmente e iniciou-se o
mesmo contêiner com seu volume anônimo. Mesmo com `PERSISTENCE=1` e, em outra tentativa,
`SNAPSHOT_SAVE_STRATEGY=ON_REQUEST`, o bucket não reapareceu após reiniciar. Os logs examinados
não estabeleceram a causa; o resultado não prova o comportamento de outras versões ou planos.
Não se alterou o contêiner que contém os objetos locais. A [documentação do LocalStack](https://docs.localstack.cloud/aws/developer-tools/snapshots/persistence/)
descreve persistência por snapshots e ressalta compatibilidade entre versões; a configuração
do projeto não deve ser considerada persistente com base apenas nessa opção.

Após a melhoria do diagnóstico, `verify` foi repetido contra esses serviços locais: retornou
código 1, 133 objetos íntegros e 17 hashes com motivo `missing`. O resultado não substitui a
recuperação dos bytes nem verifica vínculos de observações enquanto houver falhas raw. Um
teste separado com banco e bucket temporários confirmou a classificação de chave ausente;
testes controlados também distinguem bytes divergentes de falhas de bucket e autenticação.

O novo `pnpm backup:local` foi executado com os serviços locais ativos e sem jobs em andamento.
O manifesto registrou 150 objetos raw e seis projeções esperadas; copiou 138 arquivos com
hashes iguais aos da cópia anterior e retornou código 1 com estado `partial`: 17 raw e uma
projeção histórica não estavam disponíveis. As consultas inicial e final concordaram, mas
elas não bloqueiam escritores nem provam captura transacional.

O dump e os objetos disponíveis da primeira execução do comando foram restaurados em um banco
e dois buckets locais novos. A API isolada respondeu com a geração 6 e serviu a projeção ativa;
`verify` conferiu os 133 raw disponíveis e apontou os mesmos 17 ausentes. As cinco projeções
copiadas foram baixadas dos buckets restaurados e tiveram tamanho e hash conferidos. A projeção
da geração 1 continuou ausente. Os recursos isolados usados no ensaio permanecem identificados
no arquivo ignorado `.data/local-backups/backup-wIDImt/restore-check-resources.json`. Este ensaio
não prova restauração remota, cópia independente ou recuperação dos objetos já perdidos.

## Armazenamento S3 local com volume — 31/10/2026

`backend/compose.persistent-s3.yaml` oferece uma alternativa local baseada em SeaweedFS com
volume nomeado. Em um projeto Compose isolado, um bucket e objeto sintéticos foram gravados,
o serviço foi reiniciado e o objeto foi lido novamente com o mesmo SHA-256
(`e02180aab8ee6214e175aa47539c457c3a11d7b3a77ae93445fa181205d1cf25`). Em seguida,
`pnpm test:backend` passou com `REQUIRE_INTEGRATION=1` contra esse endpoint e PostgreSQL local,
incluindo a suíte de integração Go. O contêiner, o bucket e o volume exclusivos do ensaio
foram removidos após a validação.

Isso verifica compatibilidade do adaptador S3 do aplicativo e persistência após reinício em
um teste local controlado; não migra os dados de produção nem valida Railway, R2, backup,
retenção, alertas ou operação recorrente. O armazenamento continua sendo uma opção local, não
um destino de publicação configurado.
