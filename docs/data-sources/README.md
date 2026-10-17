# Catálogo de fontes — fase 4

O catálogo identifica a obtenção dos **15 indicadores principais**, seus contextos e inputs da [seleção do MVP](../systems/mvp-indicators.md). Verificação em **17/10/2026**, com leitura de respostas JSON, planilhas e publicações oficiais. Esta entrega é documental, com amostras reais; não implementa coleta recorrente, banco, engine ou páginas.

## Fichas e evidências

| Fonte | Cobertura | Ficha |
|---|---|---|
| IBGE | Trabalho, preços, INPC, pobreza, Gini, insegurança alimentar e PIB por pessoa | [ibge.md](ibge.md) |
| Banco Central | Comprometimento da renda, inadimplência PF e mínimo nominal | [bcb.md](bcb.md) |
| ANP | Gasolina comum, Brasil semanal | [anp.md](anp.md) |
| Conab/DIEESE | Cesta por capital e confronto do tempo de trabalho | [conab-dieese.md](conab-dieese.md) |
| Fundação João Pinheiro | Ônus excessivo com aluguel urbano | [fjp.md](fjp.md) |
| IBGE, CNC e Ipea | Renda/hora, Peic e inflação por renda | [Conclusões das investigações](../research/phase-4-investigations.md) |
| Todas | Amostras e proveniência | [Evidências](evidence/README.md) |

Contrato de conclusão: principais, contextos e inputs têm recortes e obtenção identificados; as três investigações têm conclusão; amostras e limites de acesso, método e cobertura ficam explícitos; TR4, CV1 e VF1 têm respostas conferidas para orientar a PoC. A evidência é de catálogo e acesso pontual, sem certificação de integração ou operação.

## Matriz dos indicadores principais

`t`, `v` e `c` são tabela, variável e classificação do IBGE. As consultas completas estão nas fichas e no [manifesto](evidence/manifest.json). Histórico abaixo significa cobertura **observada**, com as limitações das fichas; não promete continuidade metodológica.

| Chave | Fonte → dataset → série ou recorte | Frequência / geografia / unidade | Histórico conferido | Pipeline necessário |
|---|---|---|---|---|
| TR1 | [IBGE](ibge.md#trabalho-trimestral) → PNADCT → `t6472/v5933` | Trimestre civil; Brasil; BRL/mês na base divulgada | 2012T1–2026T2 | JSON; base monetária e reponderações |
| TR2 | [Margem](bcb.md#inputs-das-derivadas) → mínimo real → SGS `1619` + IBGE `t1736/v2289` corrente e dez/2025 | Mês; Brasil; BRL/mês de dez/2025 | Inputs comuns jan/2012–set/2026; base presente | Junção mensal e deflação na engine |
| TR4 | [IBGE](ibge.md#trabalho-trimestral) → PNADCT → `t4099/v4099` | Trimestre civil; Brasil; % da força de trabalho | 2012T1–2026T2 | JSON; candidato à PoC |
| TR5 | [IBGE](ibge.md#trabalho-trimestral) → PNADCT → `t8529/v12466` | Trimestre civil; Brasil; % dos ocupados | **2015T4**–2026T2 | JSON; início efetivo |
| CV1 | [IBGE](ibge.md#preços-e-inpc) → SNIPC/IPCA → `t1737/v63,2265` | Mês; Brasil; % mensal / 12 meses | Mensal jan/1980–set/2026; 12 meses dez/1980–set/2026 | JSON; candidato à PoC; duas medidas |
| CV2 | [IBGE](ibge.md#preços-e-inpc) → SNIPC/IPCA → `t1419` e `t7060`, `v63,2265`, `c315[7171]` | Mês; Brasil; alimentação no domicílio; % | Mensal jan/2012–set/2026 em dois segmentos; lacunas nos acumulados | JSON; classificações e edição |
| CV3 | [ANP](anp.md) → LPC/LPMCC → Brasil, `GASOLINA COMUM`, preço médio de revenda | Semana com início/fim; Brasil; BRL/L | 09/05/2004–10/10/2026 nos arquivos, com lacunas | XLSX nacional; ponderação oficial |
| CV4 | [Conab/DIEESE](conab-dieese.md) → PNCBA → Tabela 1, capital, valor da cesta | Mês; capital; BRL/cesta | Inícios por capital no método de 2025; amostras jan/jul/dez de 2025 e set/2026 | PDF por edição; conferir extração |
| CV5 | [Margem](conab-dieese.md#tempo-por-cesta) → tempo por cesta → CV4 + SGS `1619` + `220` | Mesmo mês; capital; h/cesta | Disponibilidade conjunta por capital e mínimo | Engine; aplicação territorial do piso explícita |
| CV6 | [FJP](fjp.md) → Déficit Habitacional → `DH_Componentes`, Brasil, coluna `Ônus`; edição 2024 | Anual; Brasil urbano; estimativa de domicílios | Arquivos 2016–2019 reponderados e 2022–2024 | XLSX por edição; sem emenda automática |
| VF1 | [BCB](bcb.md#crédito-e-renda) → crédito/RNDBF → SGS `29265`, sem ajuste sazonal | Mensal, janela móvel trimestral; Brasil; % | Jan/2012–jul/2026 na janela consultada | JSON por intervalo; candidato à PoC |
| QV1 | [IBGE](ibge.md#pobreza-gini-e-segurança-alimentar) → SIS 2025 → Tabela 2.18, aba do ano, Brasil, E | Anual; pessoas; % abaixo de US$ 6,85/dia, PPC 2017 | 2012–2024 na mesma edição | ZIP/XLS; linha, PPC e visitas fixados |
| QV2 | [IBGE](ibge.md#pobreza-gini-e-segurança-alimentar) → PNADCA, todas as fontes → `t7435/v10681` | Anual; Brasil; índice 0–1 | 2012–2025 | JSON; retrospectiva e revisões |
| QV3 | [IBGE](ibge.md#pobreza-gini-e-segurança-alimentar) → PNADCA Segurança Alimentar → `t9552/v9784/c1[6795]/c12404[109099]` | Edições anuais; Brasil; % de domicílios | 2023 e 2024 | JSON; total oficial e graus |
| EE1 | [IBGE](ibge.md#pib-por-pessoa) → SCN anual → `t6784/v9814` | Anual; Brasil; variação em volume, % | 1996–2023 | JSON; mesma edição de produção/população |

As duas derivadas seguem os [contratos da fase 3](../systems/mvp-indicators.md), com dataset interno e `source_series_id: null`. Os códigos externos pertencem aos inputs. A fórmula não é uma série externa nem um cálculo já publicado.

## Contextos e entradas auxiliares

| Medida | Fonte → dataset → recorte | Frequência / histórico verificado | Pipeline e validação |
|---|---|---|---|
| TR3 — Jornada habitual | IBGE PNADCT `t6371/v8190/c2[6794]` | Trimestre civil, 2012T1–2026T2; h/semana, todos os trabalhos | JSON; não dividir TR1 por esta média |
| Participação | IBGE PNADCT `t4093/v4096/c2[6794]` | Trimestre civil, 2012T1–2026T2; % das pessoas de 14+ | JSON; denominador distinto de TR4 |
| Subutilização | IBGE PNADCT `t4099/v4118` | Trimestre civil, 2012T1–2026T2; % da força ampliada | JSON; taxa composta publicada |
| VF2 — Inadimplência PF | BCB SGS `21084` | Mensal, jan/2012–ago/2026 na janela consultada; % da carteira | JSON; atraso superior a 90 dias, livre + direcionado |
| INPC geral | IBGE SNIPC `t1736/v44,2292` | Mensal abr/1979–set/2026; 12 meses mar/1980–set/2026; % | JSON; distinto de IPCA |
| INPC número-índice | IBGE SNIPC `t1736/v2289`, dez/1993 = 100 | Mar/1979–set/2026; TR2 usa jan/2012 em diante e dez/2025 como base | JSON; índices positivos, mesma base |
| Mínimo nominal | BCB SGS `1619` | Mensal, jan/2012–out/2026 na janela consultada; BRL/mês | JSON; vigência, inclusive maio/2023 |
| Insegurança leve, moderada e grave | IBGE `t9552/v9784/c1[6795]/c12404[109100,109101,109102]` | 2023 e 2024; % de domicílios | JSON; não substituir o total oficial pela soma arredondada |

## Preservação e passagem para a fase 5

As [evidências](evidence/README.md) distinguem JSON reformatado de recortes de planilha/PDF, com URL, coleta, hash do original e coordenadas. As amostras não alimentam o site. Na futura coleta, preservar originais e notas antes de normalizar, conforme [operações e consistência](../systems/data-operations.md). Mudanças de valor, base, peso e edição precisam de revisão; uma coleta sem mudança não é revisão estatística.

No SIDRA, distinguir `...` (não disponível), `..` (não se aplica), `X` (inibido), `-` (zero absoluto) e `0` numérico, conforme a [legenda oficial](https://sidra.ibge.gov.br/tabela/6784). A legenda de uma fonte não se transfere para outra. HTML de bloqueio, categoria desconhecida e ausência não podem virar zero.

TR4, CV1 e VF1 têm recortes, unidades, períodos e respostas numéricas conferidos para a **PoC de três indicadores e quatro séries externas, de duas fontes**: uma série de TR4, duas medidas de CV1 e uma de VF1. A liberação é para experimentação local. Publicação exige cumprir os termos de cada fonte.

A [implementação e a auditoria da fase 5](../systems/ingestion.md) registram a execução local posterior deste recorte, com 587 observações e repetição sem revisões. O catálogo continua sendo a evidência documental da fase 4.

A fase 5 deve provar `fetch → validate → raw → normalize → persist → expose`, com idempotência, logs, timestamps, retries, schema e controle de atualização. Deve testar revisão histórica e repetição sem mudança, trimestre civil e janela móvel de VF1. Nada disso é comprovado pela catalogação.

Cuidados para a integração posterior: CV2 exige segmentos e lacunas explícitos; CV4/CV5 exigem validação por mês/capital e versão de método; CV6 exige edição e hierarquia de exclusões, sem retrospectiva automática. Direitos não especificados nos arquivos FJP, no mínimo SGS e na Peic precisam de confirmação antes de redistribuição de bases. Esses limites não alteram a seleção dos 15.

As [três investigações](../research/phase-4-investigations.md) estão concluídas documentalmente, sem inclusão automática no MVP. As demais fontes continuam no [mapa de expansão](../research/source-map.md). A [regra permanente de SEO e descoberta por IA](../../AGENTS.md) permanece critério das futuras páginas.
