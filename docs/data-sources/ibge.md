# IBGE

Verificado em **17/10/2026**. Atende TR1, TR4, TR5, CV1, CV2, QV1, QV2, QV3 e EE1; fornece INPC para TR2 e os contextos de trabalho. A investigação de renda/hora está [registrada separadamente](../research/phase-4-investigations.md#rendimento-por-hora-do-ibge).

## Acesso e atualização

A [API de agregados v3](https://servicodados.ibge.gov.br/api/docs/agregados?versao=3) oferece metadados, períodos e observações JSON. As consultas realizadas não exigiram credenciais. O recorte inicial é Brasil, `N1[all]`. Enviar explicitamente as classificações abaixo; uma categoria inválida pode retornar `...` com HTTP 200, comportamento observado durante a verificação de QV3 e corrigido na amostra final.

```text
GET https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/metadados
GET https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/periodos
GET https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/periodos/{periodos}/variaveis/{variaveis}?localidades=N1[all]&classificacao={classificacoes}
```

`all` e listas separadas por `|` foram usados nas [consultas preservadas](evidence/manifest.json). Valores decimais vêm como texto; período `201201` significa 2012T1 na PNADCT e jan/2012 no SNIPC. Interpretar pelo dataset, não pelo tamanho do código. A identidade inclui tabela, variável, geografia, classificação, unidade, método e edição.

Algumas respostas de taxas trazem `unidade: ""`, inclusive CV1, taxas do INPC e acumulados de CV2. Os metadados das mesmas tabelas/variáveis identificam `%`. A futura normalização precisa resolver essa ausência pelo metadado preservado e pelo contrato exato, sem inventar unidade pelo valor ou rejeitar uma taxa oficial apenas por esse campo vazio. Unidade conflitante continua impedindo aceitação.

Não foi medida quota ou SLA. A futura coleta deve limitar consultas por recorte/período, usar timeout e novas tentativas limitadas para 429/5xx, validar conteúdo e reutilizar metadados. O portal institucional devolveu bloqueios em algumas consultas desta sessão; API e FTP funcionaram. Resposta 200 não basta para aceitar um lote.

O [FTP](https://ftp.ibge.gov.br/) identifica os arquivos como públicos e não exigiu autenticação. Citar IBGE, pesquisa, tabela e edição. Os endpoints não informam uma licença específica por série; não atribuir Creative Commons por suposição. Preservar as condições da publicação e conferir redistribuição antes de publicar bases. O [termo do portal](https://www.ibge.gov.br/acesso-informacao/acoes-e-programas/politica-de-privacidade.html) não é licença por dataset.

Usar o [calendário oficial](https://www.ibge.gov.br/calendario-de-divulgacoes-novoportal.html). Para planejamento: SNIPC sai no mês seguinte; PNAD trimestral tem defasagem de semanas; PNAD anual, suplementos, SIS e SCN seguem edições próprias. Não há SLA medido nesta fase. `published_at` vem da divulgação; `retrieved_at`, da coleta. A data do período não é a data de publicação.

## Trabalho trimestral

Dataset PNAD Contínua trimestral; pessoas de **14 anos ou mais**, Brasil, sem ajuste sazonal. Foram conferidos 58 trimestres, 2012T1–2026T2, exceto informalidade: 43 trimestres, 2015T4–2026T2.

| Uso | Tabela / variável / classificação | Unidade e universo | Amostra |
|---|---|---|---|
| TR1 | [6472](https://sidra.ibge.gov.br/tabela/6472), `5933`, sem classificação | R$/mês; real habitual de todos os trabalhos, ocupados com rendimento | [Resposta](evidence/ibge-tr1.json) |
| TR4 | [4099](https://sidra.ibge.gov.br/tabela/4099), `4099`, sem classificação | %; desocupados / força de trabalho | [Resposta](evidence/ibge-tr4.json) |
| TR5 | [8529](https://sidra.ibge.gov.br/tabela/8529), `12466`, sem classificação | %; informais / ocupados | [Resposta](evidence/ibge-tr5.json) |
| TR3 | [6371](https://sidra.ibge.gov.br/tabela/6371), `8190`, `2[6794]` = sexo total | h/semana; habitual, todos os trabalhos | [Resposta](evidence/ibge-tr3.json) |
| Participação | [4093](https://sidra.ibge.gov.br/tabela/4093), `4096`, `2[6794]` | %; força de trabalho / pessoas de 14+ | [Resposta](evidence/ibge-participation.json) |
| Subutilização | [4099](https://sidra.ibge.gov.br/tabela/4099), `4118` | %; taxa composta sobre força ampliada | [Resposta](evidence/ibge-underutilization.json) |

Consulta reproduzível da PoC:

```sh
curl --fail --get 'https://servicodados.ibge.gov.br/api/v3/agregados/4099/periodos/202501/variaveis/4099' \
  --data-urlencode 'localidades=N1[all]'
```

Não substituir pela tabela `6381`, de trimestres **móveis**. A tabela específica de informalidade começa em 2015T4, mesmo havendo outras variáveis desde 2012 nas tabelas gerais. Não estender artificialmente esse histórico.

TR1 tem base real da divulgação. O JSON sozinho não fixa a base monetária: antes de publicar, capturar a nota de deflação e o período-base da edição. Não rotular como reais de dez/2025 ou trocar o deflator da PNAD por INPC. Uma nova base muda a identidade semântica e exige preservar a anterior.

A [reponderação de 2025](https://www.ibge.gov.br/comunicados/44067-pnad-continua-reponderacao-em-2025) incorpora projeções apoiadas no Censo 2022; o [painel oficial](https://painel.ibge.gov.br/saibamais/) registra atualização do mercado de trabalho em 15/08/2025. Comparar retrospectivas e preservar pesos/edições. A pandemia afetou coleta e resposta. A comparação inicial é com o mesmo trimestre do ano anterior. Não somar taxas nem dividir TR1 por TR3 para produzir renda/hora.

## Preços e INPC

Dataset SNIPC; mês civil, Brasil oficial, sem ajuste sazonal. A cobertura das áreas do índice não significa observar todos os municípios. IPCA e INPC têm populações-alvo e pesos distintos.

| Uso | Tabela / variável / classificação | Histórico numérico retornado | Amostra |
|---|---|---|---|
| CV1 mensal / 12 meses | [1737](https://sidra.ibge.gov.br/tabela/1737), `63` / `2265` | Jan/1980–set/2026 / dez/1980–set/2026 | [Resposta](evidence/ibge-cv1.json) |
| CV2 anterior, mensal / 12 meses | [1419](https://sidra.ibge.gov.br/tabela/1419), `63,2265`, `315[7171]` | Jan/2012–dez/2019 / dez/2012–dez/2019 | [Resposta](evidence/ibge-cv2-old.json) |
| CV2 atual, mensal / 12 meses | [7060](https://sidra.ibge.gov.br/tabela/7060), `63,2265`, `315[7171]` | Jan/2020–set/2026 / dez/2020–set/2026 | [Resposta](evidence/ibge-cv2.json) |
| INPC número-índice | [1736](https://sidra.ibge.gov.br/tabela/1736), `2289` | Mar/1979–set/2026; dez/1993 = 100 | [Resposta](evidence/ibge-inpc.json) |
| INPC mensal / 12 meses | `1736`, `44` / `2292` | Abr/1979–set/2026 / mar/1980–set/2026 | Mesmo arquivo, variáveis separadas |

CV2 usa **11.Alimentação no domicílio**, categoria `7171`, e não alimentação e bebidas (`7170`). A entrada da POF 2017–2018 em 2020 altera a ponderação. Mesmo código de categoria em duas tabelas não prova continuidade: preservar segmentos, edição e notas do [SNIPC](https://www.ibge.gov.br/estatisticas-novoportal/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor-amplo.html?=&t=resultados). Os 11 primeiros meses de cada segmento retornam `...` em 12 meses. Não reconstruir esses acumulados nesta fase nem somar taxas mensais. Encadeamento posterior exige método e validação na engine.

TR2 precisa do **número-índice** `2289`. Dez/2025 está presente na mesma base dos meses correntes. A interseção com SGS `1619` tem 177 meses, jan/2012–set/2026. A base do índice (dez/1993 = 100) e a base monetária da saída (dez/2025) são distintas. Índices e mínimo precisam ser positivos; calcular apenas onde os três inputs existirem.

## Pobreza, Gini e segurança alimentar

**QV1:** [SIS 2025, ZIP oficial](https://ftp.ibge.gov.br/Indicadores_Sociais/Sintese_de_Indicadores_Sociais/Sintese_de_Indicadores_Sociais_2025/Tabelas/xls/2_Distribuicao_Renda_xls.zip), membro `Tabela 2.18 (Pobr_Geo).xls`. Abas anuais `2012`–`2024`, Brasil em A7, linha de pobreza em E4 e percentual em **E7**. Abas `AAAA (CV)` contêm coeficientes de variação. Coluna C é outra linha; B é população em milhares. Unidade %, pessoas com menos de **US$ 6,85/dia, PPC 2017**, incluindo benefícios.

A [extração](evidence/files.json) preserva os 13 valores nacionais e notas: PNAD Contínua acumulada de primeiras visitas; exclusão de pensionistas, empregados domésticos e parentes destes conforme a nota da tabela. Manter população-alvo e regras da edição. O dataset oferece Brasil, regiões, UF e RM; o recorte escolhido é Brasil. Referência até 2024, publicação em 2025. Novas edições têm calendário e eventuais revisões próprios; outra linha/PPC cria outra série. Não atualizar por cotação do dólar nem misturar anuários. O [diretório de tabelas](https://ftp.ibge.gov.br/Indicadores_Sociais/Sintese_de_Indicadores_Sociais/Sintese_de_Indicadores_Sociais_2025/Tabelas/) identifica os arquivos; validar nomes e cabeçalhos em cada edição.

**QV2:** [7435](https://sidra.ibge.gov.br/tabela/7435), `10681`, Brasil, sem classificação; PNAD Contínua anual — Rendimento de todas as fontes. Índice de Gini domiciliar per capita, **0–1**, incluindo benefícios. A [resposta](evidence/ibge-qv2.json) tem 14 anos, 2012–2025. Não usar Gini do trabalho ou sem transferências. Registrar edição, visitas e reponderação; consultar notas para a pandemia. A API não fornece todos os vintages anteriores.

**QV3:** [9552](https://sidra.ibge.gov.br/tabela/9552), `9784` (distribuição percentual dos **domicílios**), `1[6795]` (situação total), classificação `12404`:

| Categoria | Medida | 2023 | 2024 |
|---|---|---|---|
| `109099` | Algum grau de insegurança, principal | 27,6% | 24,2% |
| `109100` | Leve | 18,2% | 16,4% |
| `109101` | Moderada | 5,3% | 4,5% |
| `109102` | Grave | 4,1% | 3,2% |

Valores da [resposta preservada](evidence/ibge-qv3.json). A consulta confirma apenas **2023 e 2024**, com Brasil, regiões e UF disponíveis. Universo: domicílios particulares permanentes, EBIA, conforme a [publicação de 2024](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102212_informativo.pdf). As variáveis `10114/10117` são de moradores e não atendem esse cartão. Em 2024, graus arredondados somam 24,1%, mas o total oficial é 24,2%: conservar `109099`.

Referência anual não implica publicação contínua. Não emendar PNAD antiga, POF e PNAD Contínua nem interpolar anos. Preservar questionário, denominador e edição. Insegurança leve não é sinônimo de fome.

## PIB por pessoa

[6784](https://sidra.ibge.gov.br/tabela/6784), **`9814`**, Brasil, sem classificação; SCN anual, % de variação anual **em volume** do PIB per capita. A [resposta](evidence/ibge-ee1.json) tem 28 anos, 1996–2023. `9812` é valor corrente e não atende EE1.

Preservar a mesma edição de produção/população, revisões anuais e mudanças de referência. O último ano desta tabela não é o último PIB divulgado em outros produtos. Não preencher 2024/2025 com contas trimestrais ou municipais. A defasagem é maior que nos indicadores conjunturais; seguir calendário do SCN e revisar a retrospectiva como um conjunto.

## Futura ingestão

Guardar corpo original, URL, recortes, coleta, hash e notas. Os [metadados](evidence/metadata.json) são extratos oficiais identificados, sem constituir schema de ingestão. Validar IDs, frequência, unidades, cardinalidade, duplicatas, categorias e símbolos SIDRA. Taxas negativas de inflação são válidas; ausência não vira zero. Preservar base de rendimentos e mudanças históricas conforme [modelo](../systems/data-model.md) e [operações](../systems/data-operations.md). Acesso pontual comprovado não comprova execução recorrente.
