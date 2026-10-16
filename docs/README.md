# Documentação do Margem

O Canal Margem está preparando a evolução do site editorial para uma plataforma de análise socioeconômica verificável. A base inclui a documentação da fase 0, o design system da fase 1 e o modelo conceitual dos dados da fase 2.

## Ordem de leitura

1. [Visão e fundamentos](01-project-vision.md): propósito, princípios e dimensões de análise.
2. [Product Design e UX](02-product-design.md): experiência pretendida, navegação e interpretação dos indicadores.
3. [Arquitetura técnica](03-technical-architecture.md): requisitos futuros para dados, proveniência e distribuição.
4. [Roadmap](04-roadmap.md): fases 0–23 e critérios do futuro MVP.
5. [Auditoria do frontend atual](systems/frontend.md): implementação observada, identidade reutilizável, limitações e próximo passo.
6. [Design system](systems/design-system.md): tokens, componentes básicos e de indicadores, estados e validação da fase 1.
7. [Testes e cobertura](systems/testing.md): suíte unitária, navegador, build editorial, medição por módulo e CI.
8. [Modelo conceitual dos dados](systems/data-model.md): entidades, relações, identidade de séries, metadados, revisões e linhagem de cálculos; exemplos fictícios em JSON.
9. [Operações e consistência](systems/data-operations.md): catálogo de leituras e escritas, aceitação de lotes, publicação, idempotência, concorrência e consulta histórica pública/interna.

Os quatro documentos numerados partem dos textos fornecidos pelo responsável pelo projeto e receberam ajustes de clareza e precisão. Definem o produto planejado; a auditoria do frontend registra a fase 0, e os documentos de sistemas registram as entregas posteriores. Valores, datas e fontes em exemplos são ilustrativos, não dados apurados.

## Estado e limites

| Assunto | Estado nesta entrega |
|---|---|
| Site editorial Astro, conteúdo local e identidade visual | Implementado; inventariado na auditoria |
| Documentação central e roadmap | Organizados nesta fase |
| Gerenciamento de pacotes e qualidade | pnpm 11.22.0 e Biome 2.5.15 configurados; cobertura descrita no README |
| Testes automatizados e CI | Vitest com cobertura e limites por módulo; Playwright para componentes, fluxos editoriais e build; workflow preparado, execução remota ainda não verificada |
| Design system da plataforma | Implementado na fase 1; referência em `/design-system`, com exemplos fictícios |
| Modelo conceitual dos dados | Especificado na fase 2, com exemplos de revisão e derivação e catálogo de operações/consistência; sem schema executável ou persistência |
| Indicadores, comparador e camada Entenda | Planejados |
| Banco, API de indicadores, ingestão e processamento | Planejados; tecnologias em aberto |
| Publicação e operação em produção | Não verificadas; sem configuração de deploy no repositório |

As rotas atuais são `/temas/:slug`, `/videos/:slug` e `/analises/:slug`. As rotas `/tema/:slug`, `/indicador/:slug`, `/comparar` e `/entenda/:slug` dos documentos são propostas futuras. A convivência entre temas editoriais e dimensões socioeconômicas precisa ser resolvida antes de alterar URLs ou navegação.

O conjunto sugerido de indicadores em UX é uma lista de candidatos. A fase 3 selecionará aproximadamente 10–15; o critério de MVP exige pelo menos 10. O [modelo da fase 2](systems/data-model.md) fixa `dataset`, `revision_status`, `methodology_version` e `calculation_version`, distingue revisão de atualização e define `derived` como observações calculadas e `published` como projeção validada de observações externas ou derivadas. Essas camadas não determinam schemas físicos. Exemplos de API com `:id` e `:slug` também não fixam o contrato final.

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

Executar a fase 3: selecionar aproximadamente 10–15 indicadores do MVP, com justificativa de relevância, compreensão, comparabilidade e viabilidade de manutenção. Usar o modelo da fase 2 para distinguir conceito, série, recortes e derivados; o catálogo detalhado de fontes pertence à fase 4. Banco, pipelines e integrações ficam para as fases correspondentes do roadmap. A [regra permanente de SEO e descoberta por IA](../AGENTS.md) deve ser preservada em todas as fases.
