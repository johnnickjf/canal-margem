# Auditoria da fase 4

Verificação em **17/10/2026**. A entrega é o [catálogo documental](README.md) dos 15 principais, contextos e inputs, com evidência de acesso pontual. O escopo não exige ingestão recorrente, banco, engine ou publicação. Os critérios vêm da [fase 4](../04-roadmap.md#fase-4--catálogo-de-fontes), da [passagem definida na fase 3](../systems/mvp-indicators.md#passagem-para-o-catálogo-e-a-poc) e das instruções permanentes do projeto.

## Requisitos e evidências

| Requisito | Evidência inspecionada | Resultado |
|---|---|---|
| Cada principal tem fonte, dataset, série/recorte e obtenção | Comparação das chaves da seleção com as 15 linhas únicas da matriz; cinco fichas oficiais | Atendido; 13 conceitos externos e duas derivadas |
| Contextos e inputs têm recorte e unidade | Metadados de jornada, participação, subutilização, INPC, mínimo, inadimplência e graus EBIA | Atendido; códigos e denominadores explícitos |
| Histórico e lacunas são observados, sem promessa de continuidade | Respostas completas nas janelas consultadas; inventários ANP, FJP, SIS e boletins de cesta | Atendido com segmentos e limites documentados |
| Método, quebras, revisões, atualização e direitos são registrados | Fichas por fonte, publicações metodológicas e metadados CKAN | Atendido; condições não identificadas permanecem explícitas para futura integração/publicação |
| Amostras preserváveis com origem e data | [55 capturas](evidence/manifest.json), 18 respostas JSON, extratos de metadados e arquivos | Atendido; hashes dos originais e dos 20 artefatos referenciados conferidos |
| Inputs de TR2 e CV5 são identificados e compatíveis | Mínimo SGS 1619, INPC 1736/2289 e 54 linhas capital/mês de dois boletins | Atendido no nível de pesquisa; engine não implementada |
| Universo e edição de CV6/QV3 não ficam implícitos | Coluna Ônus da FJP com hierarquia de exclusões; categorias totais e graus de domicílios EBIA | Atendido; sem converter contagem em percentual ou emendar edições |
| As três investigações têm conclusão | [Renda/hora, Peic e inflação por renda](../research/phase-4-investigations.md) | Atendido documentalmente, sem alterar os 15 principais |
| A continuidade identifica a PoC seguinte | README, índice, roadmap, seleção e mapa atualizados | Fase 5: TR4, CV1 e VF1; três indicadores, quatro séries externas, duas fontes |

## Conferências executadas

As validações de pesquisa foram feitas com scripts temporários de leitura, sem adicionar dependências ao projeto ou criar uma infraestrutura de ingestão:

- Os hashes das 55 capturas foram comparados aos downloads examinados. As 18 respostas JSON locais são semanticamente iguais às respostas originais; a formatação é a única transformação. Os 21 arquivos JSON têm sintaxe válida; todos os 20 artefatos referenciados têm hash final correspondente ao manifesto.
- Foram conferidos 14 contratos de resposta IBGE: tabela/variável, Brasil, classificações selecionadas, unidade dos metadados e valores. Respostas com unidade vazia de taxas foram documentadas, sem substituir os originais. Categorias inválidas não foram preservadas como séries válidas.
- Foram conferidos 529 registros mensais BCB nas três janelas: 178 do mínimo, 175 de VF1 e 176 de VF2, sem duplicatas ou meses faltantes nessas janelas. Isso não afirma continuidade anterior a 2012.
- TR2 tem 177 combinações mensais de inputs reais, jan/2012–set/2026, com INPC-base dez/2025 presente. A aritmética decimal confirmou positividade e igualdade com o mínimo nominal na própria base. Nenhuma série derivada foi persistida como produto.
- CV5 foi confrontado em 54 pares capital/mês (27 em dez/2025 e 27 em set/2026). Todos ficaram a menos de um minuto do tempo publicado; a maior diferença foi aproximadamente 0,696 minuto. Esse confronto de pesquisa não define a política final de arredondamento da engine.
- As duas Tabelas 1 de cesta foram renderizadas e inspecionadas visualmente na página física 4, impressa como 3. Os recortes preservam capital, valor, tempo e nota de cobertura. A divergência de composição no texto de set/2026 está registrada na ficha.
- As células nacionais ANP/FJP foram reconciliadas com os XLSX. No histórico ANP, 1.157 linhas de gasolina comum têm períodos de sete dias e inícios únicos; quatro intervalos com semanas ausentes permanecem identificados.
- Os membros dos ZIP da SIS têm hashes conferidos. As 13 células anuais de pobreza e as 13 de renda/hora correspondem à linha Brasil, na coluna/aba escolhida. Os originais XLS foram mantidos intactos durante a leitura por conversão temporária.
- QV3 conserva o total oficial de 24,2% em 2024, mesmo que os três graus publicados arredondados somem 24,1%. A variável é de domicílios, não moradores.
- A planilha Ipea foi conferida em 235 meses e 224 acumulados de 12 meses, seis estratos numéricos, sem meses faltantes após interpretação explícita do rótulo `Óut/25`; o original e a anomalia permanecem identificados.

## Qualidade do repositório

`pnpm build` passou: Biome sem alterações, `astro check` com zero erros, avisos ou sugestões e build estático de **38 páginas**. `git diff --check` passou. Os links locais e fragmentos Markdown foram conferidos, incluindo os novos documentos e evidências.

Não foram executados Vitest, cobertura ou Playwright: a alteração é de documentação e amostras fora do runtime; código, rotas, componentes, dependências e configuração de publicação não foram alterados. A [regra permanente de SEO e descoberta por IA](../../AGENTS.md) e sua referência no README foram preservadas. Build local não comprova publicação ou indexação externa.

## Estado e limites

**DONE — catálogo da fase 4 concluído.** Não há requisito documental sem fonte/obtenção identificada. Os limites abaixo são condições conhecidas das fases seguintes, não evidência de operação pronta:

- TR1 exige vincular a base monetária à divulgação antes de publicar valores reais; CV2 exige tratar segmentos de classificação e lacunas de acumulados.
- A retrospectiva da cesta não foi baixada mês a mês desde o início de cada capital; há segmentos e divergência documental de composição a esclarecer. CV6 não tem retrospectiva homogênea certificada entre as edições catalogadas.
- Peic não tem canal histórico automatizável demonstrado nesta inspeção. Licenças não especificadas e condições de redistribuição das bases devem ser resolvidas antes de publicação; não houve contato ou contratação externa.
- Acesso pontual não comprova retries, idempotência, preservação raw operacional, persistência, exposição, publicação, atualização automática ou indexação. A [fase 5](../04-roadmap.md#fase-5--prova-de-conceito-de-ingestão) deve demonstrar o pipeline com TR4, CV1 e VF1.
