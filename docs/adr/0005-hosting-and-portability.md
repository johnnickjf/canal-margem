# ADR-0005 — Railway para o backend e portabilidade por protocolos

- Status: aceito para implementação; serviços e despesas ainda não provisionados.
- Data: 17/10/2026.
- Escopo: hospedagem inicial de jobs/API/PostgreSQL, leitura pública e orçamento de referência.

## Contexto

O Margem prevê muitas leituras de séries agregadas e escritas em background, com atualizações
espaçadas. A PoC mediu quatro séries e 587 observações, sem benchmark do MVP inteiro.
Custo e portabilidade são critérios da escolha. O deploy deve acomodar jobs Node e API
separados sem exigir acesso a um mesmo arquivo local ou serviços específicos de uma grande cloud.

## Alternativas

| Arranjo | Consequência |
|---|---|
| Railway + PostgreSQL na Railway + R2 | Banco e aplicações na rede privada; menos fornecedores no fluxo transacional e cobrança por recursos efetivamente usados |
| Railway + Neon + R2 | PostgreSQL com redução a zero pode economizar em uso intermitente; acrescenta tráfego externo, outra região/conexão e cobrança própria. Não presumir economia se o banco ficar ativo continuamente |
| Railway + Turso Cloud + R2 | Franquia atraente e SQL remoto; exige adaptação de precisão e validação dos contratos. Concorrência da engine nova ainda aparece como preview no material oficial do Cloud consultado |
| Railway + SQLite local + R2 | Menos serviços; exige um dono do arquivo acessado por API e volume persistente. Limitações de réplicas e redeploy do volume passam a afetar o serviço que o possui |
| VPS + PostgreSQL + R2 | Dá controle de hospedagem e pode reduzir a fatura direta; transfere manutenção do host, deploy, rede e recuperação para a equipe |

## Decisão

Hospedar API, jobs de ingestão e PostgreSQL na Railway. Manter banco e consumidores na mesma
região e usar conexão PostgreSQL pela rede privada. A seleção da região exige conferir
disponibilidade e latência na implantação, sem presumir região brasileira. PostgreSQL 18
deve ter imagem e versão verificadas; atualização de major exige migração e restauração testadas.

Começar com um nó de banco e sem failover automático, aceitando interrupções conforme o ADR-0004.
A API não compartilha o volume do banco. Jobs executam por fonte e terminam após concluir;
o agendamento inicial usa cron da Railway, sem fila ou Redis obrigatórios. A implementação
define horários, timeouts e exclusão de execuções sobrepostas, preservando idempotência.

Usar R2 Standard para raw privado e um bucket separado para projeções públicas autorizadas.
Publicar resumos e séries em arquivos JSON com URLs por publicação. Gerar e conferir os
artefatos e registrar seus localizadores, tamanhos e hashes no banco antes de selar e ativar
o manifesto; uma publicação só pode apontar para arquivos prontos. Não sobrescrever URLs
por publicação. Regenerar uma projeção na mesma URL exige recuperar o contexto original e
reproduzir o hash registrado; sem isso, publicar sob nova identidade, conforme o ADR-0004.
O alias atual continua resolvido pela autoridade PostgreSQL via API, com cache de até 60s.
Não usar um segundo ponteiro no object storage como autoridade concorrente. Artefatos por
publicação podem ter cache de até um ano, conforme o ADR-0003.

O domínio próprio conectado ao bucket público e a Cache Rule que torna JSON elegível são
requisitos de implantação; manter `r2.dev` desabilitado em produção. Headers, regras separadas
para projeções e alias, CORS e testes de `HIT`/expiração seguem os
[requisitos do ADR-0003](0003-data-versioning-and-cache.md#requisitos-de-cache-para-implantação).
A conexão do bucket exige a zona na mesma conta Cloudflare. Configurar cache compartilhado
para o alias da API é uma etapa própria; o cache do R2 não cobre o serviço Railway.

Comparações e auditorias que não couberem nas projeções usam API e consultas indexadas.
Uma visita não dispara coleta nem recalcula todo o histórico. O frontend Astro continua
estático; cada build fixa uma publicação para HTML e dados. A hospedagem do site editorial
não é alterada nesta entrega e permanece sujeita ao [requisito de SEO](../../AGENTS.md).

Deploy usa processos Node em contêineres portáveis, migrações SQL versionadas e configuração
por variáveis de ambiente. O acesso a dados usa protocolo PostgreSQL e cliente S3 com
endpoint/bucket configuráveis. Configuração da Railway, locks R2 e agendamento ficam separados
da lógica do domínio. Não exigir APIs Neon, bindings Workers ou serviços Atlas no backend.

Usar backup nativo diário do volume PostgreSQL na Railway, com retenção de seis dias, e
reconstrução pelos pipelines, conforme o ADR-0004. Não duplicar integralmente os objetos
em outro fornecedor. `pg_dump` continua disponível para migrações planejadas, sem job
obrigatório de dump externo diário.
Migração de hospedagem exige restaurar PostgreSQL, copiar/verificar objetos e reproduzir os
jobs; domínio, contratos da API e identidades das publicações não mudam. Isso reduz o custo
de saída técnica, sem prometer migração instantânea ou ausência de dependências operacionais.

## Custos e orçamento de referência

Preços públicos consultados em 17/10/2026, em dólares, sujeitos a alteração:

| Serviço | Base de cobrança |
|---|---|
| Railway | RAM US$ 10/GB-mês; CPU US$ 20/vCPU-mês; volume US$ 0,15/GB-mês; saída US$ 0,05/GB |
| Planos Railway | Hobby: mínimo de US$ 5/mês; Pro: US$ 20/mês. O mínimo é abatido do consumo, sem somá-lo novamente |
| R2 Standard | US$ 0,015/GB-mês; US$ 4,50/milhão classe A; US$ 0,36/milhão classe B; saída direta gratuita |
| Franquia R2 | 10 GB-mês, 1 milhão classe A e 10 milhões classe B por mês, compartilhados conforme a conta |
| Backup nativo Railway | Incremental; bytes únicos retidos cobrados ao mesmo preço dos volumes, sem franquia presumida |

Hobby atende à validação controlada; Pro é a referência para a operação pública. A contratação
do plano e os limites de consumo só ocorrem na implantação. Adotar **US$ 25/mês como orçamento
de referência inicial do backend, raw e backup nativo**, com aviso em US$ 20 e revisão se excedido.
Esse valor é um objetivo de dimensionamento, não autorização de gastos, teto automático ou
fatura comprovada. Domínio, hospedagem editorial, impostos e câmbio ficam fora desse orçamento.

Exemplo aritmético, sem equivaler a capacidade medida: média agregada de 1 GB de RAM e
0,05 vCPU para banco, API, jobs e restauração temporária; 5 GB-mês de volumes, 1 GB-mês de
bytes únicos de backup e 40 GB de saída somam
`10 + 1 + 0,75 + 0,15 + 2 = US$ 13,90` de consumo Railway. No Pro, prevalece o mínimo de US$ 20.
Com 10 GB-mês de R2 e operações dentro das franquias disponíveis, o R2 custa zero nesse exemplo.
Total ilustrativo: US$ 20/mês, antes dos itens excluídos do orçamento.

O backup nativo é incremental: medir os bytes únicos retidos, sem multiplicar automaticamente
o banco vivo pelo número de cópias. RAM/CPU são médias somadas no mês, não limites de processos.
Validar essas hipóteses durante a fase 7, incluindo picos de ingestão e verificação por leitura
dos objetos. API respondendo ao visitante e uploads originados na Railway geram saída
na Railway, mesmo quando o destino R2 não cobra entrada. Não extrapolar os bytes da PoC
para arquivos ANP ou expansão geográfica ainda não medidos.

## Consequências e limites

A rede privada reduz tráfego externo no caminho API/jobs → banco. Arquivos cacheáveis
retiram do banco parte das leituras públicas e permitem manter o backend pequeno.
PostgreSQL traz um custo contínuo de serviço; Neon/Turso ficam como alternativas registradas,
sem outra PoC como pré-condição para implementar o MVP.

No cenário Pro acima, o consumo está abaixo do mínimo de US$ 20: retirar o PostgreSQL em
favor de um banco gratuito externo não elimina esse mínimo enquanto o backend permanecer
na Railway Pro. Pode haver economia no Hobby ou acima do mínimo; ela depende do consumo
real. A escolha atual prioriza precisão, integridade e um fornecedor a menos no caminho
transacional, sem afirmar que PostgreSQL será sempre mais barato que Turso.

O template PostgreSQL inicial não implica alta disponibilidade, PITR configurado ou backup
independente. Conferir responsabilidades da plataforma, alertas e recuperação antes de operar.
R2 precisa de locks próprios; o backup nativo deve ser configurado e sua restauração ensaiada.
Perda do projeto/volume ou dos objetos pode exigir reconstrução com perda de versões antigas.
Não há RPO/RTO fixos nem garantia de reprodução integral do histórico após desastre.
Indisponibilidade do banco pode impedir ativações e consultas dinâmicas; publicações estáticas
já disponíveis continuam legíveis quando seus arquivos e a CDN estiverem acessíveis.

Reavaliar hospedagem se o custo observado exceder o orçamento após dimensionamento e cache,
ou se latência, disponibilidade e carga medida não cumprirem os objetivos do produto.
Trocar a hospedagem PostgreSQL é a primeira alternativa antes de migrar o modelo para outra
engine. Turso volta à comparação se custo ou requisitos de banco embarcado/offline justificarem.

## Evidências e validação

Fontes oficiais: [preços Railway](https://docs.railway.com/pricing),
[PostgreSQL Railway](https://docs.railway.com/databases/postgresql),
[volumes](https://docs.railway.com/volumes/reference),
[cron](https://docs.railway.com/cron-jobs),
[preços R2](https://developers.cloudflare.com/r2/pricing/),
[publicação e cache R2](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[backups nativos Railway](https://docs.railway.com/volumes/backups),
[preços Neon](https://neon.com/pricing) e [preços Turso](https://turso.tech/pricing).

A implantação deve provar rede privada, execução dos jobs, publicação com artefatos íntegros,
restauração nativa e reconstrução pelos pipelines, registrando duração e perdas. Validar
também a portabilidade por migração planejada para outro PostgreSQL. Medir consumo e latência,
configurar alertas e registrar a fatura observada. Nenhum serviço foi contratado, implantado
ou medido nesta entrega documental.
