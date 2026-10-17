# Investigações complementares da fase 4

Verificação em **17/10/2026**. Estas conclusões atendem às três investigações exigidas pela [seleção revisada](../systems/mvp-indicators.md). Não adicionam indicadores aos 15 principais e não autorizam contratação de acesso ou integração externa.

## Rendimento por hora do IBGE

**Conclusão:** há agregado publicado com cobertura geral. Microdados não são requisito inevitável para uma futura medida anual de rendimento por hora. Foram encontradas duas opções, com universos distintos:

| Opção oficial | Universo, frequência e cobertura | Acesso conferido |
|---|---|---|
| SIS 2025, Tabela 1.5 | Pessoas de **14+**, rendimento-hora real habitual de todos os trabalhos, Brasil; anual, 2012–2024 | [ZIP de trabalho](https://ftp.ibge.gov.br/Indicadores_Sociais/Sintese_de_Indicadores_Sociais/Sintese_de_Indicadores_Sociais_2025/Tabelas/xls/1_Trabalho_xls.zip), membro `Tabela 1.5 (Indic_Geo_Rend).xls`, abas anuais, **E8** = Brasil |
| ODS 8.5.1, SIDRA 9455 | Ocupados de **15+ com rendimento**, habitual de todos os trabalhos, por sexo; anual, 2012–2025 | [Tabela](https://sidra.ibge.gov.br/tabela/9455), variável `8828`, Brasil, `2[6794]` = total; [resposta](../data-sources/evidence/ibge-income-hour.json) |

A [extração SIS](../data-sources/evidence/files.json) preserva os 13 valores nacionais. O cabeçalho diferencia trabalho principal (D) e todos os trabalhos (E). A nota de 2024 informa primeiras visitas e reais médios de 2024. As abas de coeficiente de variação também existem. Os downloads não exigiram autenticação. Limites e atualização por edição seguem a [ficha IBGE](../data-sources/ibge.md).

As tabelas PNAD sobre plataformas não são substituto geral: a `10252`, por exemplo, exclui empregados públicos e militares; recortes de condutores são ainda mais restritos. Já a `9388` tem recorte de deficiência e apenas 2022 nos metadados consultados. Essas opções não devem orientar a série geral só por conterem “hora” no título.

Para uma expansão anual com 14+, a SIS é uma candidata adequada ao conceito, sujeita à versão de base real e edição. O ODS oferece JSON mais simples e histórico mais recente, mas **15+ não é 14+**. Uma futura seleção deve nomear esse universo e não substituir TR1. Nenhuma opção verificada resolve, por si, uma junção mensal de renda/hora local com preço semanal. CV5 continua usando mínimo nominal e 220 h/mês. Não dividir médias de TR1 e TR3.

## Peic/CNC

**Conclusão:** a Peic acrescenta uma pergunta distinta do crédito bancário e permanece candidata à expansão. O acesso a uma base histórica automatizável e os direitos de redistribuição não ficaram estabelecidos; sua integração é adiada com esse motivo, sem substituição por VF2.

Fontes oficiais: [metodologia](https://pesquisascnc.com.br/sobre-3/) e [página da pesquisa](https://pesquisascnc.com.br/pesquisa-peic/), lidas via HTTP sem credenciais. A CNC descreve apuração mensal desde **janeiro/2010**, aproximadamente **18 mil consumidores**, nas capitais e DF. Os resultados se referem a declarações sobre dívidas da família, contas atrasadas e capacidade de pagar, com modalidades e prazos próprios. Isso não é o percentual da carteira SFN com atraso superior a 90 dias, nem o serviço da dívida dividido pela RNDBF.

O portal oferece ações “Logar” e “Pedir acesso”; a página pública examinada expõe método e descrição, mas não forneceu arquivo histórico CSV/XLS/JSON ou endpoint público verificável. A categoria de metodologia também não entregou um arquivo. Não se conclui daí que todos os boletins sejam privados ou pagos, apenas que não foi demonstrado um canal de coleta elegível nesta verificação.

Não foram encontrados, nas páginas examinadas, licença explícita da base, quota, calendário com atraso garantido, pesos de expansão ou documentação suficiente da amostra para tratar o percentual como censo das famílias brasileiras. O início em 2010 é informado pela instituição, **não histórico baixado**. Antes de integrar: obter canal de distribuição documentado e termos, conferir denominadores, ponderação, recortes de renda, revisões e rupturas, e preservar uma amostra de dados. Não houve contato externo nem pedido de acesso nesta tarefa.

## Inflação por faixa de renda do Ipea

**Conclusão:** existe histórico público em XLSX, adequado como candidato de contexto da inflação. Sua inclusão requer versionar estratos e pesos; não substitui IPCA/INPC nem o deflator selecionado para TR2.

A [nota de janeiro/2026, publicada em 13/02/2026](https://www.ipea.gov.br/cartadeconjuntura/index.php/2026/02/inflacao-por-faixa-de-renda-janeiro2026/) vincula [texto completo](https://www.ipea.gov.br/cartadeconjuntura/wp-content/uploads/2026/02/260213_cc_70_nota_9_irf_jan26.pdf) e [Dados XLS](https://www.ipea.gov.br/cartadeconjuntura/wp-content/uploads/2026/02/260213_inflacao-por-faixa-de-renda.xlsx). Downloads sem autenticação, com seis estratos domiciliares, de renda muito baixa a alta:

| Aba | Unidade / histórico lido | Evidência |
|---|---|---|
| `Mensal` | %, jul/2006–jan/2026 | 235 linhas mensais, seis colunas de renda |
| `Acumulado 12 meses` | %, jun/2007–jan/2026 | 224 linhas, seis colunas de renda |

A [amostra](../data-sources/evidence/files.json) preserva primeiro/último período e valores por estrato; o [manifesto](../data-sources/evidence/manifest.json) identifica o arquivo e hash. Não se afirma que janeiro/2026 seja a edição mais recente do produto em outubro: é a edição explicitamente verificada, com retrospectiva acessível. Futuras atualizações devem descobrir a nota pelo índice oficial, sem prever nomes de anexos.

O [método de atualização de pesos de 2020](https://www.ipea.gov.br/portal/images/stories/PDFs/conjuntura/200616_inflacao.pdf) documenta a passagem da POF 2008–2009 à POF 2017–2018. As faixas são domiciliares, não renda per capita nem salários individuais. A Tabela 2 da nota de jan/2026 registra limites em reais de jan/2009 e os equivalentes de jan/2026. Guardar limites, mês-base, edição e pesos; não manter limites nominais constantes ao longo do tempo.

O arquivo combina rótulos como `jul/2006`, `Dez/2017` e `Jan/26`, e a aba mensal tem `Óut/25` em A237. Um importador precisa validar a sequência e tratar essa grafia explicitamente, preservando o original; filtro apenas por minúsculas/ano de quatro dígitos perde observações válidas. Taxas já estão em pontos percentuais, não frações para multiplicar por cem. Não somar meses para obter 12 meses.

A publicação é mensal, com atraso observado de cerca de duas semanas nesta edição, sem SLA ou quota medidos. Não foi validada API com contrato estável. A nota e o XLS não trouxeram uma licença específica da série na inspeção; citar Ipea e método e confirmar condições de redistribuição da base antes de publicar. Mudanças de planilha, estratos e revisão da retrospectiva devem bloquear aceitação automática até conferência.

## Decisão para continuidade

As três perguntas têm conclusão documental: renda/hora geral existe; Peic é conceitualmente distinta e tem acesso à base ainda não demonstrado; inflação por renda tem arquivo público e método que exige versionamento. Nenhuma delas altera os 15 principais. A [PoC](../04-roadmap.md#fase-5--prova-de-conceito-de-ingestão) segue com TR4, CV1 e VF1; as evidências e fichas necessárias estão no [catálogo](../data-sources/README.md).
