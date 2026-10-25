# Observabilidade e operação — fase 22

## Estado e limite

A fase implementa sinais locais para a API e os pipelines: métricas Prometheus, prontidão
da publicação, logs estruturados de duração dos jobs e o comando `monitor`, que falha quando
uma fonte ou série viola os critérios de saúde já definidos. Esses sinais permitem conectar
o serviço a um coletor e a um alerta de execução sem acoplar o domínio a um fornecedor.

Railway, R2, CDN, coletor e frontend publicado ainda não estão configurados. O comando
`monitor` pode enviar eventos a um webhook HTTPS por `MARGEM_ALERT_WEBHOOK_URL`; sem essa
variável, fornece resultado e código de saída para o scheduler notificar em falhas. Nenhuma
integração ou notificação remota está ativa nesta fase. Nenhum SLA ou limite de capacidade de
produção é afirmado.

## Sinais da API

`GET /healthz` confirma que o processo HTTP está respondendo. É um sinal de liveness: não
consulta o PostgreSQL, a publicação atual ou o armazenamento de objetos.

`GET /readyz` consulta a ativação atual no PostgreSQL. Retorna 200 quando existe uma publicação
ativa naquele instante e 503 quando o banco não responde ou o canal ainda não tem publicação.
Não baixa nem revalida o objeto da projeção no R2; as consultas da API verificam hash e tamanho
ao carregar a projeção. Portanto, `/readyz` não substitui uma consulta sintética de leitura.

`GET /metrics` expõe texto Prometheus sem cache:

| Métrica | Leitura |
|---|---|
| `margem_http_requests_total` | Requisições por rota fixa, método e classe de status HTTP |
| `margem_http_request_duration_seconds` | Histograma de duração por rota, método e classe de status |
| `margem_process_uptime_seconds` | Tempo desde o início do processo |
| `margem_go_goroutines` | Goroutines atuais |
| `margem_go_heap_alloc_bytes` | Heap Go alocado no instante da coleta |
| `margem_snapshot_cache_requests_total` | Acertos, misses, cargas coalescidas e falhas do cache local |
| `margem_snapshot_cache_entries` | Projeções atualmente retidas no cache local |
| `margem_snapshot_cache_serialized_bytes` | Tamanho serializado retido, conforme o limite do cache |

As métricas não incluem IP, query string, IDs de publicação ou caminhos recebidos. Rotas
desconhecidas são agregadas em `not_found`; métodos desconhecidos em `other`. Contadores e
histogramas vivem na memória e reiniciam com o processo. Cada réplica mantém seus próprios
valores. O tamanho serializado do cache não é medida do heap decodificado.

O endpoint `/metrics` passa pelos limites de tráfego e concorrência da API, sem receber
tratamento especial que possa ser usado para contorná-los. Restrinja sua exposição à rede do
coletor ou à borda de confiança. Não configure proxies para reescrever IPs de clientes com
cabeçalhos não confiáveis; a API continua limitando o endereço da conexão.

## Saúde de fontes e alerta de dados

Execute:

```bash
pnpm pipeline monitor
```

O comando emite JSON com `checked_at`, `status`, `alert_delivery` e o relatório por fonte.
Retorna 0 quando todas estão saudáveis e 1 quando falta sucesso recente, a execução mais
recente falhou, há série aberta atrasada ou falta uma série requerida. Erros de conexão,
consulta ou entrega do alerta também retornam código diferente de zero. O comando usa somente
PostgreSQL e as leituras concedidas ao papel de worker; não acessa nem altera raw, objetos ou
publicações.

Quando `MARGEM_ALERT_WEBHOOK_URL` está definida, `monitor` envia um POST JSON com o alerta
`margem_source_freshness`, chave estável `margem_source_freshness`, estado `firing` ou
`resolved`, horário e relatório. O receptor deve atualizar o alerta pela chave em vez de criar
uma notificação nova a cada execução. Exige URL HTTPS sem credenciais embutidas ou fragmento;
usa timeout de cinco segundos, não segue redirecionamentos e não registra a URL. Uma resposta
fora de 2xx faz o check falhar. O evento `resolved` é enviado em cada checagem saudável, então
o receptor também deve tratar eventos repetidos de forma idempotente. Sem webhook, configure
o scheduler para alertar pelo código de saída. Use somente um desses caminhos para evitar
notificações duplicadas.

Se a consulta de saúde ao PostgreSQL falhar, o webhook recebe `firing` com `check_error` contendo
a classe segura da falha; o comando continua retornando código diferente de zero. Se a entrega
do webhook também falhar, o erro de consulta e a falha de entrega aparecem no JSON de stderr.

Os limites de frescor e cadência estão em
[Pipelines do MVP](pipelines.md#agendamento-e-observabilidade): duas cadências para a execução
bem-sucedida, além dos limites por frequência (semanal 21 dias, mensal 90 dias, VF1 120,
trimestral 200 e anual 1.100). São tolerâncias operacionais iniciais, não prazos prometidos
pelas fontes oficiais. O relatório também mostra execução mais recente, último sucesso,
cobertura, séries ausentes e atrasadas.

Na implantação, configure um scheduler separado para executar `monitor` periodicamente com
`DATABASE_URL` do worker. Um intervalo horário permite detectar falhas de coleta ou atraso de
publicação do job sem esperar outra coleta manual. O cron atual continua executando `tick`; não
substitua esse comando pelo monitor. Configure `MARGEM_ALERT_WEBHOOK_URL` ou notificação de
falhas do job na plataforma escolhida. Sem uma dessas configurações, há diagnóstico no
JSON/logs, mas não há entrega automática de alerta.

Os jobs registram início, resultado, duração, fonte, contagens e classe segura do erro em
JSON no stderr; seus eventos e recibos continuam em `ops.event` e `ops.run`. Cada resposta
externa registrada no evento `fetch` inclui status HTTP, bytes, tentativa e duração da chamada
mais leitura do corpo. Falhas de transporte e leitura usam `fetch_failed` com duração e tipo
do erro; URLs ficam no histórico operacional para diagnóstico. A aceitação transacional
mantém a última cobertura válida. A coleta só tenta fontes durante o job: não são feitas
sondagens externas extras que possam consumir limites ou confundir indisponibilidade com atraso
de divulgação.

## Rotina de resposta

1. Leia `sources[].latest`, `sources[].last_success`, `missing_series` e `stale_series` no
   resultado de `monitor`.
2. Consulte os eventos e capturas da execução no banco; `fetch` mostra status e latência,
   `fetch_failed` registra falha de transporte/leitura e o erro do job distingue timeout,
   cancelamento e falha de qualidade, sem expor corpos de respostas em logs.
3. Depois de corrigir a causa, execute `pnpm pipeline run --source FONTE` para reconciliar
   aquela fonte; o comando manual força uma nova execução. Não promova dados automaticamente.
4. Execute `pnpm pipeline monitor` novamente e `pnpm pipeline verify` quando a investigação
   envolver objetos raw. Uma ingestão saudável não ativa uma publicação nova.
5. Para API, compare erros e latência em `/metrics`, verifique `/readyz` e faça uma leitura
   sintética com um ID de publicação conhecido. Para o site estático, configure uma checagem
   externa da URL canônica; o build não fornece telemetria de disponibilidade do host.

Comece coletando duração, taxa de erros, latência, heap, goroutines, acertos do cache e saúde
das fontes. Defina SLOs e limiares de latência após observar tráfego e carga reais. A fase não
configura CDN, alertas de custo, tracing distribuído, analytics de usuário ou monitoramento de
indexação externa.

## Validação e segurança operacional

O endpoint de métricas usa nomes de rota limitados, não caminhos arbitrários; as leituras
operacionais não contêm credenciais nem perfis da calculadora. O acesso de `monitor` depende
do papel `margem_worker`, já usado pelos jobs; não conceda DDL nem escrita em dados aceitos.
O comportamento local pode ser compilado e exercitado sem criar serviços remotos. A execução
real dos alertas, Railway/R2, disponibilidade do frontend e indexação externa só pode ser
confirmada depois da implantação.
