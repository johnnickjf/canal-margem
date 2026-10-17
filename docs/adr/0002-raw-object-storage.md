# ADR-0002 — Cloudflare R2 para os originais de coleta

- Status: aceito para implementação; nenhum bucket criado.
- Data: 17/10/2026.
- Escopo: raw e metadados de integridade; recuperação no ADR-0004.

## Contexto

`ingest`, em `src/ingestion/pipeline.ts`, preserva cada corpo recebido antes de interpretá-lo.
A [medição](../systems/evidence/storage/measurement.json) encontrou oito objetos, 18.584 bytes;
as demais fontes ainda não foram medidas. Os originais precisam sobreviver à máquina da
ingestão e manter bytes verificáveis. Custo de transferência e possibilidade de trocar o
fornecedor fazem parte da decisão, junto das garantias de escrita.

## Alternativas

| Alternativa | Adequação e custo |
|---|---|
| Filesystem do job | Simples localmente; exige volume persistente, compartilhamento e backup para jobs separados |
| Bytes no PostgreSQL | Facilita transação única; aumenta dump/restauração e mistura arquivos com consultas relacionais |
| Amazon S3 | Escrita condicional, versionamento e políticas detalhadas; saída cobrada conforme região/destino e dependências de IAM |
| Cloudflare R2 Standard | API compatível com S3, saída direta gratuita e franquia mensal; sem versionamento S3, com bucket locks próprios |
| Railway Buckets | Integração com o deploy, operações e saída do bucket gratuitas; não oferece independência de fornecedor em relação ao backend |
| Outro provedor compatível com S3 | Alternativa de portabilidade; o MVP não exige um terceiro fornecedor para backup integral |

## Decisão

Usar Cloudflare R2 Standard em bucket privado, por cliente S3 com endpoint configurável.
Não exigir Workers ou bindings Cloudflare no código de ingestão. Esta escolha substitui
o rascunho Amazon S3 desta mesma entrega ainda não commitada; não há serviço a migrar.
Custos e hospedagem estão no [ADR-0005](0005-hosting-and-portability.md).

Preservar bytes exatos, inclusive corpos de erro e metadados usados na validação, sem
reformatação. O caminho padrão é `raw/sha256/<hash>`. Gravar por `PutObject` com
`If-None-Match: *`; conflito exige ler o objeto e conferir tamanho e SHA-256 antes de
reutilizá-lo. ETag e metadado de hash enviado pelo cliente não comprovam, sozinhos, integridade.
Confirmar os bytes persistidos antes da aceitação, com leitura e hash calculado pela aplicação.

Habilitar bucket lock por prazo indeterminado no prefixo `raw/` antes da primeira coleta.
A ingestão recebe somente acesso a objetos do bucket, sem administração das regras.
O lock deve impedir exclusão e sobrescrita mesmo se o código omitir a precondição.
Não presumir políticas IAM, versionamento, IDs de versão ou Object Lock da API S3 no R2.
A configuração do lock pertence ao provisionamento, separada do adaptador S3 da aplicação.

Para objetos que exigirem multipart, não presumir suporte à precondição de `PutObject`
em `CompleteMultipartUpload`. Usar chave exclusiva por tentativa sob
`raw/sha256/<hash>/<upload_id>`, protegida pelo mesmo lock. Conferir o objeto completo antes
do commit e selecionar um localizador canônico no banco por hash. Repetições consultam esse
registro; uploads concorrentes podem deixar cópias extras retidas. Esse caminho exige ensaio
real antes de habilitar uma fonte que ultrapasse o limite de upload simples do serviço.

O banco registra localizador, hash, tamanho, fonte, dataset, edição, URL e horários.
Checksum identifica bytes; a identidade lógica de artefato/fonte/dataset/vintage continua
no banco. Conteúdos diferentes sob a mesma identidade lógica conflitam. Cada obtenção mantém
seus metadados, mesmo quando os bytes são reutilizados; não fabricar nova edição pela coleta.

Upload e conferência precedem aceitação, sem manter transação SQL durante downloads.
Falha de commit deixa no máximo objeto órfão; falha de upload impede aceitação. Objeto ausente
ou corrompido bloqueia nova publicação dependente. Uma nova consulta à fonte é outra captura,
com identidade e horários próprios; não substitui os bytes do artefato perdido sob o mesmo ID.
A recuperação segue o ADR-0004. Nenhum raw é público por padrão.

## Consequências e limites

O R2 não oferece o versionamento S3. Chaves imutáveis identificam os bytes; o lock protege
a operação contra exclusão e sobrescrita. Um administrador pode remover regras de lock.
O MVP aceita reconstruir a partir das fontes disponíveis se perder a conta ou os objetos,
com possível perda de versões antigas, conforme o ADR-0004. Não há cópia integral independente.

O lock inicial retém também falhas, órfãos e cópias multipart no prefixo protegido.
Os prazos do ADR-0004 são mínimos de elegibilidade para limpeza, não exclusões automáticas.
Não remover o lock para limpar arquivos; redesenhar a proteção e testar referências e corridas
antes de habilitar coleta de lixo. Monitorar esse crescimento e o custo de verificar objetos.

API S3 reduz o trabalho de trocar de fornecedor, mas locks e permissões precisam de
configuração equivalente no destino. Migrar exige copiar bytes, conferir hashes e atualizar
localizadores preservando identidades e publicações. R2 não implica ausência de dependência
de fornecedor. Provisionamento, credenciais e despesas não fazem parte desta entrega.

## Evidências e validação

Consultas oficiais de 17/10/2026: [compatibilidade S3 e condições de PutObject](https://developers.cloudflare.com/r2/api/s3/api/),
[bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/),
[permissões](https://developers.cloudflare.com/r2/api/tokens/) e
[preços](https://developers.cloudflare.com/r2/pricing/).
Alternativa: [Railway Buckets](https://docs.railway.com/storage-buckets/billing).

A implantação deverá provar duas gravações concorrentes, reutilização com hash correto,
conflito com bytes divergentes, upload interrompido, falha entre upload/commit e rejeição de
exclusão/sobrescrita pela credencial de ingestão, inclusive sem precondição. Para multipart,
testar tentativas paralelas e reconciliação de localizadores. A fase 6 conferiu a especificação;
esses testes de serviço permanecem para a implementação.
