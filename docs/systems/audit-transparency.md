# Auditoria e transparência pública — fase 23

## Entrega

A fase torna a proveniência dos números navegável no produto. A página pública
[`/auditoria`](../../src/pages/auditoria.astro) reúne as edições ativadas e apresenta, para
cada recorte disponível, a cadeia indicador → cálculo → série/observação → dataset → fonte.
Páginas de indicador e navegação global apontam para essa trilha.

A trilha informa período, estado e valor publicado, metodologia, fórmula e versão de cada
etapa derivada, unidade, frequência, base temporal, fonte, capturas originais, horário de
coleta e SHA-256. Links identificam as entradas por papel e permitem consultar cada observação
e a série JSON da mesma publicação. Entradas de cálculos derivados também exibem suas fórmulas,
IDs, datasets, fontes e dependências.
O manifesto da edição expõe o escopo e o motivo de seleção; a captura original permanece
privada no armazenamento raw.

Sem `MARGEM_API_URL`, o site publica definições e informa que não há edição numérica fixada.
Com API configurada, a página inclui até 200 ativações recentes; edições anteriores continuam
disponíveis pelo cursor da API. A captura dessa página e das séries é validada durante o build;
falha ou divergência interrompe a geração. A página é HTML estático, sem JavaScript obrigatório, com
metadados e canonical da base compartilhada, links rastreáveis e inclusão normal no sitemap.

## Histórico de edições

`GET /api/v1/publications` lista ativações em ordem decrescente de geração, com paginação por
cursor. Cada item inclui geração, ID imutável da publicação, ativação, corte dos dados,
catálogo e motivo registrado. O endpoint consulta PostgreSQL por keyset de geração, limita
cada resposta a 200 itens e usa cache compartilhado curto; não carrega a tabela inteira por
requisição. O papel `margem_api` já possui leitura nas tabelas necessárias.

O histórico é de **edições publicadas pelo Margem**. Ele não enumera todas as revisões feitas
por uma fonte oficial, nem observações aceitas mas não publicadas. Uma revisão de fonte torna-se
visível quando uma edição posterior seleciona a observação aceita correspondente. Edições
ativadas anteriores continuam consultáveis pelo manifesto e pelo ID de publicação; uma mesma
publicação pode aparecer mais de uma vez se for reativada em outra geração.

O endpoint não retorna o identificador do operador. Expõe o motivo da ativação porque ele
documenta a decisão editorial. O manifesto é a referência para seleção, dependências, corte e
catálogo daquela edição. O endpoint de histórico é novo e não altera o contrato das consultas
versionadas existentes.

## Proveniência e limites

Os dados da página vêm da projeção pública e do catálogo versionado da publicação. O endpoint
JSON paginado oferece as observações publicadas; ele não substitui nem expõe os objetos raw privados.
As URLs de captura só viram links quando são HTTPS, não contêm usuário/senha, fragmento ou
parâmetros de nome sensível. SHA-256 identifica os bytes capturados, sem oferecer um download
desses bytes. Para uma observação derivada, a fórmula e os IDs das entradas permitem seguir a
linhagem, sem recalcular o resultado no navegador.

O corte da edição, o horário de coleta, o período de referência e a data de divulgação da fonte
são conceitos distintos. A interface mostra os três primeiros quando disponíveis e não infere
a data de divulgação se a fonte não a forneceu. A ausência de uma revisão em edições antigas
não demonstra que a fonte nunca revisou seus dados.

## Validação e operação

O build fixa uma publicação em todas as consultas. O histórico precisa começar pela mesma
geração, publicação e revisão de catálogo retornadas por `/publications/current`; gerações
repetidas ou fora de ordem e campos inválidos interrompem a captura. A API usa cursor opaco
associado ao limite e à geração, valida parâmetros desconhecidos e oferece ETag/HEAD como as
demais leituras públicas.

A validação local verifica lint, tipos Astro e build estático. Ela não confirma a publicação
remota, a disponibilidade Railway/R2, mudanças futuras nas fontes ou a indexação externa.
