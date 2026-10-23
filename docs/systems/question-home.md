# Home orientada a perguntas — fase 11

A home começa com “O que você quer entender?”. Cinco perguntas em linguagem cotidiana
substituem a abertura centrada no vídeo editorial. A pessoa escolhe uma pergunta, chega ao
tema correspondente e pode abrir um indicador no segundo clique.

| Área | Pergunta | Destino |
|---|---|---|
| Trabalho e renda | Estou trabalhando mais e ganhando melhor? | `/tema/trabalho-e-renda` |
| Custo de vida | Meu dinheiro compra mais ou menos? | `/tema/custo-de-vida` |
| Vida financeira | Quanto da minha renda está indo para dívidas? | `/tema/vida-financeira` |
| Qualidade de vida | As condições de vida estão melhorando? | `/tema/qualidade-de-vida` |
| Economia e Estado | A economia do país está ficando mais forte ou mais frágil? | `/tema/economia-e-estado` |

## Implementação

[PlatformEntry.astro](../../src/components/platform/PlatformEntry.astro) define as perguntas
editoriais e os destinos das cinco dimensões, seguindo o [desenho de UX](../02-product-design.md).
Cada cartão é um link completo com a área e a pergunta no nome acessível. A lista está em
uma navegação identificada, com foco visível e uma, duas ou três colunas conforme a largura.
Os links e o conteúdo principal estão no HTML gerado, sem depender de JavaScript.

[index.astro](../../src/pages/index.astro) coloca essa entrada antes dos vídeos, cortes, temas
editoriais, manifesto, análises, newsletter e contato. A abertura anterior deixa de ser
renderizada na home. As URLs editoriais permanecem acessíveis. Há também links diretos para
vídeos, análises e o guia de leitura dos dados.

A home apresenta perguntas, sem antecipar respostas quantitativas ou prometer uma conclusão
sobre a situação individual do leitor. A nota de disponibilidade continua ligada à publicação
fixada no [build do shell](platform-shell.md). Sem API configurada, as mesmas perguntas levam
às definições dos indicadores, com aviso de indisponibilidade de valores. Com API configurada,
as páginas continuam usando a mesma edição; a home não faz consultas no navegador.

## Verificação e limites

`pnpm test:e2e` verifica lint, tipos, build e navegação em desktop/celular. Os testes em
[home.spec.ts](../../tests/home.spec.ts) cobrem as cinco jornadas até indicadores sem
JavaScript, a ordem de foco e a abertura por teclado, conteúdo editorial, ausência de overflow,
acessibilidade automática, título, descrição, canonical, Open Graph e dados estruturados da
organização. A home conserva a base compartilhada `BaseLayout`/`Seo` e a
[regra permanente de descoberta](../../AGENTS.md).

O teste isolado de [content-build.spec.ts](../../tests/content-build.spec.ts) também verifica
a home com uma publicação controlada da API, seus destinos locais, sitemap e identificação
da edição. `robots.txt` continua permitindo rastreamento. Os testes usuais de build verificam
que os rascunhos editoriais continuam excluídos.

A implementação permite testar a hipótese de navegação por perguntas. Ela não comprova
compreensão ou facilidade de uso por pessoas reais: isso exige observar usuários. Indexação
externa e publicação remota também não foram verificadas. As [páginas temáticas da fase 12](theme-pages.md) enriquecem os destinos dessas perguntas.
As [páginas de indicador da fase 13](indicator-pages.md) acrescentam gráficos e tabelas históricas.
O [comparador interativo](comparator.md) está implementado na fase 16.
