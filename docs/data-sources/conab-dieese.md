# Conab/DIEESE — cesta básica por capital

Verificado em **17/10/2026**. Atende **CV4** e fornece custo e referência metodológica para **CV5**. Dataset: Pesquisa Nacional da Cesta Básica de Alimentos (PNCBA). A origem conjunta não exige duas coletas do mesmo dado.

## Arquivos e identidade da série

A obtenção escolhida é o **boletim mensal público em PDF**, Tabela 1, capital e coluna “Valor da cesta”. Não há código externo único de série: identificar pesquisa, edição, capital, composição e mês. Unidade **BRL/cesta nominal**, mês civil, capital pesquisada; não representa estado ou país.

| Publicação amostrada | Conteúdo conferido |
|---|---|
| [Janeiro/2025](https://www.dieese.org.br/analisecestabasica/2025/202501cestabasica.pdf) | Boletim anterior à ampliação da parceria |
| [Julho/2025](https://www.dieese.org.br/analisecestabasica/2025/202507cestabasica.pdf) | Divulgação nas 27 capitais e início da coleta das dez novas em abril/2025 |
| [Dezembro/2025](https://www.dieese.org.br/analisecestabasica/2025/202512cestabasica.pdf) | Tabela 1, página impressa 3 (página 4 do PDF); 27 valores e tempos, dez capitais com nota de início em abril/2025 |
| [Setembro/2026](https://www.dieese.org.br/analisecestabasica/2026/202609cestabasica.pdf) | Tabela 1, página impressa 3 (página 4 do PDF); 27 valores e tempos |

[Amostras](evidence/files.json) preservam as 27 linhas de dez/2025 e set/2026, com fonte, página e hash no [manifesto](evidence/manifest.json). Não usar percentual do salário mínimo **líquido** da coluna vizinha como custo ou input do tempo.

O [banco de dados](https://www.dieese.org.br/cesta/) contém formulários por cidade/produto/período, e as [análises anteriores](https://www.dieese.org.br/analisecestabasica/analiseCestaBasicaAnteriores.html) são o ponto de descoberta dos PDFs. Não foi validada uma API pública estável de exportação. Consulta ao formulário não comprova download de uma retrospectiva completa.

## Histórico e composição

A [metodologia de agosto/2025](https://www.dieese.org.br/metodologia/metodologiaCestaBasica2025.pdf), Quadro 1, fixa os inícios da cobertura apresentada nessa edição:

| Capital | Início indicado | Capital | Início indicado |
|---|---|---|---|
| São Paulo | Jan/1959 | Goiânia | Dez/1994 |
| Porto Alegre | Jan/1977 | Aracaju | Set/1995 |
| Belo Horizonte | Jul/1979 | Campo Grande | Nov/2012 |
| Rio de Janeiro | Jan/1983 | Manaus | Abr/2025 |
| Salvador | Abr/1983 | Cuiabá | Abr/2025 |
| Curitiba | Jun/1983 | Palmas | Abr/2025 |
| Florianópolis | Mai/1985 | Maceió | Abr/2025 |
| Brasília | Jan/1986 | São Luís | Abr/2025 |
| Fortaleza | Set/1986 | Teresina | Abr/2025 |
| Recife | Fev/1987 | Macapá | Abr/2025 |
| Belém | Ago/1987 | Rio Branco | Abr/2025 |
| João Pessoa | Jul/1988 | Porto Velho | Abr/2025 |
| Vitória | Out/1988 | Boa Vista | Abr/2025 |
| Natal | Fev/1991 | — | — |

Esses inícios são **evidência documental**, não auditoria de cada mês desde então. O formulário legado anuncia inícios diferentes para algumas capitais, e a [metodologia de 2016](https://www.dieese.org.br/metodologia/metodologiaCestaBasica2016.pdf) já descrevia 27 capitais. Não concluir que os períodos intermediários tenham coleta contínua nem unir as duas coberturas sem inventário. Para as dez novas capitais da parceria, o segmento de 2025 começa em abril; arquivos anteriores, se incorporados, precisam de método e lacunas próprios. Campo Grande não tem jan–out/2012 nessa cobertura.

A cesta usa quantidades regionais do Decreto-Lei 399/1938. O método de 2025, seção 1, separa:

- região 1: ES, MG, RJ, SP, GO e DF;
- região 2: Norte e Nordeste, incluindo TO;
- região 3: PR, RS, SC, MT e MS.

Há diferenças nas quantidades e produtos, como farinha e batata. Preservar a tabela de composição da edição; a coluna “Nacional” no método é uma provisão normativa, não uma cesta nacional observada. A publicação de set/2026 menciona Palmas e São Luís entre as capitais com batata, enquanto o quadro regional de 2025 as enquadra na região 2. Essa divergência documental precisa ser esclarecida antes de afirmar composição detalhada dessas duas séries ou comparabilidade por produto; o valor total por capital permanece identificado no boletim, sem recalculá-lo.

A metodologia de 2025 prevê uma futura cesta ampliada com a Conab. Quando ocorrer, tratá-la como mudança de método, sem substituir retroativamente a cesta antiga. O deflator de TR2 não entra em CV4.

## Tempo por cesta

CV5 é derivada Margem, conforme [contrato](../systems/mvp-indicators.md):

```text
hours_per_basket(capital, month) = basket_nominal(capital, month)
                                / minimum_nominal(Brasil, month) × 220
```

A seção de tempo de trabalho da metodologia de 2025 mantém **220 horas/mês**. O [mínimo SGS 1619](bcb.md#inputs-das-derivadas) é nominal e deve ter o mesmo mês. Preservar IDs dos inputs, versão do método e aplicação territorial do piso nacional à capital; não criar um salário local fictício. Saída h/cesta, referência de piso nacional, sem alegar jornada observada ou renda pessoal.

O tempo publicado serve para **confronto**, sem ser input da fórmula. Exemplo: São Paulo em dez/2025 custa R$ 845,95; mínimo R$ 1.518; resultado de referência equivale a aproximadamente 122h36m. Em set/2026, R$ 922,51 e mínimo R$ 1.621 correspondem a cerca de 125h12m. A validação de pesquisa compara a precisão de minuto dos boletins; tolerância e arredondamento finais serão fixados na engine. Custo não negativo, mínimo positivo, moeda e mês iguais; ausência bloqueia resultado e zero publicado permanece distinto de ausência.

## Acesso, atualização, direitos e falhas

PDFs e método foram baixados sem credenciais. Publicação mensal no mês seguinte; por exemplo, o boletim dez/2025 é de 08/01/2026. O último boletim amostrado é set/2026; não se afirma varredura exaustiva de todas as edições disponíveis. Não foi identificado SLA ou quota de chamadas. Guardar data oficial e coleta separadamente.

A [nota do banco](https://www.dieese.org.br/analisecestabasica/notaBancoDados.html) exige assinatura para **indicadores de preço por produto desde abril/2018**. Ela não afirma que os totais dos boletins públicos sejam pagos. O rodapé permite reprodução dos textos com citação da fonte; não ampliar isso automaticamente para extração irrestrita de toda a base comercial. A integração inicial pode usar o boletim público selecionado, citando Conab/DIEESE e preservando o original. Condições de redistribuição em massa devem acompanhar a fonte.

Job futuro: descobrir boletim → preservar PDF/edição/hash → extrair Tabela 1 → conferir 27 capitais no período de cobertura completa → validar moeda, mês, composição e duplicatas → aceitar lote revisado. Extrair texto pode deslocar colunas, interpretar `122h36m` como decimal ou confundir custo com percentual; conferir a tabela original quando houver mudança de layout. Rejeitar divergências, sem preencher capital ausente. Preservar revisões do PDF no mesmo URL. A falta de histórico completo não autoriza trocar por média nacional ou retirar capitais do escopo.
