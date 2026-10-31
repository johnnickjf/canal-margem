# Cobertura da edição local ampliada — 27/10/2026

A edição `bf9312d69b4ef6d12545593885cef74f34734711e8add0aa0076614b886a5b70`, geração 5,
seleciona 690 recortes. Ela é um ensaio local e não substitui curadoria para publicação
externa. As datas na tabela são períodos de referência, não datas de divulgação ou coleta.
A descrição metodológica detalhada, inclusive as condições de redistribuição, está nas
[fichas de fontes](../../../data-sources/README.md) e no [catálogo do MVP](../../mvp-indicators.md).

| Indicador | Cobertura selecionada | Fonte, unidade e limite principal |
|---|---|---|
| TR1 Rendimento real | Sem valor | IBGE, Brasil, R$/mês; base monetária da divulgação ainda não resolvida para publicação. Há coleta, mas não se deve inferir comparabilidade. |
| TR2 Salário mínimo real | Brasil, mensal 2025 | BCB e IBGE/INPC, R$/mês de dez/2025; mínimo nominal deflacionado, não renda pessoal. |
| TR4 Desemprego | Brasil, trimestres 2025 | IBGE, % da força de trabalho; não inclui pessoas fora da força de trabalho. |
| TR5 Informalidade | Brasil, trimestres 2025 | IBGE, % da população ocupada segundo a definição da fonte. |
| CV1 Inflação | Brasil, mensal e 12 meses em 2025 | IBGE/IPCA, %; índice geral não representa necessariamente uma família. |
| CV2 Inflação da alimentação | Brasil, mensal e 12 meses em 2025 | IBGE/IPCA, %; alimentação no domicílio e segmento metodológico atual. |
| CV3 Gasolina | Brasil, 51 semanas completas de 2025 | ANP, R$/litro nominal; preço médio pesquisado, não preço de cada posto. |
| CV4 Cesta | Capitais pesquisadas, mensal em 2025; dez capitais somente jul–dez | Conab/DIEESE, R$/cesta nominal; composição regional, cobertura e notas da pesquisa variam. Não representa uma cesta nacional. |
| CV5 Tempo por cesta | Mesmas capitais e meses de CV4 | Cálculo Margem a partir de CV4 e mínimo nominal BCB; horas/cesta com 220 h/mês e piso bruto nacional, não jornada observada. |
| CV6 Ônus do aluguel | Brasil urbano, 2024 | FJP, domicílios estimados com renda de até três mínimos, segundo hierarquia do déficit; não é proporção de todos os locatários. |
| VF1 Comprometimento da renda | Brasil, mensal 2025 | BCB, %, série agregada RNDBF com média móvel trimestral; não é comprometimento individual. |
| QV1 Pobreza | Brasil, 2023 e 2024 | IBGE/SIS 2025, % de pessoas abaixo de US$ 6,85/dia PPC 2017; método e linha são específicos. |
| QV2 Desigualdade | Brasil, 2025 | IBGE, Gini da renda domiciliar per capita, escala de 0 a 1; não descreve toda a distribuição. |
| QV3 Insegurança alimentar | Brasil, 2023 e 2024 | IBGE/EBIA, % de domicílios com qualquer grau; a definição não se limita à insegurança grave. |
| EE1 PIB por pessoa | Brasil, 2023 | IBGE, variação anual em volume, %; não mede distribuição nem renda pessoal. |

As coletas locais ANP, Conab/DIEESE e FJP aceitaram respectivamente 51, 264 e 7 observações.
A FJP inicialmente falhou porque o índice mudou; após conferência do novo vínculo e ajuste do
catálogo, a coleta aceitou 2016–2019 e 2022–2024, mas a edição seleciona somente 2024 para não
emendar segmentos automaticamente. A coleta IBGE de 2023–2024 aceitou 229 observações; a
edição acrescenta apenas QV1, QV3 e EE1 dessa coleta. Não há suposição de continuidade onde a
fonte não oferece os mesmos anos.

Repetidas as mesmas janelas, ANP, Conab/DIEESE e FJP reutilizaram os respectivos lotes e
retornaram zero alterações; isso verifica idempotência dessas coletas, não uma revisão oficial.

Os [cálculos](calculations.json) fixam os IDs dos inputs: 12 TR2 e 264 CV5 retornaram estado
observado. Os [manifestos da geração 4](publication-multifonte.json) e da
[ativação correspondente](activation-multifonte.json), seguidos dos
[manifestos da geração 5](publication-ampliada.json) e sua
[ativação](activation-ampliada.json), registram a seleção e suas bases. Reproduzir as
atividades exige também os lotes, observações e objetos originais; IDs no manifesto não
substituem backup desses dados. A edição anterior de três indicadores está descrita no
[ensaio inicial](README.md).

O build fixado na geração 5 gerou 89 páginas. Nas 15 páginas dos indicadores principais, a
inspeção do HTML encontrou 14 com valores e TR1 com ausência explícita; também conferiu o ID
da edição, `h1`, descrição, canonical, sitemap e sintaxe dos JSON-LD presentes. Na cesta de
São Paulo em dezembro/2025, o HTML mostra R$ 845,95 e 122 h 36 min, com mínimo de R$ 1.518;
na FJP, mostra 3.587.776,7972144 domicílios em 2024. Esses valores foram comparados aos
inputs e resultados aceitos, não a uma revisão independente de cada arquivo oficial.

Uma checagem com Chromium em desktop e celular nas páginas da cesta, ônus do aluguel e tema
custo de vida confirmou resposta 200, um `h1`, dados visíveis no HTML e ausência de overflow;
o axe não apontou violações nessas seis combinações. As três páginas também responderam em
celular sem JavaScript, com movimento reduzido. Isso não comprova todos os fluxos ou o uso
com leitor de tela.

`playwright test tests/indicators.spec.ts --project=desktop --project=mobile`, executado
contra o build com dados, passou em 40 testes de leitura sem JavaScript para os 20 indicadores
principais e auxiliares. O teste verifica estrutura, links e metadados, não a correção de cada
valor nem a revisão visual de cada página.

Limites conhecidos: a verificação global dos objetos históricos falhou e a publicação anterior
à recuperação parcial segue indisponível. O ambiente local não oferece evidência de backup,
agenda, alerta ou deploy remoto. Conferência automatizada do HTML não equivale a avaliação
visual e assistiva das páginas, nem comprova indexação.
