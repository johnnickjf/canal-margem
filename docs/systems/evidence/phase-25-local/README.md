# Ensaio local de publicação — 27/10/2026

Estado: parcial. Não é uma implantação nem evidência de operação recorrente. O PostgreSQL e o
LocalStack usados são os serviços locais de `backend/compose.yaml`.

## Diagnóstico

Antes da intervenção, a geração 1 apontava para a publicação
`179df7c7f057dae586808a642c7b771e99cb72f73f0a951ce0107a6810f1913c`. O alias corrente
respondia HTTP 200, mas a consulta à edição retornava HTTP 503; a listagem do S3 local não
continha buckets. A projeção exigida para ler a edição estava indisponível. Isso não determina
quando nem por que os objetos desapareceram. O Compose não configura persistência durável;
volumes anônimos observados não constituem backup.

Foram criados os buckets locais `margem-raw` e `margem-public`, sem apagar o banco. Depois das
coletas abaixo, 18 das 58 chaves registradas em `raw.object` ainda não estavam no bucket e
`pipeline verify` falhou. A edição antiga e os arquivos históricos ausentes não foram recuperados.

## Coleta e seleção

Com as variáveis de `backend/.env.example`, executaram-se os jobs `run --source ibge` e
`run --source bcb`, ambos com `--from 2025-01-01 --to 2025-12-31`. IBGE: execução
`6880cfa0-038f-4d22-999f-368501f3387b`, lote
`148cae0b1a15c1f288fa760d59a49f6135ab7e5a97dcf346bdf3b3599454b13d`, 109 observações,
zero alterações. BCB: execução `a072d534-7f9d-4ed6-a098-480cbdaa9be2`, lote
`72daa6b0f2df1d4936884f6f668f05a0d638bcd9ab0b6a5f9eb448b7cb204210`, 36 observações,
36 alterações. As 26 chaves distintas associadas à proveniência dessas duas execuções foram
localizadas no bucket; isso não substitui a verificação dos demais objetos históricos.

O [manifesto](publication.json) seleciona somente desemprego (`tr4`, quatro trimestres),
IPCA mensal e em 12 meses (`cv1-monthly`, `cv1-12m`, 12 meses cada) e comprometimento de
renda com dívidas (`vf1`, 12 meses), todos Brasil, 2025. Os demais indicadores não são
considerados disponíveis por este ensaio. Os IDs foram obtidos por junção de
`normalized.member` e `normalized.observation` nos dois lotes; o manifesto registra os
recortes e a justificativa. A [ativação](activation.json) fixa a geração anterior e o motivo.

## Observado

- A primeira edição ativada na geração 2 descreveu incorretamente a série do BCB como juros.
  A repetição da ativação devolveu a mesma geração. A descrição foi corrigida em uma nova
  edição, `b1689197f519510456d527adb4b565fdbf779b5830bf8e51be20852115e33689`,
  ativada na geração 3 com os mesmos recortes.
- A consulta HTTP da edição retornou 200. O build com `MARGEM_API_URL=http://127.0.0.1:8080`
  concluiu e gerou 89 páginas, após corrigir a comparação de timestamps de corte.
- O HTML de `/indicador/desemprego` contém o ID da edição e mostra 5,1% para Brasil,
  01/10/2025 a 31/12/2025, coerente com a observação selecionada no banco. Isso não valida
  visualmente a página nem comprova que o conjunto completo de dados históricos foi recuperado.

## Pendências do primeiro ensaio — 27/10/2026

Recuperar ou justificar os objetos históricos ausentes e verificar hashes; investigar a causa
da perda; ampliar a seleção e testar fontes, revisão, falhas e reconstrução; auditar as telas e
os 15 conceitos; definir e verificar persistência, backup, agendamento, alertas e atualização do
site no ambiente alvo. Essa lista descreve o que faltava naquele primeiro ensaio; os avanços e
as pendências atuais estão registrados abaixo e em [rotas](routes.md), [cobertura](coverage.md)
e [recuperação](recovery.md). Uma edição local não prova publicação externa ou indexação.

## Build isolado — 31/10/2026

Com a API local servindo a geração 6 restaurada, o comando
`MARGEM_API_URL=http://127.0.0.1:8080 pnpm build:publication` executou as checagens e gerou
89 páginas em um novo diretório sob
`.data/publication-builds/`. A consulta anterior e a posterior retornaram a mesma geração e
edição; `ready.json` registrou esses valores. Os HTMLs de auditoria e desemprego continham o
ID da edição, e o segundo continha 5,4%. Sem `MARGEM_API_URL`, o comando falhou antes do
build. Testes controlados cobrem troca de geração, HTML divergente e falhas de build ou API.
O artefato é local; o marcador não publica o site nem comprova que a geração continuará
ativa até uma futura promoção. Gatilho e coordenação de deploy seguem pendentes.

Em ensaio posterior, o primeiro build isolado falhou ao mover arquivos entre `/tmp` e o volume
de saída; não houve marcador. O workspace passou a ser criado no volume do artefato. Na
repetição, um build simultâneo sem dados alterou o snapshot do checkout, enquanto o artefato
isolado manteve a geração 6; suas 40 páginas com nota de publicação tinham o mesmo ID, e o
workspace foi removido. A checagem agora rejeita notas com IDs divergentes em qualquer HTML.

## Resultado final local — 31/10/2026

A última execução de `MARGEM_API_URL=http://127.0.0.1:8080 pnpm build:publication` concluiu
com a geração 6 (`a3788015cca9d1630036f44c07bb46486f6dfaa148b5bf23c1b54ace1b053943`),
89 páginas e `ready.json`. As 40 páginas com nota de publicação continham esse mesmo ID;
não foram detectados IDs divergentes nas notas de publicação e nenhum workspace temporário
ficou no diretório. O HTML de desemprego mostrou 5,4% até junho de 2026. O resultado comprova
o artefato local observado, não uma promoção ou publicação externa.

O artefato passou pela auditoria funcional das 88 rotas (352 combinações) e pela auditoria
axe/overflow (176 combinações), sem problemas detectados. A reconciliação de rotas, metadados,
JSON-LD, links locais e sitemap está detalhada em [rotas](routes.md). A revisão manual foi
representativa; não houve validação com leitor de tela.
