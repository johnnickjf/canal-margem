# ANP — gasolina comum

Verificado em **17/10/2026**. Atende **CV3**, preço médio de revenda da gasolina C comum, Brasil, semanal, **R$/L nominais**. A fonte é o agregado publicado pela ANP, sem média própria de municípios ou postos.

## Dataset, arquivos e recorte

Dataset: Levantamento de Preços de Combustíveis (LPC), sucessor do LPMCC. O [índice histórico oficial](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos) separa arquivos por frequência e território. Não há código de série SGS/SIDRA; a identificação externa é **arquivo + aba + produto + início/fim da semana + coluna**.

| Arquivo | Seleção conferida | Histórico observado |
|---|---|---|
| [Semanal Brasil 2004–2012](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/shlp/2001-2012/semanal-brasil-2004-a-2012.xlsx) | Aba `BRASIL - 09.05.04 A 29.12.12`, `GASOLINA COMUM` | 447 semanas, 09/05/2004–29/12/2012 |
| [Semanal Brasil desde 2013](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/shlp/semanal/semanal-brasil-desde-2013.xlsx) | Aba `BRASIL - DESDE 30.12.2012`, `GASOLINA COMUM` | 710 semanas, 30/12/2012–10/10/2026 |
| [Resumo 04–10/10/2026](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arquivos-lpc/2026/resumo_semanal_lpc_2026-10-04_2026-10-10.xlsx) | Aba `BRASIL`, linha 13, `GASOLINA COMUM`, coluna G | R$ 6,54/L; 4.474 postos pesquisados |

As planilhas foram baixadas e lidas. [Recortes e inventário](evidence/files.json) preservam cabeçalhos, coordenadas, contagens e limites; o [manifesto](evidence/manifest.json) informa hashes dos arquivos. No histórico, a coluna de preço médio está em F; no resumo semanal, em G. Validar pelo cabeçalho, não fixar uma posição para todos os arquivos. O nome “desde 2013” inclui semana que começa em **30/12/2012**: manter as duas datas originais, sem converter em mês ou semana ISO pelo nome do arquivo.

O [índice de dados abertos por revendedor](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/serie-historica-de-precos-de-combustiveis) oferece outra granularidade. Seus CSV não substituem o agregado Brasil. `GASOLINA ADITIVADA`, preço de distribuição e gasolina A também não atendem CV3.

## Método, cobertura e quebras

A [documentação do levantamento](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/informacoes-levantamento-de-precos-de-combustiveis) explica que, desde **31/10/2004**, médias estaduais, regionais e nacional são ponderadas por vendas informadas pelas distribuidoras. Antes disso, eram médias simples. O histórico pode ser catalogado desde maio/2004, mas a série Margem ponderada não deve atravessar essa mudança sem marcar o método. O horizonte desejado desde 2012 já fica depois dela.

A mesma documentação registra:

- redução de municípios pesquisados em 2015;
- redução de 501 para 459 municípios entre 30/07/2017 e 30/12/2017, com capitais e DF pesquisados semanalmente e os demais 432 municípios em grupos alternados a cada semana;
- transição LPMCC → LPC em 2020 e **ausência de pesquisa entre 23/08/2020 e 17/10/2020**;
- novo contrato em setembro/2022, com implantação gradual da cobertura;
- limitações de coleta na pandemia.

Para acompanhar preços nacionais, regionais ou estaduais entre 30/07/2017 e 30/12/2017, a ANP recomenda comparar semanas intercaladas, devido à alternância dos grupos pesquisados. A periodicidade semanal em todos os 459 municípios foi retomada em 31/12/2017. Preservar essa restrição nas comparações históricas de CV3.

O inventário dos arquivos também encontrou intervalos entre inícios de semana de 21 dias em ago/2005 e ago/2009 e de 14 dias em ago/2015. O intervalo de 63 dias em 2020 corresponde à interrupção documentada. Os limites exatos estão em `gaps` na [evidência dos arquivos](evidence/files.json). A ausência foi observada; não atribuímos uma causa às demais lacunas sem nota oficial.

O [método de coleta](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/arquivos-metodologia/metodologia-coleta.pdf) complementa as notas. Semana sem pesquisa permanece ausente; não interpolar. Mudanças na amostra e no teor regulamentar da gasolina precisam acompanhar a interpretação histórica. O resultado descreve o universo pesquisado e a ponderação ANP, não todos os postos individualmente.

## Acesso, atualização e direitos

XLSX por HTTPS, sem autenticação nos downloads feitos. Não foi identificada API estável para esse agregado nem medida quota/SLA. Descobrir links nos índices oficiais; não gerar nomes de arquivos de semanas futuras e aceitar qualquer HTTP 200. O [índice das últimas semanas](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas) mostra datas e avisos de calendário. Em 17/10/2026, a última semana publicada ali era 04–10/10/2026, com aviso de divulgação de 11–17/10 em 20/10. O atraso varia em feriados; não confundir coleta em andamento com publicação.

As páginas exibem licença **Creative Commons Atribuição-SemDerivações 3.0** para seu conteúdo. Não presumir que o rodapé concede licença diferente aos arquivos de dados; manter atribuição e verificar os termos próprios antes de redistribuição em massa. Os downloads foram públicos. Nesta entrega preservamos recortes identificados e hashes, sem copiar toda a base para o site.

## Futura ingestão e validação

Job semanal: descobrir arquivo → baixar e preservar XLSX → validar abas/cabeçalhos → selecionar Brasil/produto → guardar datas inicial/final, unidade, preço, postos e notas → comparar com histórico anterior. Arquivos acumulados podem mudar no mesmo URL; usar hash e timestamp, sem sobrescrever o original aceito.

Conferir uma linha por semana/produto, sete dias inclusivos, unidade R$/L, preço positivo, postos positivos e coerência mínimo ≤ médio ≤ máximo. Os dois arquivos históricos e o resumo devem concordar quando se sobrepõem. Símbolos como `-` em colunas de distribuição não são instrução para converter o preço médio em zero. Falha de formato, semana ausente ou cobertura alterada requer estado explícito. Tempo por gasolina continua expansão posterior, fora de CV5.
