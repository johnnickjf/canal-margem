# Mapa de fontes e revisão da seleção do MVP

## Decisão e nível de evidência

Em 17/10/2026, a revisão da seleção inicial identificou excesso de prioridade à manutenção simples e ao recorte nacional. O responsável pelo projeto autorizou seguir a recomendação de incorporar alimentação, tempo de trabalho pelo piso, insegurança alimentar e moradia. A [lista revisada](../systems/mvp-indicators.md) é a referência de escopo: 15 conceitos principais, contextos e entradas auxiliares separados, sem integração de dados nesta entrega.

Este mapa registra a investigação que fundamenta a decisão e os caminhos para a fase 4. **Fonte identificada não significa acesso de dados validado.** A evidência aqui é de publicação institucional e metodologia; tabelas, arquivos, permissões de uso, cobertura efetiva e automação serão verificados no catálogo. Não há prova de execução de pipelines.

Este é o registro da seleção, anterior à catalogação. A verificação posterior está no [catálogo da fase 4](../data-sources/README.md), com consultas, arquivos, amostras oficiais e limites de acesso/histórico. As [três investigações obrigatórias](phase-4-investigations.md) agora têm conclusão documental. As pendências nas tabelas abaixo descrevem a passagem original; o catálogo registra seu atendimento e o que precisa de validação antes da integração/publicação.

## Fontes necessárias à seleção

| Fonte | Uso no MVP revisado | Evidência consultada | O que a fase 4 precisa resolver |
|---|---|---|---|
| IBGE — PNAD Contínua | Rendimento real, desemprego, informalidade, pobreza, Gini, insegurança alimentar e contexto de trabalho | [PNAD trimestral](https://www.ibge.gov.br/Estatisticas/Sociais/Trabalho/9173-pesquisa-nacional-por-amostra-de-domicilios-continua-trimestral.html), [retrospectiva de trabalho](https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Principais_destaques_PNAD_continua/2012_2024/PNAD_continua_retrospectiva_2012_2024.pdf), [Segurança Alimentar 2024](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102212_informativo.pdf) e [nota sobre EBIA](https://www.ibge.gov.br/comunicados/44778-inclusao-da-variavel-sd17001-nos-microdados-da-pnad-continua-seguranca-alimentar-2024) | Agregados e universos exatos, reponderações, visitas da pesquisa anual, períodos disponíveis e comparabilidade entre edições; investigar renda/hora com cobertura adequada |
| IBGE — SNIPC e Contas Nacionais | IPCA, alimentação no domicílio, INPC complementar e como deflator do mínimo, PIB por pessoa | [IPCA](https://www.ibge.gov.br/estatisticas-novoportal/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor-amplo.html?=&t=resultados), [INPC](https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9258-indice-nacional-de-precos-ao-consumidor.html) e [Contas Nacionais anuais](https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9052-sistemade-contas-nacionais-brasil.html) | Identificar número-índice e taxas, classificações e bases, revisões, população e edição das contas; não confundir índices ou valores correntes e volume |
| Banco Central | Mínimo nominal, comprometimento da renda e contexto de inadimplência | [Mínimo nominal, metadado antigo](https://www4.bcb.gov.br/pec/series/port/metadados/mg659ap.htm), [comprometimento RNDBF](https://dadosabertos.bcb.gov.br/dataset/29265-sgs) e [inadimplência PF](https://dadosabertos.bcb.gov.br/dataset/21084-inadimplencia-da-carteira-de-credito---pessoas-fisicas---total) | Confirmar série vigente do mínimo, vigências e moeda, janelas de referência, revisão das estatísticas e limites de consulta |
| ANP | Preço da gasolina comum | [Série histórica de combustíveis](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/serie-historica-de-precos-de-combustiveis) | Localizar agregado nacional oficial, ponderação, semana completa, arquivos e mudanças de cobertura; não calcular média simples dos municípios |
| Conab/DIEESE | Custo por capital e método de referência para tempo por cesta | [Pesquisa de dezembro de 2025](https://www.dieese.org.br/analisecestabasica/2025/202512cestabasica/index.html?page=19), [parceria e abrangência em 2025](https://www.dieese.org.br/analisecestabasica/analiseCestaBasica202507.html) e [metodologia](https://www.dieese.org.br/metodologia/metodologiaCestaBasica2016.pdf) | Arquivos e convenção do mês, direito de uso, composição regional, lacunas e reinícios por capital; confronto do tempo publicado com cálculo Margem e arredondamento |
| Fundação João Pinheiro | Contagem de domicílios com ônus excessivo do aluguel urbano | [Resultados habitacionais](https://fjp.mg.gov.br/deficit-habitacional-recua-em-minas-gerais/) e [documentação do déficit](https://repositorio.fjp.mg.gov.br/server/api/core/bitstreams/55f51816-280a-4ca6-94b0-04d1cb58d0c8/content) | Tabela nacional do componente, universo e exclusões, unidade, edição e revisões; não usar percentual no déficit como percentual de locatários |

A parceria Conab/DIEESE é um produto de origem conjunta, não duas integrações obrigatórias para o mesmo dado. O custo da cesta será coletado da publicação selecionada; tempo por cesta será calculado pelo Margem com inputs preservados e confrontado com a referência publicada.

## Investigações obrigatórias na fase 4

Estas investigações têm entrega documental, sem inclusão automática na lista principal ou promessa de integração.

| Pergunta | Fonte e evidência | Conclusão atual e condição para decidir |
|---|---|---|
| A inflação difere entre faixas de renda? | [Ipea — Inflação por faixa de renda, janeiro de 2026](https://www.ipea.gov.br/cartadeconjuntura/index.php/2026/02/inflacao-por-faixa-de-renda-janeiro2026/) | Relevante para explicar o agregado. Verificar série histórica acessível, atualização dos estratos, método e distribuição dos dados antes de adicionar séries complementares |
| Quantas famílias relatam atraso ou incapacidade de pagar? | [CNC — metodologia da Peic](https://pesquisascnc.com.br/sobre-3/) | A pesquisa mensal entrevista consumidores nas capitais e no DF e mede declarações de dívida e atraso. Avaliar acesso, amostra, expansão e licença; não equiparar seus percentuais aos da carteira de crédito do BCB |
| Há rendimento por hora publicado com universo adequado? | IBGE — PNAD e SIDRA, partindo dos produtos acima | A investigação anterior não estabeleceu um agregado geral elegível. Não concluir que microdados sejam necessários, nem assumir que uma tabela de trabalhadores de plataforma represente todos os ocupados. Documentar a alternativa encontrada ou a lacuna real |

## Fontes a manter no mapa de expansão

| Fonte | Perguntas que poderá atender | Limite antes de implementar |
|---|---|---|
| [Tesouro/Siconfi](https://apidatalake.tesouro.gov.br/docs/siconfi/) | Qual o gasto ou investimento dos entes públicos? | Selecionar relatório, cobertura, execução contábil e deflator; gasto declarado não comprova entrega de serviço ou impacto |
| [MDS — dados e ferramentas sociais](https://www.gov.br/mds/pt-br/orgaos/SAGICAD/dados-e-ferramentas-informacionais) | Quantas famílias são atendidas e que benefícios recebem? | Distinguir beneficiários, inscritos e elegíveis; cobertura administrativa não estima sozinha pobreza na população |
| [MTE — Novo Caged](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/estatisticas-trabalho/comunicados/1850-comunicado-n-2-atualizacao-dos-microdados-do-novo-caged) | Como evoluem admissões e desligamentos formais? | Tratar vínculo e pessoa como unidades diferentes; verificar revisões e transições de fonte antes de comparar com ocupação da PNAD |
| [ANEEL — dados abertos](https://dadosabertos.aneel.gov.br/) | Como variam tarifas de energia? | Tarifa regulada não é a conta final de cada família; definir distribuidora, perfil de consumo e componentes |
| [SINISA — resultados 2025, referência 2024](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/resultados-sinisa-2025) | Qual o acesso a água e esgotamento sanitário? | Verificar cobertura de informantes, denominadores e transição do SNIS; não presumir série homogênea |
| [Inep — indicadores educacionais](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/indicadores-educacionais) | Como evoluem acesso, trajetória e resultados escolares? | Escolher medida, etapa escolar, rede e periodicidade; não resumir educação a um único índice |
| [DATASUS — Tabnet](https://datasus.saude.gov.br/informacoes-de-saude-tabnet/) | Como evoluem resultados e atendimento em saúde? | Selecionar sistema e indicador, corrigir denominadores e verificar cobertura e revisão; produção de atendimentos não mede sozinha qualidade ou acesso |

EE2, dívida bruta, permanece identificado na [série do BCB](https://dadosabertos.bcb.gov.br/dataset/13762-divida-bruta-do-governo-geral--pib---metodologia-utilizada-a-partir-de-2008), com prioridade posterior. Adiar sua integração na primeira experiência não elimina a dimensão fiscal do projeto.

## Consequências e próximos passos

A revisão aceita fontes adicionais, recortes por capital e edições anuais para responder às perguntas centrais do produto. O trabalho de catalogação aumenta; isso deve ser tratado na ordem de integração e nos estados de disponibilidade, sem substituir alimentação ou moradia por uma série mais fácil.

A fase 4 cobriu os 15 principais, inputs e contextos e concluiu documentalmente as três investigações. A expansão de serviços públicos e políticas permanece posterior. O [catálogo de fontes](../data-sources/README.md) define as consultas e os limites para a PoC da fase 5, sem reduzir o escopo do MVP.

Os links foram identificados na pesquisa desta sessão, em 17/10/2026. Houve leitura de páginas institucionais, publicações e resultados de busca; parte das páginas do IBGE e visualizadores do DIEESE não entregou conteúdo completo por acesso direto. O arquivo do repositório da FJP apresentou uma verificação contra acesso automatizado; a definição foi identificada também por resultados indexados e a publicação institucional, sem demonstrar coleta automatizável. Não foram verificados todos os endpoints, arquivos ou direitos de redistribuição. Datas no título de publicação são referência da evidência consultada, não garantia de que seja a edição mais recente.
