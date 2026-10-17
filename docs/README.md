# Documentação do Margem

O Canal Margem está preparando a evolução do site editorial para uma plataforma de análise socioeconômica verificável. A base inclui a documentação da fase 0, o design system da fase 1, o modelo conceitual dos dados da fase 2, a seleção de indicadores da fase 3, o catálogo de fontes da fase 4 e a PoC local de ingestão da fase 5.

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
10. [Indicadores do MVP](systems/mvp-indicators.md): seleção revisada de 15 conceitos principais nas cinco dimensões, com alimentação, tempo de trabalho pelo piso, insegurança alimentar e moradia; contextos e entradas auxiliares separados.
11. [Mapa de fontes](research/source-map.md): evidências da revisão, fontes necessárias, investigações de renda/hora, Peic e inflação por faixa de renda, e fontes para expansão.
12. [Catálogo de fontes](data-sources/README.md): matriz dos 15 principais, contextos e inputs, cinco fichas, consultas e arquivos identificados, amostras reais e critérios para a PoC.
13. [Investigações da fase 4](research/phase-4-investigations.md): conclusões sobre renda/hora publicada pelo IBGE, acesso à Peic e histórico de inflação por renda do Ipea.
14. [PoC de ingestão](systems/ingestion.md): comandos, quatro séries IBGE/BCB, raw, validação, persistência local, revisões, exportação e evidências da fase 5.

Os quatro documentos numerados partem dos textos fornecidos pelo responsável pelo projeto e receberam ajustes de clareza e precisão. Definem o produto planejado; a auditoria do frontend registra a fase 0, e os documentos de sistemas registram as entregas posteriores. Exemplos do modelo e do design system são ilustrativos. As amostras em `data-sources/evidence/` são dados oficiais consultados na fase 4, com proveniência, sem integração ao site.

## Estado e limites

| Assunto | Estado nesta entrega |
|---|---|
| Site editorial Astro, conteúdo local e identidade visual | Implementado; inventariado na auditoria |
| Documentação central e roadmap | Organizados nesta fase |
| Gerenciamento de pacotes e qualidade | pnpm 11.22.0 e Biome 2.5.15 configurados; cobertura descrita no README |
| Testes automatizados e CI | Vitest com cobertura e limites por módulo; Playwright para componentes, fluxos editoriais e build; workflow preparado, execução remota ainda não verificada |
| Design system da plataforma | Implementado na fase 1; referência em `/design-system`, com exemplos fictícios |
| Modelo conceitual dos dados | Especificado na fase 2, com exemplos de revisão e derivação e catálogo de operações/consistência; especificação geral; a PoC implementa o recorte documentado de ingestão |
| Seleção de indicadores | 15 conceitos principais definidos na fase 3, mais contextos e inputs; fontes catalogadas na fase 4; quatro séries integradas na PoC, sem ampliar o escopo dos 15 |
| Catálogo de fontes | Fase 4 documentada: recortes e amostras oficiais conferidos, histórico observado e limites por fonte; investigações concluídas; sem comprovação de operação recorrente ou comparabilidade irrestrita |
| Páginas de indicadores, comparador e camada Entenda | Planejados |
| Ingestão e persistência local | PoC da fase 5 executada com quatro séries e 587 observações; revisões, repetição e falhas testadas |
| Banco definitivo, API de indicadores e processamento | Planejados; tecnologias em aberto |
| Publicação e operação em produção | Não verificadas; sem configuração de deploy no repositório |

As rotas atuais são `/temas/:slug`, `/videos/:slug` e `/analises/:slug`. As rotas `/tema/:slug`, `/indicador/:slug`, `/comparar` e `/entenda/:slug` dos documentos são propostas futuras. A convivência entre temas editoriais e dimensões socioeconômicas precisa ser resolvida antes de alterar URLs ou navegação.

O conjunto sugerido de indicadores em UX é uma lista de candidatos. A [seleção da fase 3](systems/mvp-indicators.md) fixa 15 conceitos principais; cesta e tempo por cesta têm recorte por capital. O critério de MVP exige pelo menos 10 indicadores disponíveis e tradução de preços em tempo de trabalho, cuja primeira entrega será a cesta na referência do salário mínimo. Isso está especificado, ainda sem cálculo executável. O [modelo da fase 2](systems/data-model.md) fixa `dataset`, `revision_status`, `methodology_version` e `calculation_version`, distingue revisão de atualização e define `derived` como observações calculadas e `published` como projeção validada de observações externas ou derivadas. Essas camadas não determinam schemas físicos. Exemplos de API com `:id` e `:slug` também não fixam o contrato final.

O [manual de marca](brand/MARGEM_Manual_Marca_Conteudo_Site.md) define a direção visual, não certifica sua implementação. Diferenças observadas, limites de contraste e pendências do conteúdo de exemplo estão na [auditoria do frontend](systems/frontend.md).

## Organização

| Diretório | Uso |
|---|---|
| [brand](brand/MARGEM_Manual_Marca_Conteudo_Site.md) | Manual, tokens JSON e pranchas existentes; referência visual preservada |
| [research](research/README.md) | Investigações e hipóteses, separadas de decisões |
| [adr](adr/README.md) | Decisões técnicas com contexto, alternativas e consequências |
| [data-sources](data-sources/README.md) | Catálogo da fase 4, matriz dos indicadores, fichas e evidências de acesso |
| [systems](systems/README.md) | Componentes próprios e estado de implementação |

Manter detalhes de infraestrutura fora da visão e do documento de UX. Registrar decisões técnicas em ADR com as evidências que as sustentam. Documentos de sistemas devem distinguir implementação de proposta; investigações ficam em `research/`.

## Próxima entrega

Avaliar a arquitetura de armazenamento da fase 6 com as [evidências da PoC](systems/ingestion.md): banco principal, raw/object storage, retenção, versionamento, cache e backups. Registrar decisões em ADRs, sem presumir que o filesystem da experimentação será a solução definitiva. Agendamento e integração dos demais indicadores seguem na fase 7. A [regra permanente de SEO e descoberta por IA](../AGENTS.md) continua obrigatória.
