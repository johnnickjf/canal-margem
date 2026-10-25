# Escala e performance — fase 21

A fase 21 mede o custo local das leituras, implementa cache de projeções verificadas e
remove a varredura completa de IPs do limitador. A hipótese é que reutilizar uma edição
imutável reduz trabalho repetido sem mudar seleção, valores, auditoria ou privacidade.
Não há tráfego de produção disponível nem infraestrutura remota implantada. Os ensaios
abaixo sustentam estas mudanças locais, sem definir capacidade pública ou SLA.

## Medição reproduzível

```bash
pnpm bench:backend
```

O [benchmark](../../backend/internal/api/performance_test.go) usa o handler HTTP real,
resposta paginada de 50 pontos de uma capital e projeções sintéticas com 100, 6.375 e
20 mil recortes mensais distribuídos por 27 capitais. O recorte de 6.375 reproduz a ordem
de grandeza da coleta da fase 7, não seus dados. Os 20 mil recortes exercitam o limite
de escopo, mas não todas as combinações possíveis de dependências, cálculos ou metadados.
Cada cenário é executado três vezes por pelo menos 300 ms por amostra.

`PublicationAPI/decode=true` inclui SHA-256 e decodificação completa em cada requisição;
`decode=false` isola consulta e serialização sobre um snapshot já decodificado.
`CachedPublicationAPI/cold=false` usa o cache real aquecido; `cold=true` cria um cache
vazio por requisição e inclui sua alocação. O rate cap por IP é desabilitado nesses
benchmarks para medir CPU, mantendo o guard e a paginação. `RateLimiter` mede um IP já
conhecido com 1, mil e 10 mil janelas ativas, sem expiração durante a medição.

Resultados de 25/10/2026, Go 1.26.6, Linux amd64, Ryzen 7 5700, GOMAXPROCS 16:
[antes](evidence/performance/before.txt), na base `961c0ae` acrescida do benchmark,
e [depois](evidence/performance/after.txt). Medianas de tempo:

| Recortes | Projeção | Antes, decodificando sempre | Cache frio | Cache aquecido | Alocações por consulta aquecida |
|---|---:|---:|---:|---:|---:|
| 100 | 89.892 bytes | 1,15 ms | 1,19 ms | 0,093 ms | 0,059 MB |
| 6.375 | 4.494.942 bytes | 53,79 ms | 52,61 ms | 0,918 ms | 0,774 MB |
| 20.000 | 14.059.692 bytes | 161,46 ms | 171,61 ms | 1,243 ms | 1,214 MB |

Alocações são os bytes alocados por operação (`B/op`), não memória residente ou RSS.

Para 6.375 recortes, o caminho aquecido reduz o tempo de CPU em cerca de 98% e as
alocações por requisição de aproximadamente 12,26 MB para 0,77 MB. O caminho frio
continua decodificando tudo e não recebe essa melhora. No maior cenário, ficou cerca
de 6% mais lento que a base; são apenas três amostras curtas, sem garantia estatística.

| IPs ativos | Limitador antes | Limitador depois |
|---|---:|---:|
| 1 | 126,7 ns | 75,1 ns |
| 1.000 | 11.591 ns | 79,2 ns |
| 10.000 | 108.602 ns | 79,2 ns |

Estes são microbenchmarks sequenciais: não incluem PostgreSQL, S3, TLS, rede, CDN,
percentis de latência ou carga concorrente de produção. Testes de integração separados
comprovam o fluxo PostgreSQL/LocalStack, mas não dimensionam esses serviços.

## Cache de projeções no processo

O comando `serve` habilita [SnapshotCache](../../backend/internal/publications/cache.go).
Definir `API_SNAPSHOT_CACHE=false` desativa o cache para diagnóstico; valor inválido
impede a inicialização. A CLI de publicação e ativação continua verificando o objeto
diretamente, sem reutilizar esse cache.

Fluxo de cada leitura:

1. Validar o ID e consultar no PostgreSQL se a publicação já foi ativada.
2. Buscar a projeção por localizador, SHA-256 e tamanho registrados no banco.
3. Em acerto, emprestar o snapshot decodificado, somente para leitura.
4. Em falta, carregar pelo armazenamento, conferir tamanho/hash e decodificar JSON.
5. Reter somente sucesso, com validade de 60 segundos desde o carregamento.

A verificação de hash/tamanho permanece no adaptador `ProjectionStore`, inclusive S3.
O cache pertence a uma instância desse adaptador; não compartilha buckets ou credenciais.
Mantém no máximo duas edições e soma de até 16 MiB em **tamanhos serializados**. A
expulsão usa acesso mais recente; acertos não prorrogam a validade. Entradas expiradas
são removidas no próximo acesso, portanto um processo ocioso pode mantê-las em memória.
O orçamento não é um limite de heap: mapas, strings e estruturas decodificadas custam
mais. Requisições em andamento podem manter referências a
edições expulsas; até oito consultas simultâneas continuam permitidas pelo guard.

Carregamentos simultâneos da mesma chave são reunidos em um só. O mutex não fica
preso durante I/O; outras chaves podem carregar em paralelo. Um aguardante pode cancelar
sem interromper o primeiro. Cancelar o primeiro cancela a carga compartilhada; os demais
recebem o erro e podem tentar novamente. Erros, JSON inválido e cargas canceladas não
ficam no cache. Expiração seguida de objeto ausente/corrompido retorna 503/no-store,
sem servir conteúdo vencido ou trocar de publicação.

Um objeto removido no armazenamento pode continuar legível por até 60 segundos enquanto
seus bytes verificados estiverem válidos no processo. Esse cache não é backup. A
ativação administrativa sempre exige o objeto íntegro. Após reinício, o cache está vazio.
Cada réplica teria seu próprio cache; nenhuma coordenação distribuída foi adicionada.

`Resolve` consulta o banco em todas as chamadas: não há cache do alias atual/histórico.
IDs nunca ativados continuam invisíveis, mesmo que seus bytes estejam em memória.
HTML, cursores e comparações continuam fixados por publicação. O cache guarda apenas
dados públicos da edição; corpo, perfil e resultado da calculadora não entram nele.
Respostas pessoais continuam `no-store`, sem ETag. Os contratos HTTP de cache,
ETag, HEAD, CORS e erros permanecem os da [API](api.md).

Os consumidores de `Snapshot` devem tratar mapas, slices e ponteiros como imutáveis.
Os handlers atuais criam resultados e listas separados; não alteram a edição compartilhada.
Isso evita uma cópia profunda por leitura, mas exige preservar esse contrato em novos handlers.

## Limitador de tráfego

As janelas fixas de um minuto são inseridas numa fila de expiração. Cada IP sai uma vez,
na ordem em que entrou. Consultar um IP conhecido não percorre as demais janelas; criar
IP aloca um registro e um elemento da fila. Uma expiração em massa ainda pode remover
até 10 mil entradas em uma chamada. A tabela e a fila permanecem limitadas a 10 mil IPs.
Rate cap de 120/minuto, mutex, identidade pelo IP da conexão e respostas 429 são preservados.
Cabeçalhos de proxy não identificam clientes finais; a configuração de borda continua
necessária na implantação.

## Avaliação das alternativas do roadmap

| Opção | Decisão nesta fase | Evidência para reconsiderar |
|---|---|---|
| CDN | Manter o contrato estático e os requisitos do ADR-0003; implantação pendente | Tráfego público e teste de HIT/MISS/expiração, domínio, CORS e chaves incluindo query/publicação |
| Edge cache | Mesmo contrato da CDN, sem runtime adicional na borda | Latência regional medida e custo de misses na origem |
| Response cache | Reusar snapshots verificados; adiar cache de respostas completas/Redis | Perfil mostrando serialização dominante após acertos, com chave incluindo operação, filtros, paginação e publicação; excluir perfis e erros |
| Materialized views | Projeções por edição já materializam o conjunto; sem nova view SQL | Planos e tempos SQL mostrando gargalo após reduzir cargas repetidas |
| Precomputation | Preservar engine e projeções preparadas antes da ativação | Comparações/cálculos dominando CPU, com conjunto de consultas repetidas identificado |
| Réplicas | Não adicionar | Saturação medida da instância primária após índices/consultas e orçamento revisados; resolver consistência da ativação |
| Filas | Manter jobs separados da API e locks por fonte | Backlog, duração e concorrência de jobs exigindo retries/distribuição além do scheduler atual |
| Processamento incremental | Preservar lotes idempotentes; não criar novo executor incremental | Medição de custo de reprocessar histórico e dependências afetadas por revisão |
| Banco analítico dedicado | Manter PostgreSQL | Workload analítico sustentado afetando consultas públicas e falhando após ajustes medidos |

Sem uso remoto observado, não há evidência para contratar essas camadas. O gargalo
de decodificação local justifica o cache limitado e reversível. Se misses, volume ou
heap excederem o orçamento operacional, medir leitura seletiva/projeções particionadas
antes de aumentar os limites. Ativação, dependências e auditoria precisam continuar na
mesma edição em qualquer alternativa.

Na implantação, coletar taxa e mistura de rotas, tamanho das edições, acertos/misses,
latência p50/p95/p99, 429/503, CPU, RSS/heap, pool SQL, tempo/bytes de objetos e custo.
Comparar frio/aquecido e saturação de oito consultas; registrar hardware, duração e erros.
Só então definir SLOs e capacidade. Instrumentação contínua e alertas são a fase 22.

## Verificação e limites da entrega

`pnpm test:backend` verifica gofmt, vet e testes com detector de corridas. Com serviços
configurados e `REQUIRE_INTEGRATION=1`, inclui o
[ensaio de isolamento do cache](../../backend/integration/performance_test.go): uma só
leitura S3 para duas consultas iguais, mesmos bytes/ETag, publicação preparada invisível,
alias atualizado após ativação, edição antiga preservada e 503 em cache frio sem objeto.
Os testes unitários exercitam orçamento, LRU, teto de entradas, validade sem renovação,
falhas, cancelamento, concorrência, chave por hash/tamanho e expiração de IPs.
O teste HTTP concorrente também confere que os handlers preservam o snapshot compartilhado
e que a calculadora continua sem cache/ETag. Em 25/10/2026, passaram gofmt, vet e testes
com `-race`, incluindo PostgreSQL/S3 local com `REQUIRE_INTEGRATION=1`, além de `pnpm build`
(Biome, checagem Astro e 87 páginas estáticas) e conferência dos links locais alterados.

O frontend permanece estático e usa a mesma API; esta fase não modifica páginas, rotas
ou metadados. A [regra permanente de SEO e descoberta](../../AGENTS.md) continua obrigatória.
Build e checagem local não comprovam indexação externa. Railway, R2 remoto, CDN,
capacidade de produção e custos continuam não verificados.
