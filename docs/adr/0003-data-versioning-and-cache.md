# ADR-0003 — Histórico imutável e cache por publicação

- Status: aceito para implementação; não há publicação de indicadores em execução.
- Data: 17/10/2026.
- Escopo: versionamento, seleção pública e cache do MVP.

## Contexto

A repetição real da PoC reutilizou observações e lote, mas escreveu outro snapshot completo.
`accept` mantém predecessores; `expose` retorna `publication: null`. Capturas da PoC usam
run como vintage sem identificar ordem oficial de edições. O [modelo](../systems/data-model.md)
e o [catálogo de operações](../systems/data-operations.md) exigem identidade permanente,
distinção entre conhecimento interno e público e leitura fixada por publicação.

## Alternativas

| Alternativa | Consequência |
|---|---|
| Sobrescrever valor e limpar cache | Perde revisão e pode misturar dados novos com cálculo antigo |
| Snapshot JSON completo por coleta | Preserva o recorte experimental; replica todo o estado e não implementa catálogo/publicação |
| Observações imutáveis e seleção por manifesto | Preserva história e fixa dependências sem copiar todo o banco; exige tabelas de seleção e validação |
| Redis desde o início | Mais um serviço para invalidar e recuperar; nenhuma carga medida o exige |

## Decisão

Manter observações aceitas, lotes, métodos, revisões de catálogo e manifestos selados imutáveis
no PostgreSQL. Correção/revisão acrescenta identidade e justificativa. A chave lógica de
observação continua `(series, reference_period.start, reference_period.end, vintage)`.
Mesma chave/conteúdo reutiliza o registro; divergência conflita, inclusive entre jobs distintos.

Vintages identificam edição por evidência da fonte ou conteúdo e contexto; runs identificam
tentativas. Não promover edição antiga por ter chegado depois. A fase 7 deve fixar por dataset
como resolver ordem e ambiguidade; sem evidência, não anunciar ordem oficial. Correção local
de normalização exige edição própria rastreável, sem sobrescrever aceitação anterior ou
se apresentar como revisão da fonte; seu identificador fica para a implementação do pipeline.

Manifestos fixam catálogo, corte, escopo, observações e inputs transitivos. Não duplicam
os valores; selecionam IDs preservados. A ativação ocorre numa transação com lock da linha
do canal, geração e ativação-base esperadas, evento e ponteiro. Retorno é outra ativação.
Recibo de idempotência e efeito são confirmados juntos; replay não avança geração.

Usar cache HTTP inicialmente. Chaves incluem publicação, revisão de catálogo, operação,
filtros, ordenação e cursor. Alias atual tem validade máxima de 60 segundos, sem uso de alias
vencido em erro; conteúdo explicitamente imutável por publicação pode ter validade de um ano.
O cliente fixa a publicação depois de resolver o alias. Operação administrativa que confirma
ativação lê a autoridade, sem cache. Invalidação acelera propagação, sem ser requisito para
consistência de respostas já fixadas. Não introduzir Redis ou cache analítico no MVP.

As projeções de resumos e séries serão arquivos JSON em bucket R2 separado do raw privado,
conforme o [ADR-0005](0005-hosting-and-portability.md). Preparar e verificar esses arquivos,
registrando localizadores, tamanhos e hashes no banco antes de selar e ativar o manifesto.
As URLs por publicação não podem ser sobrescritas. Uma projeção perdida só pode voltar à
mesma URL se o contexto original e todas as dependências necessárias forem recuperados
e os bytes regenerados corresponderem ao hash registrado. Não há backup independente desses objetos.
O alias atual é resolvido pela API a partir do PostgreSQL;
não manter outro ponteiro autoritativo no bucket. Consultas não cobertas pelas projeções
continuam na API, sempre fixadas à publicação.

### Requisitos de cache para implantação

Servir as projeções por HTTPS em domínio próprio estável conectado ao bucket R2 público.
A zona deve estar na mesma conta Cloudflare do bucket. Desabilitar o acesso `r2.dev` em
produção; esse endpoint é destinado a desenvolvimento e não oferece o cache necessário.
O raw permanece privado, sem acesso pelo domínio das projeções.

Criar Cache Rule restrita ao hostname e ao prefixo das projeções, por exemplo
`/publications/`, tornando JSON elegível para cache. JSON não é cacheado por padrão.
Respeitar os headers da origem para TTL de borda e navegador; não aplicar um TTL global
que alcance alias, erros ou operações administrativas.

| Recurso | Header `Cache-Control` | Comportamento exigido |
|---|---|---|
| JSON imutável por publicação, resposta bem-sucedida | `public, max-age=31536000, immutable` | Cache de até um ano; identidade completa na URL |
| Alias público de publicação atual, resposta bem-sucedida | `public, max-age=0, s-maxage=60, must-revalidate` | Navegador revalida; cache compartilhado pode reutilizar por até 60 segundos |
| Administração, respostas autenticadas e erros da API | `no-store` | Bypass de cache compartilhado |

O caminho da projeção identifica publicação e versão da representação. Catálogo, seleção
e bytes ficam fixados pelo manifesto e seu hash. Nova publicação ou representação recebe
nova URL. Nas consultas dinâmicas, filtros, ordem e cursor que alterem a resposta integram
a chave; preservar inicialmente todos os parâmetros da query, sem regras que os ignorem.

O alias continua na API Railway. Se receber cache compartilhado, sua elegibilidade exige
regra própria no domínio da API, separada da regra do R2. Manter Origin Cache Control e
desabilitar recursos que sirvam alias vencido, incluindo stale-while-revalidate,
stale-if-error e Always Online nesse caminho. Não impor Edge Cache TTL ou Browser Cache TTL
que substitua essa política. Preservar `Date` e `Age` entre caches, sem reiniciar a validade
ao repassar uma resposta. Depois da expiração, falha de revalidação retorna erro; o cliente
não usa o alias vencido para iniciar outra leitura. Leituras já fixadas continuam no seu contexto.

Não armazenar respostas `4xx`/`5xx` nas rotas de dados. Na API, retornar `no-store`;
na CDN, configurar ausência de armazenamento por status também para erros originados no R2,
cujos headers não são os metadados de um objeto existente. Impedir que overrides de cache
apliquem TTL longo a erros. Uma consulta antes do upload não pode conservar um `404` após
o objeto estar pronto. Requisições autenticadas e administrativas devem ter bypass explícito,
mesmo se uma regra de elegibilidade mais ampla for adicionada posteriormente.

Configurar CORS antes da primeira publicação: projeções integralmente públicas permitem
origem `*`, métodos `GET`/`HEAD` e leitura sem credenciais. Expor `ETag`, `Age` e
`CF-Cache-Status` para diagnóstico pelo navegador. O TTL de preflight é independente
do TTL dos dados. Mudança de CORS exige purge dos objetos afetados já presentes na CDN.

Purge não é necessário a cada ativação, pois as URLs são imutáveis; o alias converge pelo
seu TTL. TTL não garante permanência na CDN: expulsão do cache pode provocar nova leitura
do R2. Não usar cache como cópia de recuperação ou garantia de disponibilidade.

## Consequências e limites

Retenção inclui a cadeia de dependências e seleções históricas. Preparação pode atrasar
disponibilização; derivadas pendentes são explicitamente indisponíveis, sem reutilizar saída
com input antigo. Caches podem servir uma publicação anterior completa até vencer seu prazo.
Indisponibilidade da publicação pedida retorna erro; nunca troca silenciosamente para a atual.

Essas garantias valem para a operação normal e o histórico retido. Após desastre, o
[ADR-0004](0004-retention-and-recovery.md) admite perda de versões e publicações. Reconstrução
sem o contexto original cria nova publicação, sem reutilizar IDs/URLs antigos para conteúdo
diferente ou inventar eventos históricos.

Os TTLs são decisões para a futura API, sem headers, carga ou propagação medidos. Metadados
operacionais continuam separados da publicação. Páginas estáticas futuras devem fixar a mesma
publicação no HTML e nos artefatos de dados e preservar URLs históricas e
[SEO/descoberta](../../AGENTS.md). Não há migração de páginas nesta fase.

## Evidências e validação

O desenho concretiza G01–G10 do catálogo, especialmente G03–G08 e G10. Na implementação,
executar os treze cenários S01–S13, incluindo dois publicadores, timeout após commit,
paginação após ativação, retorno e derivada com input revisado. Comparar contagens e IDs
da importação com a [medição](../systems/evidence/storage/measurement.json). A fase 6 revisou
esse mapeamento; não executou transações ou cache de produção.

Na implantação, comprovar também:

- Uma projeção conhecida produz `CF-Cache-Status: HIT` após aquecimento na mesma borda,
  com `Age` e os bytes esperados; conferir SHA-256 após decodificar compressão de transporte.
- Uma nova ativação é resolvida em nova consulta ao alias em até 60 segundos, sem somar
  novamente esse prazo em cada cache; origem indisponível após expiração produz erro.
- Uma leitura fixada, inclusive paginação, mantém a publicação anterior após outra ativação.
- Um `404` anterior ao upload não impede a leitura assim que o objeto estiver pronto;
  erros, administração e respostas autenticadas não são reutilizados pelo cache compartilhado.
- O frontend lê projeções pelo navegador com CORS válido, tanto em resposta de origem quanto
  em `HIT`. Conferir os headers com `Origin` e a atualização após mudança de CORS e purge.

Fontes oficiais consultadas em 17/10/2026:
[domínio próprio e cache R2](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[comportamento padrão do cache](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/),
[Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/),
[Origin Cache Control](https://developers.cloudflare.com/cache/concepts/cache-control/),
[CORS no R2](https://developers.cloudflare.com/r2/buckets/cors/) e
[diagnóstico de cache](https://developers.cloudflare.com/cache/concepts/cache-responses/).
Essas fontes fundamentam os requisitos; nenhum domínio, regra ou header foi configurado nesta fase.
