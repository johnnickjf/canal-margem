# Instruções permanentes do Canal Margem

## Regra obrigatória: SEO e descoberta por agentes de IA

Todas as páginas públicas destinadas à descoberta devem ser concebidas e mantidas com foco em SEO, para que motores de busca, indexadores e agentes de IA possam encontrar, ler e compreender o projeto e seu conteúdo de forma eficiente. Este é um requisito permanente de produto e um critério de aceitação de alterações nas páginas.

**Esta regra nunca deve ser perdida, removida, enfraquecida ou tratada como opcional em refatorações, redesigns, migrações, mudanças de arquitetura ou atualizações da documentação.** Ao reorganizar instruções ou documentos, preserve explicitamente esta regra e sua referência no README. Instruções locais de subdiretórios devem mantê-la. Qualquer alteração deste requisito exige orientação explícita do responsável pelo projeto.

Ao criar ou alterar páginas, layouts, conteúdo, navegação ou configuração de publicação:

- Entregue o conteúdo principal e os links relevantes em HTML acessível sem depender da execução de JavaScript. Use HTML semântico, hierarquia coerente de títulos, texto descritivo e alternativas textuais para imagens informativas.
- Defina título e descrição adequados a cada página, URL canônica correta e metadados de compartilhamento. Preserve URLs estáveis e links internos rastreáveis; planeje redirecionamentos quando URLs publicadas mudarem.
- Mantenha sitemap e `robots.txt` coerentes com o domínio e as rotas públicas. Não introduza bloqueios acidentais de rastreamento ou `noindex` em conteúdo destinado à descoberta. Páginas privadas, de erro ou utilitárias podem ter exclusões justificadas.
- Inclua dados estruturados compatíveis com o conteúdo quando aplicáveis, sem inventar informações. Torne explícitos a identidade do projeto, autoria, datas, fontes e contexto quando pertinentes, para facilitar a interpretação por pessoas e agentes de IA.
- Preserve acessibilidade, desempenho e legibilidade do conteúdo ao evoluir a interface. Use a base compartilhada de SEO em `src/components/layout/Seo.astro` e `src/layouts/BaseLayout.astro`, ou preserve suas responsabilidades se a arquitetura mudar.

Antes de concluir alterações que afetem esses pontos, verifique o HTML gerado das páginas afetadas, os metadados, as URLs canônicas, os links internos, os dados estruturados aplicáveis e a configuração de sitemap e rastreamento. Informe o que foi validado e o que depende de publicação; uma validação local não comprova indexação externa.

## Continuidade das instruções

Estas instruções complementam as instruções aplicáveis dos diretórios superiores. Consulte também o [README](README.md) e o [índice de documentação](docs/README.md). Preserve a regra de SEO e descoberta em toda evolução do site editorial e da futura plataforma Margem.
