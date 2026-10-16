# Testes e cobertura

O projeto verifica a lógica compartilhada com Vitest e o site gerado com Playwright. Lint, tipos e build fazem parte da validação completa. A cobertura numérica descrita aqui pertence aos testes unitários; não mede templates Astro nem a execução dos fluxos no navegador.

## Comandos

Requer Node 22.13 ou superior e pnpm 11.22.0, conforme o [README](../../README.md). A CI usa Node 24.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium  # primeira instalação local
pnpm test:unit                         # Vitest, sem medir cobertura
pnpm test:coverage                     # Vitest, relatório e limites por módulo
pnpm test:e2e                          # lint, tipos, build e Playwright
pnpm test                              # cobertura + test:e2e
pnpm test:e2e:ui                        # interface do Playwright; requer build existente
```

`pnpm check` executa Biome e Astro check. `pnpm build` executa check antes de gerar `dist/`. O Biome cobre apenas o frontmatter dos arquivos Astro, conforme descrito no README. Relatórios gerados ficam fora do Git e da checagem de tipos.

## Testes unitários

A configuração está em [vitest.config.ts](../../vitest.config.ts); os testes ficam em [tests/unit](../../tests/unit).

| Módulo | Contratos verificados |
|---|---|
| `presentation-date.ts` | Formato YYYY-MM-DD, calendário, anos bissextos, datas inválidas e preservação do dia em UTC |
| `format.ts` | Datas editoriais e ISO, mudança de dia/ano por fuso, códigos de episódio, índices, durações de vídeo e tempo de leitura |
| `headline.ts` | Destaque no começo, meio e fim, texto sem destaque, marcação incompleta, acentos e versão sem colchetes para metadados/busca |

Vitest e o provider V8 ficam fixados na mesma versão. Os testes usam o fuso `America/Sao_Paulo`, para detectar regressões que troquem UTC pelo fuso local.

### Medição e limites

O relatório inclui **todos os arquivos TypeScript em `src/lib/` e `src/scripts/`**, inclusive módulos não importados pelos testes. Arquivos que contêm somente tipos não têm instruções executáveis a cobrir. Configuração, dados, schemas, páginas e componentes Astro ficam fora desse denominador.

A medição inicial de 15/10/2026, com 46 testes unitários, foi:

| Escopo | Linhas | Instruções | Funções | Ramificações |
|---|---:|---:|---:|---:|
| `src/lib/format.ts` | 100% | 100% | 100% | 100% |
| `src/lib/headline.ts` | 100% | 100% | 100% | 100% |
| `src/lib/presentation-date.ts` | 100% | 100% | 100% | 100% |
| Total de `src/lib/` e `src/scripts/` | 10,58% | 9,49% | 11,45% | 10,11% |

Após essa medição, foram fixados limites de **100% em cada uma das quatro métricas, individualmente nos três arquivos críticos**. Não existe meta global de cobertura. Reduções nesses arquivos fazem `pnpm test:coverage` falhar; ampliar uma função exige testar também seus novos caminhos.

`content.ts`, `torn.ts` e os scripts do cliente ainda não têm cobertura unitária. Alguns de seus comportamentos são exercitados pelo build e pelo Playwright, mas essas execuções não entram no relatório V8 dos testes unitários. O percentual total baixo explicita essa diferença; não significa que os testes de navegador falharam.

Artefatos disponíveis em `coverage/`:

- `index.html`: navegação por arquivo e linhas não executadas;
- `coverage-summary.json`: métricas totais e por módulo;
- `lcov.info`: formato para ferramentas de análise;
- tabela no terminal: resumo da execução.

Os limites usam a [configuração oficial do Vitest](https://vitest.dev/config/coverage), com `include` explícito e thresholds por arquivo. Não há integração com serviços externos de cobertura.

## Navegador e build editorial

[playwright.config.ts](../../playwright.config.ts) define dois perfis Chromium: desktop e Pixel 5 emulado. Um terceiro projeto, `build`, executa a integração de conteúdo apenas uma vez. O preview serve o build local na porta 4322; é possível usar um Chromium existente via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

| Suíte | O que verifica |
|---|---|
| [Design system](../../tests/design-system.spec.ts) | Estados, abas, tooltip, foco e teclado, modais/drawers, URLs e nova aba, formulários, acesso sem JavaScript, overflow, movimento reduzido e axe |
| [Editorial](../../tests/editorial.spec.ts) | Menu mobile por teclado, fechamento e retorno de foco, navegação e mudança para desktop; busca com/sem acentos, ausência de resultados, limpeza e recuperação por temas |
| [Build de conteúdo](../../tests/content-build.spec.ts) | Publicação e exclusão de rascunhos de episódios, cortes e análises; índice de busca, sitemap, RSS e metadados das páginas |

A suíte do design system também inspeciona o HTML de todas as páginas de `dist/`: conteúdo principal, h1, título, descrição, canonical, links locais, sintaxe do JSON-LD e sitemap, além de `robots.txt`. Preserva a [regra permanente de SEO e descoberta por IA](../../AGENTS.md). A verificação de links não visita destinos externos nem valida todos os fragmentos internos.

O teste de build copia fontes e configuração para uma pasta temporária, reutiliza as dependências instaladas e cria seis publicações de teste: uma publicada e uma em rascunho para cada tipo. Os rascunhos são destacados e datados no futuro para exercitar seleção e ordenação. O teste verifica que seus identificadores não aparecem em nenhum HTML, XML ou índice de busca gerado; os controles publicados precisam continuar presentes. A cópia é removida ao final, mesmo quando há falha. O conteúdo editorial e o build principal não recebem essas publicações.

O RSS deve ter XML válido, identidade do canal, somente episódios e análises publicados, links únicos, ordem decrescente de datas e títulos, descrições, datas e canonicals coerentes com as páginas. Os exemplos incluem acentos e `&` para verificar a serialização XML. Cortes ficam no site e na busca, mas fora do feed.

Na execução completa são 34 testes de navegador (17 cenários em dois perfis) e uma integração de build. Capturas e traces ficam em `test-results/`; a CI também gera `playwright-report/`. Capturas não têm comparação automática com uma imagem de referência.

## Integração contínua

O workflow [Testes](../../.github/workflows/tests.yml) está configurado para cada PR, push e acionamento manual. Ele instala o pnpm da versão em `packageManager`, usa o lockfile congelado, prepara Chromium com dependências de sistema, executa coverage e depois lint, tipos, build e Playwright. Não precisa de secrets; a permissão do token é apenas leitura do conteúdo do repositório.

Relatórios, capturas e traces são guardados por 14 dias, inclusive em falhas, se a execução não for cancelada. A CI impede `test.only`, permite uma nova tentativa dos testes Playwright e cancela execuções anteriores do mesmo PR/ref quando chega uma atualização.

O workflow foi validado localmente com actionlint. Sua execução no GitHub depende de essas alterações serem commitadas e enviadas; a configuração não torna o check obrigatório para merge por si só. Nenhuma regra de proteção de branch foi alterada.

## Limites

Não há testes Firefox, WebKit ou em aparelhos físicos, cobertura de todos os fluxos editoriais, comparação visual automática ou execução contra produção. Axe e navegação por teclado fornecem evidências parciais de acessibilidade; não substituem avaliação assistiva. Os testes locais de SEO não comprovam indexação externa. Fórmulas, fontes reais e pipelines ainda não existem nesta fase.
