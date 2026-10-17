# Banco Central do Brasil

Verificado em **17/10/2026**. As consultas SGS em JSON por intervalo funcionaram sem autenticação. Algumas rotas de metadados devolveram 403; isso não impediu obter as observações.

## Crédito e renda

| Uso | Dataset / série | Conceito e recorte | Histórico conferido |
|---|---|---|---|
| VF1 | [SGS 29265](https://dadosabertos.bcb.gov.br/dataset/29265-sgs), crédito/RNDBF | Serviço da dívida com SFN / renda, média móvel trimestral **sem ajuste sazonal**, divulgação mensal; Brasil; % | 175 meses, jan/2012–jul/2026 |
| VF2, contexto | [SGS 21084](https://dadosabertos.bcb.gov.br/dataset/21084-inadimplencia-da-carteira-de-credito---pessoas-fisicas---total), crédito PF total | % da carteira com parcela em atraso superior a 90 dias, livre + direcionado; Brasil | 176 meses, jan/2012–ago/2026 |
| Mínimo, input | SGS **1619**, [identificação oficial](https://www4.bcb.gov.br/pec/series/port/metadados/mg659ap.htm) | Piso nominal nacional no mês, BRL/mês no recorte pós-Real | 178 meses, jan/2012–out/2026 |

Janelas baixadas sem meses repetidos ou ausentes: [VF1](evidence/bcb-29265.json), [VF2](evidence/bcb-21084.json) e [mínimo](evidence/bcb-1619.json). Esse é o horizonte auditado, não o início de toda a história SGS. VF1 não é estoque de dívida nem orçamento de uma família típica; VF2 não mede percentual de pessoas/famílias. A [Peic](../research/phase-4-investigations.md#peiccnc) tem outro universo.

## Obtenção, calendário e direitos

```text
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json&dataInicial=DD/MM/AAAA&dataFinal=DD/MM/AAAA
```

Exemplo conferido:

```sh
curl --fail --get 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.29265/dados' \
  --data-urlencode 'formato=json' \
  --data-urlencode 'dataInicial=01/01/2025' \
  --data-urlencode 'dataFinal=31/03/2025'
```

O [CKAN de VF1](https://dadosabertos.bcb.gov.br/api/3/action/package_show?id=29265-sgs) identifica JSON, CSV e metadados, periodicidade mensal e tempestividade de **até oito semanas**. A resposta consultada termina em jul/2026; o limite solicitado não prova publicação até ele. Seguir o [calendário das notas](https://www.bcb.gov.br/estatisticas/notas_calendario), registrando publicação e coleta separadamente. Para VF2, verificar o mesmo calendário de crédito; não foi estabelecido SLA específico nesta fase.

O metadado de VF2 veio da [busca oficial](https://dadosabertos.bcb.gov.br/api/3/action/package_search?q=21084), pois `package_show` devolveu 403. Ambos declaram **Open Data Commons Open Database License (ODbL)**; identificação e descrição estão nos [extratos preservados](evidence/metadata.json). Cumprir atribuição e termos da licença antes de distribuir bases. A PoC local não comprova atendimento das obrigações de publicação.

O [aviso do portal](https://dadosabertos.bcb.gov.br/) sobre limites desde 26/03/2025 se refere a séries **diárias**. Não aplicar automaticamente limite de dez anos às três séries mensais: a janela desde 2012 foi respondida. Usar intervalos delimitados, timeout, novas tentativas limitadas e reconciliação histórica. Não foi medida quota nem SLA.

## Inputs das derivadas

**Mínimo nominal:** o arquivo legado `mg659ap.htm` identifica a série **1619**; `659` não é um código a inferir do nome do arquivo. O documento é de 2002 e seu calendário em abril não é referência atual.

O JSON usa `01/MM/AAAA` como rótulo mensal. Há R$ 1.302 em abr/2023 e R$ 1.320 em mai/jun/2023, conforme [amostra da mudança](evidence/bcb-min-2023.json). Não aplicar um único valor anual. A [Lei 14.663/2023](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14663.htm) fixa R$ 1.320 desde 1º/05/2023. Registrar vigência normativa por mudança na futura ingestão; esta fase não audita todos os atos desde 2012. Mudança dentro do mês exige convenção explícita antes da derivação.

O recorte inicial usa jan/2012 em diante; não tratar moedas anteriores ao Real como BRL. O endpoint do mínimo não informou licença própria e a busca CKAN por `1619` não encontrou ficha; não transferir a ODbL das séries de crédito por suposição. Confirmar condições antes de redistribuir a base.

**TR2:** SGS `1619` do mês `t`, IBGE `1736/2289` do mesmo mês e de **dez/2025**. Cobertura comum verificada jan/2012–set/2026; observação-base presente. Seguir o [contrato da fase 3](../systems/mvp-indicators.md):

```text
minimum_nominal(t) × inpc_index(2025-12) / inpc_index(t)
```

Índices na base dez/1993 = 100; saída em BRL/mês de dez/2025. Inputs positivos, IDs e versão preservados; ausência bloqueia cálculo. Mínimo de out/2026 não torna conhecido o INPC desse mês. Não substituir por taxa de INPC ou IPCA.

**CV5:** cesta nominal da capital, mínimo nominal do **mesmo mês** e `220 h/mês`. Piso mantém geografia Brasil e é aplicado explicitamente à capital. Obtenção e confronto estão na ficha [Conab/DIEESE](conab-dieese.md#tempo-por-cesta). Não usar TR2 ou salário líquido.

## Revisões e futura ingestão

SGS não entrega vintage/data de publicação por observação. Guardar original, URL, coleta, hash e referência da divulgação. Revisões de renda/crédito podem alterar o passado: reler janela histórica e prever reconciliação completa, com frequência a medir na PoC. Repetição idêntica não é revisão.

Validar objetos `data`/`valor`, primeiro dia do mês, unicidade, ordem, unidade e decimais. Taxas no domínio percentual e mínimo positivo. Rejeitar HTML de bloqueio; não completar mês faltante com zero ou substituir VF1 por série mais recente de outro conceito. VF1 é o candidato de crédito da PoC; VF2 permanece contexto.
