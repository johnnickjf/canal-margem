# Indicadores do MVP — fase 3

## Estado e contrato da entrega

Esta fase fixa a lista de **15 indicadores principais** do primeiro MVP, distribuídos pelas cinco dimensões da [visão do produto](../01-project-vision.md). A hipótese é que esse conjunto permite responder perguntas sobre trabalho, preços, alimentação, moradia, dívidas e distribuição de renda sem começar com centenas de séries.

A seleção atende à [fase 3 do roadmap](../04-roadmap.md#fase-3--definição-do-mvp-de-indicadores). A revisão de **17/10/2026**, autorizada pelo responsável pelo projeto após pesquisa de fontes, inclui cesta básica, tempo de trabalho pelo salário mínimo, insegurança alimentar e moradia. Jornada e inadimplência bancária passam a contexto; dívida bruta fica para uma entrega posterior. Não significa que os dados já foram integrados ou que sua comparabilidade histórica foi comprovada.

O contrato de conclusão desta entrega é: lista entre 10 e 15 conceitos principais, cobertura das cinco dimensões, pergunta compreensível por indicador, medição inicial, justificativa de seleção, limitações, cálculos especificados e passagem explícita para o catálogo da fase 4. Medidas auxiliares e candidatas precisam de estado separado. A evidência necessária é documental. Banco, coleta, engine e páginas de indicadores pertencem às fases seguintes.

Continuidade: o [catálogo da fase 4](../data-sources/README.md) agora identifica tabelas, variáveis, classificações, séries e arquivos, com amostras oficiais e limites observados. As [três investigações](../research/phase-4-investigations.md) têm conclusão documental. Isso não altera esta lista nem significa ingestão implementada; os requisitos de passagem abaixo permanecem referência, com o atendimento e as ressalvas registrados no catálogo.

## Critérios de seleção

Cada indicador precisa responder a uma pergunta da vida material, ter definição explicável e uma fonte institucional identificável. Preferimos resultados agregados já publicados a processamento inicial de microdados. Custo de manutenção ajuda a planejar a integração, mas não substitui relevância: dados anuais e resultados locais são aceitos quando a pergunta os exige. O custo abaixo é uma avaliação de planejamento, não uma medição operacional.

- **Compreensão:** o nome público explica o que está sendo medido; o conceito técnico acompanha a explicação.
- **Relevância:** a lista cobre as cinco dimensões sem transformar PIB ou dívida em resumo do bem-estar.
- **Comparabilidade:** definimos o recorte e os riscos antes de prometer uma série contínua.
- **Manutenção:** IBGE, BCB, ANP, Conab/DIEESE e Fundação João Pinheiro formam o conjunto inicial de fontes. Deflação do salário mínimo e tempo por cesta são os dois cálculos próprios selecionados. Fontes complementares estão no [mapa de fontes](../research/source-map.md).

Não há pontuação ponderada: ela esconderia decisões editoriais atrás de pesos sem validação. A inclusão de cada conceito é justificada na tabela e os principais descartes são registrados adiante.

## Lista oficial da fase 3

Os recortes são nacionais, exceto cesta e tempo por cesta, apresentados **por capital**. “Brasil” respeita a cobertura de cada pesquisa; não significa que o IPCA pesquise todos os municípios nem que a ANP observe todos os postos. Não criar uma cesta nacional pela média das capitais. As chaves abaixo são referências deste documento, não IDs de entidades ou slugs de rotas. Chaves antigas permanecem reservadas nas medidas de contexto e adiadas. `source` e `derived` seguem o [modelo conceitual](data-model.md).

| Chave | Indicador e pergunta de entrada | Medição inicial escolhida | Fonte / tipo | Por que entra e manutenção prevista |
|---|---|---|---|---|
| TR1 | **Rendimento real do trabalho** — O rendimento do trabalho está comprando mais? | Média mensal real habitual de todos os trabalhos, pessoas ocupadas de 14 anos ou mais com rendimento; trimestre civil; R$/mês na base divulgada | IBGE, PNAD Contínua trimestral / `source` | Liga remuneração a poder de compra; agregado oficial, manutenção baixa |
| TR2 | **Salário mínimo real** — O piso nacional ganhou poder de compra? | Mínimo nominal mensal deflacionado pelo INPC geral, em reais de dezembro de 2025; mês civil | Margem, com mínimo nominal do BCB e INPC do IBGE / `derived` | Referência de poder de compra do piso com deflator voltado a famílias assalariadas de menor renda; manutenção média |
| TR4 | **Desemprego** — Quem procura trabalho está conseguindo uma ocupação? | Taxa de desocupação das pessoas de 14 anos ou mais, sobre a força de trabalho; trimestre civil; % | IBGE, PNAD Contínua trimestral / `source` | Porta de entrada conhecida para o mercado de trabalho; agregado oficial, manutenção baixa |
| TR5 | **Informalidade** — Quanto do trabalho ocorre em ocupações informais? | Taxa de informalidade, conforme classificação do IBGE, sobre a população ocupada de 14 anos ou mais; trimestre civil; % | IBGE, PNAD Contínua trimestral / `source` | Complementa desemprego com a forma de inserção no trabalho; agregado oficial, manutenção baixa |
| CV1 | **Inflação ao consumidor** — Quanto subiu a cesta de consumo? | IPCA geral, variação mensal e acumulada em 12 meses; mês civil; % | IBGE, SNIPC/IPCA / `source` | Contextualiza os preços; INPC acompanha a leitura como série complementar de cobertura distinta, manutenção baixa |
| CV2 | **Inflação da alimentação em casa** — A comida de casa ficou mais cara? | IPCA do subgrupo alimentação no domicílio, variação mensal e acumulada em 12 meses; mês civil; % | IBGE, SNIPC/IPCA / `source` | Aproxima inflação de uma despesa cotidiana sem depender de cesta local; manutenção média pelo encadeamento das classificações |
| CV3 | **Preço da gasolina** — Quanto custa um litro no posto? | Preço médio de revenda da gasolina C comum, agregado Brasil publicado pela ANP; semana pesquisada; R$/L nominais | ANP, Levantamento de Preços de Combustíveis / `source` | Introduz preço em moeda e prepara a futura tradução em tempo de trabalho; terceira fonte e arquivos próprios, manutenção média |
| CV4 | **Custo da cesta básica** — Quanto custa a alimentação básica na capital? | Custo da cesta de alimentos definida pela pesquisa, por capital e composição regional; mês civil; R$/cesta nominais | Conab/DIEESE, Pesquisa Nacional da Cesta Básica de Alimentos / `source` | Liga preços a uma compra concreta, preservando diferenças territoriais; manutenção média |
| CV5 | **Tempo de trabalho por cesta no salário mínimo** — Quantas horas equivalentes no piso nacional compram essa cesta? | Custo nominal da cesta da capital dividido pelo mínimo nominal nacional do mesmo mês, multiplicado por 220 h/mês; h/cesta | Margem, com Conab/DIEESE e mínimo nominal do BCB / `derived` | Entrega a primeira tradução em trabalho sem supor uma renda média por hora; manutenção média |
| CV6 | **Ônus excessivo com aluguel urbano** — Quantos domicílios de baixa renda comprometem mais de 30% da renda com aluguel? | Número de domicílios urbanos com renda domiciliar de até três salários mínimos classificados no componente de ônus excessivo com aluguel pela FJP; Brasil; anual; domicílios | Fundação João Pinheiro, Déficit Habitacional / `source` | Introduz pressão da moradia sobre a renda sem confundir com inflação de aluguel; manutenção média |
| VF1 | **Comprometimento da renda com dívidas** — Quanto da renda agregada vai para o serviço da dívida? | Relação entre pagamentos esperados ao SFN e renda mensal das famílias, média móvel trimestral sem ajuste sazonal, conceito RNDBF; divulgação mensal; % | BCB, estatísticas de crédito / `source` | Mede pressão dos pagamentos, distinta do estoque de dívida; série oficial, manutenção baixa |
| QV1 | **Pobreza monetária** — Que parcela das pessoas vive abaixo da linha de renda? | Proporção da população abaixo de US$ 6,85 por pessoa/dia em PPC de 2017, série retrospectiva da SIS 2025; anual; % | IBGE, Síntese de Indicadores Sociais, baseada na PNAD Contínua / `source` | Conecta renda a privação monetária; tabelas anuais e linha versionada, manutenção média |
| QV2 | **Desigualdade de renda** — Como a renda se distribui entre as pessoas? | Índice de Gini do rendimento domiciliar per capita de todas as fontes, incluindo benefícios; anual; escala de 0 a 1 | IBGE, PNAD Contínua anual — Rendimento de todas as fontes / `source` | Impede que a média de renda represente sozinha a distribuição; agregado anual, manutenção baixa |
| QV3 | **Insegurança alimentar** — Que parcela dos domicílios enfrenta restrição de acesso à alimentação? | Proporção de domicílios particulares com algum grau de insegurança alimentar pela EBIA (leve, moderada ou grave); Brasil; referência anual nas edições disponíveis; % de domicílios | IBGE, PNAD Contínua — Segurança Alimentar / `source` | Mede experiência de restrição alimentar além de preço e renda; manutenção média, sem presumir publicação anual contínua |
| EE1 | **PIB por pessoa** — A produção por habitante cresceu em termos reais? | Variação anual em volume do PIB per capita publicada nas Contas Nacionais anuais; % | IBGE, Sistema de Contas Nacionais / `source` | Contexto de produção sem confundir valor corrente e ganho real; tabela anual sujeita a revisões, manutenção baixa |

São **4 indicadores de trabalho e renda, 6 de custo de vida, 1 de vida financeira, 3 de qualidade de vida e 1 de economia e Estado**: 13 conceitos `source` e dois `derived`. Jornada e inadimplência continuam no contexto abaixo, fora dessa contagem. INPC, mínimo nominal e suas medidas auxiliares também não são novos conceitos principais. Custo da cesta e tempo equivalente têm saídas distintas e contam separadamente.

## Recortes, interpretação e limites

### Trabalho e renda

A [PNAD Contínua trimestral](https://www.ibge.gov.br/Estatisticas/Sociais/Trabalho/9173-pesquisa-nacional-por-amostra-de-domicilios-continua-trimestral.html) publica resultados agregados no SIDRA. Selecionamos trimestres civis e séries sem ajuste sazonal para TR1/TR4/TR5 e o contexto de jornada; a comparação inicial será com o mesmo trimestre do ano anterior. Isso reduz sobreposição de períodos e mantém as medidas na mesma referência temporal.

TR1 é média de quem está ocupado e tem rendimento, não renda de toda a população nem salário mediano. TR3 cobre pessoas ocupadas; não fornece automaticamente as horas do universo com rendimento de TR1. **Não dividir TR1 por TR3 para anunciar renda por hora.** Queda do desemprego deve ser lida junto com participação na força de trabalho; informalidade não é sinônimo de ausência de carteira em toda categoria ocupacional. Menos horas pode refletir escolha ou insuficiência de trabalho, portanto TR3 não recebe direção automática de melhora.

O IBGE registra [limitações de resposta durante a pandemia](https://www.ibge.gov.br/estatisticas/sociais/populacao/9173-pesquisa-nacional-por%20amostra-de-domicilios-continua-trimestral.html?t=destaques). O catálogo deverá verificar reponderações, quebras e a base monetária de cada edição. Comparar valores reais exige a mesma base; uma nova base cria a identidade de série prevista no modelo, preservando as edições anteriores.

TR2 usa o [salário mínimo nominal identificado pelo BCB](https://www4.bcb.gov.br/pec/series/port/metadados/mg659ap.htm) e o número-índice do [INPC geral](https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9258-indice-nacional-de-precos-ao-consumidor.html). O INPC cobre famílias com rendimentos de 1 a 5 salários mínimos cuja pessoa de referência é assalariada, nas áreas de cobertura da pesquisa. Por essa pertinência ao público do piso, escolhemos **“salário mínimo real, deflacionado pelo INPC”**. Isso não representa a cesta particular de todo recebedor do mínimo. A especificação anterior com IPCA fica substituída; nenhuma série foi implementada ou publicada. Em execução, trocar deflator exigirá nova identidade de série e método versionado, sem sobrescrever dados.

A página de metadados do mínimo é antiga; a fase 4 precisa confirmar a série vigente e seu histórico em reais. Não alterar o deflator próprio do rendimento real da PNAD (TR1) para fazê-lo coincidir com TR2: são métodos distintos.

### Custo de vida

O [SNIPC/IPCA](https://www.ibge.gov.br/estatisticas-novoportal/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor-amplo.html?=&t=resultados) fornece índice geral e desagregações por grupos e subgrupos. CV1 e CV2 usarão as taxas publicadas; o INPC geral acompanha CV1 como série complementar e fornece o número-índice para TR2. Não emendar IPCA e INPC numa única série: suas coberturas e métodos diferem. Taxa menor ainda pode significar preços subindo. Não somar taxas mensais para obter o acumulado e não representar uma taxa como preço em reais.

CV2 escolhe alimentação **no domicílio**, não o grupo completo alimentação e bebidas. A cobertura geográfica, a cesta e os pesos pertencem ao índice; mudanças de ponderação e classificação precisam acompanhar o histórico. Esses índices não medem a inflação particular de cada família nem o valor de uma cesta básica.

A [série histórica da ANP](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/serie-historica-de-precos-de-combustiveis) disponibiliza arquivos da pesquisa semanal. CV3 exige o agregado nacional oficial e a semana de referência completa. Não calcular “preço Brasil” pela média simples dos municípios ou postos. Mudanças de cobertura e semanas sem pesquisa devem permanecer visíveis; não preencher lacunas nem tratar a gasolina aditivada como comum. O catálogo precisa localizar o arquivo agregado e sua metodologia de ponderação, além dos dados por revendedor.

CV4 usa os resultados mensais da [Conab/DIEESE](https://www.dieese.org.br/analisecestabasica/2025/202512cestabasica/index.html?page=19), que identificam capitais com coleta iniciada em abril de 2025. Os períodos anteriores disponíveis devem ser conferidos por capital, sem supor uma retrospectiva comum às 27. A composição regional da cesta exige método identificado. Uma capital não representa seu estado ou o país; variação do custo da cesta não substitui IPCA de alimentação.

CV5 adota a referência de tempo pelo salário mínimo da pesquisa, conforme o contrato abaixo. Não anuncia renda por hora observada, jornada real do usuário ou rendimento líquido. Cesta e equivalente em trabalho devem exibir juntos capital, mês e referência ao piso nacional.

CV6 usa o componente de aluguel da pesquisa de [Déficit Habitacional da FJP](https://fjp.mg.gov.br/deficit-habitacional-recua-em-minas-gerais/), com universo de renda definido na [documentação metodológica](https://repositorio.fjp.mg.gov.br/server/api/core/bitstreams/55f51816-280a-4ca6-94b0-04d1cb58d0c8/content). A saída inicial é contagem, não percentual de todos os locatários nem parcela média da renda gasta com moradia. Não confundir participação desse componente no déficit com taxa de ônus na população. A fase 4 deve fixar edição, universo e eventuais exclusões da metodologia; a série comparável não será presumida a partir de relatórios de edições distintas.

### Vida financeira

O BCB distingue [comprometimento da renda e endividamento](https://dadosabertos.bcb.gov.br/dataset/29265-sgs): o primeiro relaciona serviço da dívida e renda mensal, em média móvel trimestral; o segundo compara estoque de dívida e renda acumulada. Selecionamos o comprometimento sem ajuste sazonal e com denominador RNDBF, incluindo o serviço total da dívida no SFN. Outras versões, como a que exclui financiamento imobiliário, são séries diferentes. A divulgação é mensal, mas sua janela de cálculo deve ser preservada, não tratada como um único mês independente.

A [inadimplência a pessoas físicas](https://dadosabertos.bcb.gov.br/dataset/21084-inadimplencia-da-carteira-de-credito---pessoas-fisicas---total) mede percentual da carteira com atraso superior a 90 dias, incluindo crédito livre e direcionado. Não mede percentual de pessoas negativadas nem inclui toda dívida contraída fora do SFN. VF1 e VF2 não descrevem o orçamento de uma família específica. Revisões do crédito precisam ser preservadas; melhora de uma razão pode decorrer também de mudança no denominador ou na composição da carteira.

### Qualidade de vida

A [Síntese de Indicadores Sociais](https://www.ibge.gov.br/estatisticas/sociais/populacao/9221-sintese-de-indicadores-sociais.html) publica indicadores anuais de pobreza monetária. Para QV1, fixamos a linha da edição 2025: [US$ 6,85/dia em PPC de 2017](https://educa.ibge.gov.br/jovens/materias-especiais/23114-sintese-de-indicadores-sociais-trabalho-padrao-de-vida-e-distribuicao-de-rendimentos-no-brasil.html). Essa é a definição escolhida para a série, não uma afirmação de que seja a linha internacional mais recente. Mudança de linha ou de PPC exige outra série e, para comparação, retrospectiva homogênea. Não converter dólares PPC pela cotação comercial do dia.

QV2 usa o [Gini do rendimento domiciliar per capita da PNAD anual](https://www.ibge.gov.br/estatisticas/sociais/trabalho/17270-pnad-continua.html?edicao=43173&t=resultados), não Gini apenas do trabalho nem distribuição patrimonial. Manter todas as fontes de rendimento e a mesma regra de inclusão de benefícios ao comparar anos. Menor Gini indica menor desigualdade nessa medida; não prova que todos ficaram mais ricos. Pobreza monetária e desigualdade não substituem indicadores de saúde, educação ou saneamento.

QV3 usa o [suplemento Segurança Alimentar](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102212_informativo.pdf) e a classificação [EBIA](https://www.ibge.gov.br/comunicados/44778-inclusao-da-variavel-sd17001-nos-microdados-da-pnad-continua-seguranca-alimentar-2024). O valor principal é algum grau de insegurança, acompanhado dos recortes leve, moderada e grave, sem contar cada grau como novo indicador. Domicílios são o denominador, não pessoas. Não chamar toda insegurança alimentar de fome. Usar o agregado publicado, sem somar percentuais arredondados. Não emendar PNAD, POF e PNAD Contínua sem avaliação metodológica nem preencher anos sem edição.

### Economia e Estado

EE1 usa a variação em volume por pessoa das [Contas Nacionais anuais](https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9052-sistemade-contas-nacionais-brasil.html). A primeira medida pública será a taxa anual real, sem inventar um nível monetário em preços constantes a partir de valores correntes. Usar uma única edição coerente de produção e população e preservar revisões; não misturar estimativas trimestrais recentes com a série anual sem outro contrato. PIB por pessoa não é rendimento recebido pelas famílias.

EE2 (dívida bruta) foi adiado para priorizar alimentação e moradia; não foi considerado irrelevante. PIB por pessoa permanece como contexto de produção na dimensão Economia e Estado. Investimento e ação do Estado precisam de perguntas e recortes próprios antes de ampliar essa dimensão.

## Contrato do cálculo de salário mínimo real

TR2 será uma derivada Margem com dataset interno e `source_series_id: null`, preservando observações externas como inputs, conforme [as regras de derivação](data-model.md#indicadores-derivados).

```text
minimum_real(t, b) = minimum_nominal(t) × inpc_index(b) / inpc_index(t)
b = dezembro de 2025
saída = BRL/mês a preços de dezembro de 2025
```

O mínimo nominal e o índice corrente precisam corresponder ao mesmo mês civil e agregado Brasil. O índice-base é um parâmetro temporal explícito, com observação de dezembro de 2025 preservada como input; não é uma junção acidental de períodos distintos. O método fixa essa transformação de base, a versão do cálculo, a precisão decimal e os IDs das três observações. Não usar taxa acumulada como se fosse número-índice.

O cálculo exige mínimo nominal positivo e índices positivos na mesma base de índice. Input ausente, unidade incompatível ou quebra sem equivalência impede resultado, com motivo registrado; não preencher com zero. Só há saída para meses com INPC publicado: mínimo nominal já conhecido não torna conhecido o poder de compra do mês corrente. Revisar qualquer input exige nova materialização rastreável, preservando a anterior.

A base monetária ficará fixa até uma mudança de método versionada. A série inicial terá início pretendido em janeiro de 2012, alinhado ao horizonte desejado para o MVP; a fase 4 precisa confirmar a cobertura efetiva. A base é uma escolha de apresentação do poder de compra, não previsão de preços. A [engine da fase 8](indicator-engine.md) fixa aritmética exata e arredondamento half-even da saída em até 12 casas decimais.

## Contrato do tempo de trabalho por cesta

CV5 será uma derivada Margem com dataset interno e `source_series_id: null`. A [metodologia do DIEESE](https://www.dieese.org.br/metodologia/metodologiaCestaBasica2016.pdf) usa mínimo nominal e referência de 220 horas mensais. Os resultados publicados de tempo servem para confronto do cálculo; não são outra entrada a ser calculada novamente.

```text
hours_per_basket(c, t) = basket_nominal(c, t) / minimum_nominal(Brasil, t) × 220
c = capital da pesquisa
t = mês civil idêntico nos dois inputs
saída = h/cesta, na referência do salário mínimo nacional
```

Os inputs são o custo nominal em BRL/cesta e o mínimo nominal em BRL/mês; o parâmetro é `reference_monthly_hours: 220`. Essa referência não é a média observada em TR3 nem uma afirmação sobre a jornada de cada trabalhador. Não usar o mínimo real TR2, salário líquido ou rendimento médio TR1 nessa fórmula.

O método deve registrar a **aplicação territorial do piso nacional à capital** como transformação explícita: input do mínimo mantém geografia Brasil; cesta e saída mantêm a capital. Essa exceção versionada à igualdade territorial padrão do modelo não autoriza usar renda média nacional para representar renda local. Não criar uma observação de salário local fictícia.

Custo não negativo, mínimo estritamente positivo, mesma moeda e mesmo mês são condições de cálculo. Ausência de input, período parcial não compatível ou quebra não resolvida impede saída numérica; zero publicado para o custo continua distinto de ausência. Preservar IDs de inputs, composição da cesta, parâmetro 220, método, versão e precisão. Revisar o custo ou o mínimo exige nova materialização; mudar a referência de horas exige nova versão e série quando alterar a identidade semântica.

A [engine da fase 8](indicator-engine.md) implementa a fórmula e confronta o tempo divulgado pelo DIEESE com tolerância de um minuto, bloqueando divergências maiores. A primeira entrega de tempo de trabalho é CV5; tempo por gasolina permanece uma expansão posterior, sem bloquear a cesta por depender de outra renda/hora.

## História e comparação pretendidas

O horizonte desejado é de **2012 ao último período disponível em cada fonte**, quando houver histórico comparável. É uma meta do catálogo, não uma condição para incluir um conceito nem uma cobertura já validada. Cesta por capital, segurança alimentar e moradia podem começar depois ou ter intervalos sem divulgação. Uma série com histórico menor deve declarar seu começo efetivo; nunca prolongar dados por imputação para alinhar gráficos.

Trimestres civis, semanas, janelas móveis e anos mantêm frequências e períodos distintos. Séries anuais não serão repetidas em todos os meses. Comparações de taxas usam pontos percentuais quando medem diferença entre percentuais; variação relativa é outra medida. Gini fica em escala 0–1. Não escolher automaticamente um período “comum” só pelo rótulo do ano ou mês.

Para taxas e índices de preços, queda não equivale universalmente a melhora do bem-estar. A interpretação pública deve mostrar renda, emprego e preços em conjunto, sem score político ou atribuição causal pela coincidência temporal. A [camada de comparação](../04-roadmap.md#fase-16--comparador) definirá estabilidade, incerteza e evidência necessária antes de usar classificações.

## Medidas de contexto e entradas auxiliares

São obrigatórias no catálogo da fase 4 para interpretar ou calcular os indicadores principais, mas não contam como novos cartões de entrada. Sua integração e apresentação deverão acompanhar os conceitos a que dão suporte; não são dados já implementados.

| Medida | Contrato inicial e finalidade | Fonte e estado |
|---|---|---|
| TR3 — Jornada habitual | Média de horas habitualmente trabalhadas por semana em todos os trabalhos, pessoas ocupadas de 14 anos ou mais; trimestre civil; h/semana. Contexto de TR1/TR4, sem direção automática de melhora | IBGE, PNAD trimestral; retirada apenas da lista principal |
| Participação na força de trabalho | Percentual de pessoas na força de trabalho sobre população de 14 anos ou mais; trimestre civil. Acompanhar TR4 para evitar interpretar saídas da força como obtenção de emprego | IBGE, PNAD trimestral; incluir no catálogo |
| Subutilização da força de trabalho | Taxa composta oficial com denominador da força de trabalho ampliada; trimestre civil; %. Contextualizar desocupação, insuficiência de horas e força potencial; não somar taxas distintas | IBGE, PNAD trimestral; incluir no catálogo |
| VF2 — Inadimplência a pessoas físicas | Percentual da carteira de crédito, livre e direcionado, com parcela em atraso superior a 90 dias; mensal; %. Contexto de VF1, sem representar percentual de famílias | BCB, crédito; retirada apenas da lista principal |
| INPC geral | Taxas publicadas como complemento de CV1 e número-índice como input de TR2; Brasil; mensal | IBGE, SNIPC/INPC; obrigatório para TR2 |
| Mínimo nominal | BRL/mês, piso nacional no mês civil; input comum de TR2 e CV5, com vigência preservada | BCB; confirmar série e convenção temporal no catálogo |
| Graus de insegurança alimentar | Leve, moderada e grave no mesmo universo e edição de QV3; % de domicílios | IBGE, PNAD Segurança Alimentar; recortes de QV3 |

O [quadro retrospectivo da PNAD](https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Principais_destaques_PNAD_continua/2012_2024/PNAD_continua_retrospectiva_2012_2024.pdf) identifica participação e subutilização. A fase 4 deve localizar os agregados trimestrais exatos, com universos e revisões, antes da implementação. O teto de 15 organiza os conceitos principais, não limita os inputs e contextos necessários à interpretação correta.

## Candidatos adiados e consequências

| Candidato | Motivo para adiar | Condição para incorporar |
|---|---|---|
| Rendimento médio por hora | Depende da identificação de agregado de cobertura adequada; não é necessário para CV5 | Investigar na fase 4 a publicação oficial e suas alternativas antes de assumir necessidade de microdados; não dividir TR1 por TR3 |
| Tempo de trabalho por gasolina | CV5 já oferece a primeira leitura em trabalho; preço semanal da gasolina exige alinhamento próprio | Definir referência salarial, período e agregação versionada; não juntar semana e trimestre pelo rótulo |
| Energia e outras medidas de habitação | CV6 cobre pressão de aluguel em um universo restrito, não todas as condições de moradia | Escolher pergunta específica e consultar ANEEL/FJP; não chamar inflação de acessibilidade |
| Endividamento e atraso declarado das famílias | Estoque/renda do BCB e respostas das famílias na Peic são conceitos distintos de VF1/VF2 | Avaliar CNC/Peic na fase 4, incluindo amostra, acesso e direitos de uso; não descartar como duplicata da carteira bancária |
| Extrema pobreza | Muito próxima de QV1 para a primeira navegação; outra linha não conta como nova dimensão | Acrescentar como recorte com linha e PPC versionadas |
| EE2 — Dívida bruta do governo geral | Cede prioridade a alimentação e moradia na primeira experiência | Preservar a referência de DBGG do BCB; incorporar com contexto de custo, prazo e denominador, sem score automático |
| Investimento e investimento público | FBCF total e gasto público são conceitos diferentes | Mapear Tesouro/Siconfi e IBGE agora; escolher conceito, cobertura institucional e base contábil antes de implementar |
| Saúde, educação e saneamento | Faltam medidas e perguntas específicas, não relevância social | Manter DATASUS, Inep e SINISA no mapa de fontes; escolher indicadores em expansão posterior |

Cesta, tempo por cesta, insegurança alimentar e ônus de aluguel deixaram a condição de adiados e passam ao escopo principal. CV5 mantém o requisito de tradução de preço em trabalho no MVP, com referência salarial e geográfica explícita. A execução continua nas fases de ingestão, engine e interface. Dados de serviços públicos e renda/hora observada ainda limitam as perguntas que a primeira versão conseguirá responder.

## Passagem para o catálogo e a PoC

A [fase 4](../04-roadmap.md#fase-4--catálogo-de-fontes) deve produzir uma ficha verificável para **cada um dos 15 conceitos principais**, seus contextos obrigatórios e os inputs de TR2/CV5. O [diretório de fontes](../data-sources/README.md) descreve os campos obrigatórios. O [mapa de fontes](../research/source-map.md) registra fontes selecionadas e investigações complementares. Links de produto não substituem identificação de tabela, variável, classificação, série, arquivo e método.

Antes de liberar uma série para a PoC, o catálogo precisa demonstrar:

1. fonte, dataset, código externo e caminho de obtenção do recorte exato;
2. unidade, universo, território, período, frequência, ajuste sazonal e base monetária;
3. histórico efetivamente disponível, lacunas, quebras, revisões e retrospectivas;
4. calendário de publicação, atraso esperado, licença e restrições de acesso;
5. amostra preservável de resposta ou arquivo, com data da verificação;
6. para TR2, mínimo nominal e INPC corrente/base; para CV5, custo da cesta por capital e mês, mínimo nominal, referência de horas e aplicação territorial do piso;
7. para CV6/QV3, edição, universo e cobertura histórica efetiva, sem percentuais com denominador implícito ou interpolação de anos;
8. investigação de rendimento médio por hora, Peic e inflação por faixa de renda, com conclusão sobre adequação, acesso e limites, sem inclusão automática nos 15 principais.

Falha de acesso não autoriza trocar fonte ou recorte silenciosamente: documentar a limitação e revisar a seleção se ela inviabilizar um conceito. A fase 3 fixa o escopo, não certifica futuras integrações.

Para a [PoC da fase 5](../04-roadmap.md#fase-5--prova-de-conceito-de-ingestão), o conjunto recomendado é TR4, CV1 e VF1: três indicadores e quatro séries externas de IBGE e BCB (incluindo as duas medidas de CV1), cobrindo trimestre, mês e indicador com janela móvel. VF1 substitui a antiga escolha VF2 porque permanece principal. A PoC deve provar o pipeline e revisões antes de ampliar para ANP, Conab/DIEESE, FJP e cálculos. A ordem não reduz a obrigação de integrar o restante do escopo revisado.

## Integração com o produto e SEO

As cinco dimensões são `Theme` do domínio estatístico e não substituem os 12 temas editoriais de [temas.json](../../src/content/temas.json). Os rótulos e perguntas deste documento orientam o shell futuro; não criam rotas ou alteram a navegação editorial atual.

Ao implementar páginas públicas, manter a [regra permanente de SEO e descoberta por IA](../../AGENTS.md): conteúdo principal e fontes em HTML acessível, títulos e descrições próprios, canonical correto, links rastreáveis, dados estruturados coerentes, sitemap e `robots.txt`. Esta entrega documental não comprova publicação nem indexação externa.

## Evidências e limites da seleção

As fontes oficiais vinculadas nas seções anteriores sustentam a existência e os conceitos gerais das pesquisas, índices e séries. A seleção de recortes, horizonte desejado, INPC como deflator de TR2, base de dezembro de 2025 e ordem da PoC são decisões desta fase. A referência de 220 horas de CV5 segue o método do DIEESE; a implementação Margem preservará a linhagem dos próprios inputs.

A consulta de 17/10/2026 usou páginas oficiais de produto, catálogos e publicações. Algumas URLs diretas do IBGE e do DIEESE não entregaram o conteúdo completo pela ferramenta; resultados de busca e PDFs forneceram evidência documental, sem comprovar acesso programático aos dados. O metadado do mínimo nominal está datado de 2002. Não houve download de séries, validação de endpoint de dados, inventário exaustivo de quebras ou comprovação de atualização. Esses limites precisam ser resolvidos na fase 4 antes de alegar viabilidade operacional.

A auditoria de 17/10/2026 confirmou 15 chaves principais únicas, cobertura das cinco dimensões, 13 conceitos `source` e dois `derived`, perguntas em todas as linhas e separação das medidas de contexto. Foram conferidos os dois contratos de cálculo e 173 links locais, incluindo 15 fragmentos Markdown, sem referências ausentes. A revisão dos pontos de continuidade confirmou a nova seleção no README, índices, roadmap e orientações para a fase 4.

Exemplos sintéticos em aritmética decimal confirmaram a direção da deflação (`1000 × 120 / 100 = 1200`), igualdade na própria base e tempo por cesta (`750 / 1500 × 220 = 110 h`), incluindo custo zero distinto de ausência. Isso confere as fórmulas documentadas, sem constituir uma engine ou validação com dados reais.

`pnpm build` passou: Biome sem alterações, `astro check` com zero erros, avisos ou sugestões, e build estático de 38 páginas. `git diff --check` passou. Não foram executados testes de navegador, pois só houve alteração documental. Nenhuma dessas verificações comprova ingestão, publicação ou indexação externa.
