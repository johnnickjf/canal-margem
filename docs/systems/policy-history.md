# Políticas públicas e linha histórica — fase 18

A camada apresenta políticas, legislação, períodos de governo e indicadores na mesma
janela temporal. Ela permite investigar relações; não calcula impacto, causalidade ou
score político. A hipótese desta fase é que contexto legal e dados podem ser lidos juntos
sem confundir coincidência temporal com efeito demonstrado.

## Catálogo e responsabilidade editorial

O [catálogo JSON](../../src/data/policies.json) começa com quatro políticas federais:
reforma trabalhista de 2017, reforma previdenciária de 2019, valorização do salário mínimo
a partir de 2024 e Bolsa Família na lei de 2023. Inclui cinco atos legais e três períodos
presidenciais. Não é um inventário exaustivo: teto de gastos, privatizações e outras políticas
podem ser acrescentados com a mesma estrutura e referências verificadas.

O [schema e a validação](../../src/lib/policy-catalog.ts) implementam:

| Entidade | Conteúdo e garantias |
|---|---|
| `Policy` | ID estável usado na URL, nome, descrição, geografia nacional, limites, referências legais, vigências, indicadores e contextos de governo |
| `Legislation` | ID, nome, assinatura/promulgação, publicação e fontes HTTPS identificadas |
| `Government` | ID, nome, cargo, geografia, intervalo inclusivo, fontes e nota de escopo; concretiza o `GovernmentPeriod` conceitual |
| `EffectivePeriod` | ID dentro da política, início, fim ou `null`, dispositivo/escopo e referências a atos vinculados à política |
| `AffectedIndicators` | Relações explícitas por slug de indicador, justificativa e `relationship: contextual`; o nome não implica efeito observado |

Datas são civis ISO válidas e os extremos são inclusivos. Fim `null` permanece em aberto;
não é substituído pela data atual. Assinatura/promulgação, publicação e vigência são campos
distintos. A vigência pode anteceder a publicação se houver retroatividade documentada;
o validador não impõe uma ordem falsa entre esses eventos. Intervalos de dispositivos
distintos podem se sobrepor. Não se deduz a vigência de uma política a partir de um mandato.

O catálogo tem versão de contrato, revisão editorial, autoria e data de conferência das
fontes. As fontes oficiais e os dispositivos estão nos registros. A regra anual do mínimo
registra tanto a Lei nº 14.663/2023 quanto o limite adicional de 2025–2030 da Lei nº
15.077/2024; a EC nº 103/2019 distingue a vigência geral do grupo dos arts. 11, 28 e 32.
O período do Bolsa Família representa a lei de conversão, sem tratar essa data como
início de todos os pagamentos. As ressalvas ficam visíveis nas páginas.

Novos registros exigem revisão editorial: conferir os textos oficiais, identificar o
dispositivo, declarar limites e justificar cada relação. A validação automática verifica
estrutura, datas, duplicações, fontes e integridade de referências; não prova a interpretação
jurídica nem mantém a legislação atualizada. Campos desconhecidos e relações de tipo causal
são rejeitados. Referências ausentes a leis, governos ou indicadores interrompem a geração.

## Build, publicação e consulta

O catálogo é conteúdo editorial local, como as explicações do Entenda. Não pertence ao
manifesto numérico imutável da API. A revisão editorial é exibida separadamente da publicação
dos dados. O [hook de build](../../astro.config.mjs) também valida as relações contra o
catálogo de indicadores da publicação resolvida; não gera links para indicadores ausentes.
Não há migração de banco, job de coleta legal ou nova consulta às fontes oficiais durante
visitas ao site.

Rotas estáticas:

```text
/politicas
/politicas/:slug
/politicas/catalogo.json
```

O índice apresenta políticas por primeiro marco catalogado e governos com fontes. Cada
página detalha vigências por dispositivo, legislação, governos de implementação e históricos
dos indicadores relacionados. As páginas de indicador levam de volta às políticas e a busca
inclui o tipo `Política`, com filtro próprio e catálogo navegável sem JavaScript.

O JSON público contém a revisão, os registros completos, as justificativas e as referências.
Seu caminho é estável e acompanha o deploy do site; não deve ser tratado como recurso
imutável da API. A reprodução de uma leitura requer guardar a revisão editorial e a
publicação numérica indicada na página. Não há armazenamento consultável de revisões
editoriais antigas por HTTP nesta fase; o histórico do repositório preserva suas alterações.

## Linha histórica

[IndicatorHistory](../../src/components/platform/IndicatorHistory.astro) usa a mesma projeção
de datas para os pontos numéricos e as faixas legais/governamentais no mesmo SVG. A janela
vai do fim do primeiro período ao fim do último período do histórico do recorte. Só entram
vigências de políticas explicitamente relacionadas que interceptam essa janela. Havendo
políticas visíveis, entram os governos catalogados que interceptam a janela, inclusive
sucessores dos governos de implementação. Ausência de política catalogada não significa
ausência de políticas ou de efeitos.

As faixas são recortadas visualmente pela janela, sem alterar as datas originais. A lista
numerada expansível informa intervalos completos, escopo e links. Numeração, traço contínuo
para políticas e tracejado para governos complementam a cor. Um único período tem posição
central; sua faixa não inventa duração ou observações adicionais. O contexto é nacional;
os dados mantêm sua própria geografia, frequência, unidade e método, inclusive nos recortes
de capital. A relação nacional não transforma uma série local em estatística nacional.

Lacunas e mudanças de método continuam interrompendo as linhas. A tabela preserva decimais,
ausências, método e auditoria da edição. Sem valores representáveis ou com unidades mistas,
não se desenha contexto sobre um gráfico inexistente. Sem API configurada, as definições,
vigências e fontes permanecem disponíveis, acompanhadas do aviso de ausência de dados.

## Verificação e limites

- [Testes unitários](../../tests/unit/policy-catalog.test.ts): contrato, referências inválidas,
  datas impossíveis/invertidas, duplicações, fontes, rejeição de relações causais, prazos
  distintos, extremos inclusivos, recorte, sucessão de governos e igualdade do eixo numérico.
- [Testes de páginas](../../tests/policies.spec.ts): navegação sem JavaScript, fontes,
  intervalos, JSON, busca com filtro, metadados, canonical, dados estruturados, sitemap,
  rastreamento, acessibilidade automática e largura em desktop/celular.
- [Build com API controlada](../../tests/content-build.spec.ts): políticas junto à série
  numérica da publicação fixada, ausência preservada, precisão decimal, auditoria por
  teclado, faixas no mesmo eixo, acessibilidade e capturas em desktop/celular.

Essas verificações são locais. Não comprovam compreensão por usuários, indexação externa,
operação Railway/R2 ou efeitos de políticas. A [fase 19](evidence.md) acrescenta estudos,
avaliações e referências metodológicas com critérios e limites, preservando o caráter
contextual das relações desta linha histórica. Integração ao comparador por seleção de
governo permanece uma evolução posterior.
A [regra permanente de SEO e descoberta por IA](../../AGENTS.md) continua obrigatória.
