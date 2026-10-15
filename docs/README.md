# Documentação do Margem

O Canal Margem está preparando a evolução do site editorial para uma plataforma de análise socioeconômica verificável. A entrega inicial cobre a fase 0 do roadmap: conhecer a base e organizar o contexto.

## Ordem de leitura

1. [Visão e fundamentos](01-project-vision.md): propósito, princípios e dimensões de análise.
2. [Product Design e UX](02-product-design.md): experiência pretendida, navegação e interpretação dos indicadores.
3. [Arquitetura técnica](03-technical-architecture.md): requisitos futuros para dados, proveniência e distribuição.
4. [Roadmap](04-roadmap.md): fases 0–23 e critérios do futuro MVP.
5. [Auditoria do frontend atual](systems/frontend.md): implementação observada, identidade reutilizável, limitações e próximo passo.

Os quatro documentos numerados partem dos textos fornecidos pelo responsável pelo projeto e receberam ajustes de clareza e precisão. Definem o produto planejado; o estado implementado está na auditoria do frontend. Valores, datas e fontes em exemplos de interface são ilustrativos, não dados apurados.

## Estado e limites

| Assunto | Estado nesta entrega |
|---|---|
| Site editorial Astro, conteúdo local e identidade visual | Implementado; inventariado na auditoria |
| Documentação central e roadmap | Organizados nesta fase |
| Gerenciamento de pacotes e qualidade | pnpm 11.22.0 e Biome 2.5.15 configurados; cobertura descrita no README |
| Design system da plataforma | Próxima fase; há componentes candidatos ao reaproveitamento |
| Indicadores, comparador e camada Entenda | Planejados |
| Banco, API de indicadores, ingestão e processamento | Planejados; tecnologias em aberto |
| Publicação e operação em produção | Não verificadas; sem configuração de deploy no repositório |

As rotas atuais são `/temas/:slug`, `/videos/:slug` e `/analises/:slug`. As rotas `/tema/:slug`, `/indicador/:slug`, `/comparar` e `/entenda/:slug` dos documentos são propostas futuras. A convivência entre temas editoriais e dimensões socioeconômicas precisa ser resolvida antes de alterar URLs ou navegação.

O conjunto sugerido de indicadores em UX é uma lista de candidatos. A fase 3 selecionará aproximadamente 10–15; o critério de MVP exige pelo menos 10. As camadas `Indicators`/`Derived Indicators` da arquitetura e `derived`/`published` do roadmap ainda são conceitos, não schemas distintos já definidos. A fase 2 deverá fixar nomes e relações. Exemplos de API com `:id` e `:slug` também não fixam o contrato final. Os metadados usam nomes provisórios diferentes: `dataset`/`source_dataset`, `revision_status`/`is_revised` e `version`/`calculation_version`. A fase 2 deverá definir os nomes e a semântica; um booleano de revisão não representa necessariamente todos os estados de `revision_status`.

O [manual de marca](brand/MARGEM_Manual_Marca_Conteudo_Site.md) define a direção visual, não certifica sua implementação. Diferenças observadas, limites de contraste e pendências do conteúdo de exemplo estão na [auditoria do frontend](systems/frontend.md).

## Organização

| Diretório | Uso |
|---|---|
| [brand](brand/MARGEM_Manual_Marca_Conteudo_Site.md) | Manual, tokens JSON e pranchas existentes; referência visual preservada |
| [research](research/README.md) | Investigações e hipóteses, separadas de decisões |
| [adr](adr/README.md) | Decisões técnicas com contexto, alternativas e consequências |
| [data-sources](data-sources/README.md) | Catálogo futuro das fontes externas |
| [systems](systems/README.md) | Componentes próprios e estado de implementação |

Manter detalhes de infraestrutura fora da visão e do documento de UX. Registrar decisões técnicas em ADR com as evidências que as sustentam. Documentos de sistemas devem distinguir implementação de proposta; investigações ficam em `research/`.

## Próxima entrega

Executar a fase 1 sobre a base existente: inventariar estados e variantes, consolidar tokens e primitives reutilizáveis e propor os primeiros componentes de indicador com dados explicitamente ilustrativos. Critérios: preservar o caráter editorial, verificar layouts em mobile e desktop, navegação por teclado e estados que não dependam só de cor. Banco, pipelines e integrações ficam para as fases correspondentes do roadmap.
