# Shell da plataforma — fase 10

A fase 10 integra a plataforma ao site editorial Astro. A home integra
uma entrada para as cinco dimensões socioeconômicas. A [fase 11](question-home.md) evolui
essa entrada para perguntas no início da página, com as demais seções editoriais abaixo. A navegação compartilhada oferece
acesso aos temas, ao comparador e à explicação dos dados, inclusive sem JavaScript.

## Rotas e escopo

| Rota | Conteúdo |
|---|---|
| `/` | Entrada da plataforma e conteúdo editorial existente |
| `/tema/:slug` | Pergunta da dimensão e seus indicadores principais |
| `/indicador/:slug` | Definição, limitações, último período de cada série/geografia e origem |
| `/comparar` | Entrada do comparador, critérios de comparação e links de indicadores |
| `/entenda/como-ler-os-dados` | Períodos, revisão, ausência, preços, tempo e causalidade |

`/temas/:slug` continua sendo a rota dos 12 temas editoriais. `/tema/:slug` usa as cinco
dimensões do catálogo da API. Nenhuma URL editorial foi substituída. As páginas auxiliares
do catálogo também têm definição em `/indicador/:slug`, identificadas como medidas auxiliares.

O comparador interativo pertence à fase 16. A [fase 12](theme-pages.md) enriquece as páginas temáticas com resumos, mudanças e recortes.
A [fase 13](indicator-pages.md) acrescenta gráficos, tabelas históricas e a experiência de leitura
dos indicadores. A [busca de indicadores da fase 15](search.md) acrescenta aliases e filtros de conteúdo; a comparação interativa continua na fase 16. O shell não apresenta
controles que simulam essas funcionalidades.

## Publicação fixada no build

Com a API local ou remota já operando:

```bash
MARGEM_API_URL=http://127.0.0.1:8080 pnpm build
pnpm preview
```

`MARGEM_API_URL` recebe somente a origem HTTP(S), sem caminho, credenciais ou parâmetros.
Ela também pode ser exportada ao iniciar `pnpm dev`. Reiniciar o servidor de desenvolvimento
captura uma nova edição. A origem precisa ser alcançável pelos leitores para que os links
de consulta JSON funcionem; `127.0.0.1` serve apenas à verificação local.

A integração em [astro.config.mjs](../../astro.config.mjs) executa
[capturePlatform](../../src/lib/platform-build.ts) antes da geração das rotas:

1. Resolve `/api/v1/publications/current` uma vez.
2. Consulta o manifesto por ID e verifica publicação, revisão do catálogo e corte.
3. Pagina todas as opções de série/geografia de cada indicador, usando o ID fixado.
4. Obtém o resumo de cada recorte e confere o contexto de cada resposta.
5. Desde a fase 13, pagina o histórico de cada série/geografia e confere o último período
   contra o resumo, conforme as [páginas de indicador](indicator-pages.md).
6. Para cálculos derivados, consulta os inputs transitivos por ID de observação na mesma
   publicação. Reutiliza observações já consultadas e rejeita ciclos, profundidade acima de
   32 níveis ou respostas com outro ID/contexto.
7. Grava `.astro/margem-publication.json`, consumido por todas as páginas do build.

As consultas são sequenciais, com timeout de dez segundos por requisição. Um HTTP 429
permite uma tentativa adicional na mesma URL, quando `Retry-After` informa até 60 segundos.
Erro persistente, contexto divergente, cursor cíclico ou valor decimal inválido interrompe
o build. Não há troca silenciosa para outra publicação nem uso do arquivo de um build antigo.

Sem `MARGEM_API_URL`, o build substitui o arquivo por um catálogo sem observações: as cinco
dimensões e as definições locais do backend, com aviso de dados indisponíveis. Não representa
uma publicação ativada. Esse modo mantém o site editorial independente da disponibilidade
da infraestrutura. Uma API configurada com falha não aciona esse modo.

Os valores permanecem strings decimais; a apresentação troca apenas o separador decimal.
Cada número mostra unidade, período, geografia, fonte, dataset, método e origens disponíveis.
O último período ausente permanece ausente, sem procurar um número anterior. A nota da edição
informa ID e corte. Links de consulta de séries levam o mesmo `publication` do HTML.
Resultados derivados identificam o cálculo e sua versão, o período de comparação ou a base
do índice quando aplicáveis. A seção de fontes do cálculo apresenta os inputs, seus períodos,
fontes, datasets, URLs de origem e datas de coleta, com links JSON fixados na publicação.
O navegador não resolve o alias atual nem dispara ingestão.

Uma nova ativação da API não altera páginas já geradas: é necessário outro build e publicação
do site. O snapshot de trabalho fica ignorado pelo Git. A integração não provisiona Railway,
R2, CDN ou uma automação de rebuild.

## SEO e validação

As páginas usam `BaseLayout`/`Seo`, HTML estático, título, descrição, URL canônica,
metadados sociais e breadcrumbs estruturados. Sitemap inclui as novas rotas e continua
excluindo `/design-system`; `robots.txt` permanece liberando descoberta. A
[regra permanente de SEO](../../AGENTS.md) continua obrigatória.

```bash
pnpm test:coverage
pnpm test:e2e
```

Os testes unitários verificam fixação de contexto, paginação, falhas, ausência, precisão e
linhagem transitiva, incluindo inputs compartilhados, ciclos e respostas divergentes.
Playwright cobre navegação sem JavaScript, metadados, breadcrumbs, largura e acessibilidade
automática em desktop/celular. Um build isolado consulta uma API HTTP controlada cujo alias
muda após a primeira resolução: confere publicação no HTML, links locais, sitemap, decimal
sem perda de precisão, recálculo pendente, contexto de comparações/índices e fontes dos inputs.
O build editorial isolado continua verificando
rascunhos, busca e RSS.

Esses testes comprovam a integração local com respostas controladas. Operação com uma API
remota, atualização automática do site, indexação externa e validação assistiva manual não
foram verificadas nesta fase. A home orientada a perguntas está implementada na [fase 11](question-home.md).
As [páginas temáticas da fase 12](theme-pages.md) e as [páginas de indicador da fase 13](indicator-pages.md)
também estão implementadas. A [camada Entenda da fase 14](entenda.md) acrescenta conceitos
dedicados e painel contextual nos indicadores. A [busca da fase 15](search.md) integra indicadores, Entenda e acervo; a próxima entrega é o comparador da fase 16.
