# Evidência e causalidade — fase 19

A camada associa estudos às políticas e aos indicadores sem converter coincidência temporal
em efeito estimado. O catálogo inicial contém uma avaliação contábil do Bolsa Família,
um estudo de impacto sobre insegurança alimentar e um manual de avaliação. Fontes,
desenhos, períodos, resultados dos autores e limites ficam disponíveis em HTML e JSON,
inclusive sem API numérica configurada e sem JavaScript.

## Contrato e classificação

O [catálogo editorial](../../src/data/evidence.json) é validado pelo
[contrato de evidências](../../src/lib/evidence-catalog.ts). Cada registro preserva:

- ID estável, título, autores, ano, instituição, tipo de documento e situação editorial;
- pergunta, geografia, população, período estudado e método;
- classificação da inferência e justificativa editorial;
- síntese do resultado dos autores, limitações e fontes HTTPS com localização no documento;
- políticas relacionadas, aplicabilidade do estudo e justificativa do vínculo;
- indicadores relacionados, desfecho efetivamente estudado e limites da correspondência.

O contrato aceita pesquisas acadêmicas, estudos de impacto, notas técnicas, avaliações e
metodologias. Essa categoria não determina a classificação da inferência:

| Classificação | Significado |
|---|---|
| `descriptive` | Análise descritiva ou contábil; não identifica automaticamente um efeito causal total |
| `causal-estimate` | Estimativa dos autores com estratégia contrafactual; exige comparação e hipóteses explícitas |
| `methodological` | Referência de método; não é evidência empírica de efeito da política |

Não há nota de qualidade, agregação por governo, score político ou classificação automática
por instituição, título, desenho declarado ou direção do indicador. A classificação é uma
decisão editorial rastreável, não uma certificação das hipóteses. A plataforma não reproduz
as estimações dos estudos nesta fase. Efeitos numéricos não são transportados para as séries
do Margem nem usados como previsão individual.

Referências ausentes, duplicações, campos desconhecidos, datas impossíveis ou invertidas,
estudos posteriores à revisão, dados posteriores ao ano da publicação, ausência de fontes,
autoria ou limitações e classificação causal sem contrafactual/hipóteses interrompem a geração.
O build confere os vínculos contra o catálogo de políticas e os indicadores da publicação
resolvida. Metodologias não recebem período empírico; estudos empíricos exigem período e
desfecho. Essas verificações protegem o contrato; não demonstram validade científica.

## Aplicabilidade e curadoria inicial

Os vínculos distinguem `same-policy`, `historical-program` e `methodological`. Uma avaliação
da mesma política deve ter período que intercepte alguma vigência catalogada. A interseção
é uma condição necessária, não suficiente: versão legal, implementação, população e recorte
continuam exigindo conferência editorial. Um estudo antigo pode informar a investigação de
uma nova versão do programa, com essa diferença declarada; não avalia automaticamente a nova lei.

- [Ipea, TD 2499, 2019](https://www.ipea.gov.br/portal/images/stories/PDFs/TDs/td_2499.pdf):
  avaliação da distribuição da renda com e sem transferências; classificação contábil, não
  identificação de todas as respostas comportamentais na ausência do programa.
- [Melo, Starzec e Gardes, ANPEC 2016](https://www.anpec.org.br/encontro/2016/submissao/files_I/i5-15947443edc6e1498446b776165267a7.pdf):
  estratégia de diferenças em diferenças com pareamento. A ficha explicita tendências paralelas,
  comparabilidade, participação inferida e limites de dois cortes transversais.
- [Gertler e coautores, segunda edição, 2016](https://publications.iadb.org/en/impact-evaluation-practice-second-edition):
  referência metodológica para formular e interpretar avaliações; não avalia políticas do catálogo.

Os dois estudos empíricos antecedem a Lei nº 14.601/2023. As páginas os identificam como
estudos do programa histórico. O índice de insegurança alimentar do estudo também não é
apresentado como a taxa atualmente publicada no indicador. As outras três políticas iniciais
têm referência metodológica, sem estudo empírico catalogado nesta entrega.

A curadoria não é exaustiva. Ausência de estudo não significa ausência de pesquisa ou efeito.
Adicionar registros requer conferir a fonte original, o desenho, as hipóteses, as limitações,
o desfecho e a versão da política, atualizar a revisão editorial e revisar a síntese. Resultados
divergentes podem coexistir; não são consolidados em veredito automático.

## Integração e publicação

```text
/evidencias
/evidencias/:slug
/evidencias/catalogo.json
```

O índice explica os critérios e apresenta todas as fichas. Cada ficha mostra método,
contrafactual quando aplicável, resultado, limites, fontes e vínculos de volta às políticas
e aos indicadores. O [painel contextual](../../src/components/platform/EvidenceReading.astro)
aparece nas páginas de políticas e indicadores, com estado explícito de ausência de estudo.
Busca, filtro `Estudos e evidências`, catálogo HTML da busca, navegação da plataforma e Entenda
levam a essa camada. As relações da linha histórica continuam `contextual`.

O catálogo é editorial local e independente do manifesto imutável numérico. Não há migração,
job, acesso às fontes acadêmicas durante visitas ou alteração do contrato HTTP do backend.
Revisão, autoria e data de conferência editorial são visíveis separadamente da edição dos
indicadores. O JSON acompanha o deploy e não oferece consulta a revisões editoriais antigas;
elas ficam no histórico do repositório. Para identificar uma leitura, preserve a revisão
editorial e, quando houver dados, a publicação numérica indicada na página.

## Validação e limites

- [Unidades](../../tests/unit/evidence-catalog.test.ts): inferência, aplicabilidade histórica,
  tipos de documento, contrafactual obrigatório, integridade, períodos, fontes e seleção por vínculo.
- [Navegador](../../tests/evidence.spec.ts): fichas e catálogo sem JavaScript, navegação entre
  indicador/estudo/política, ausência de estudo, busca filtrada, JSON, metadados, canonical,
  dados estruturados, sitemap, rastreamento, largura, capturas e acessibilidade automática.
- [Build com API controlada](../../tests/content-build.spec.ts): edição numérica fixada também
  nas novas páginas, vínculos existentes, distinção do programa histórico e hipóteses visíveis.
- Suítes de cobertura, lint, tipos, build e regressão de páginas do projeto.

As verificações são locais; não comprovam indexação externa, compreensão por usuários,
operação remota ou validade causal dos estudos. A calculadora socioeconômica pertence à fase 20.
A [regra permanente de SEO e descoberta por IA](../../AGENTS.md) permanece obrigatória.
