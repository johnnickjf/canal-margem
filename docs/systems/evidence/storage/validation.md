# Validação da fase 6 — 17/10/2026

A fase 6 do [roadmap](../../../04-roadmap.md) define a arquitetura de armazenamento com
base na PoC. O desenho está em [Armazenamento](../../storage.md); a implementação vigente
continua sendo a PoC local da fase 5. Este registro distingue decisões documentais de
verificações dos serviços, ainda não implantados.

## Critérios e evidências

| Requisito | Evidência documental | Resultado |
|---|---|---|
| Base observada | [Medição](measurement.json), inventário de 20 arquivos locais, cinco corpos oficiais e replay offline | 587 observações em quatro séries; cobertura e limites explícitos |
| Banco principal e alternativas | [ADR-0001](../../../adr/0001-primary-database.md) | PostgreSQL 18/Railway; Turso, SQLite e NoSQL avaliados; analítico adiado |
| Object storage | [ADR-0002](../../../adr/0002-raw-object-storage.md) | R2 Standard privado com lock; bytes por hash e proveniência relacional |
| Histórico e cache | [ADR-0003](../../../adr/0003-data-versioning-and-cache.md) e contratos de dados | Imutabilidade na base retida, publicação transacional e cache HTTP; sem Redis inicial |
| Recuperação proporcional ao MVP | [ADR-0004](../../../adr/0004-retention-and-recovery.md) e [procedimento](../../storage.md#restauração-planejada) | Backup diário nativo Railway e reconstrução; sem cópia integral independente ou RPO/RTO fixos |
| Limites após desastre | ADR-0004, modelo e catálogo de operações | Aceita perda de versões; novas publicações não reutilizam IDs/URLs para conteúdo diferente; lacunas explícitas |
| Retenção operacional | ADR-0004 e ADR-0002 | Dependências preservadas; prazos mínimos de limpeza não removem locks nem autorizam exclusão nesta entrega |
| Hospedagem, custo e portabilidade | [ADR-0005](../../../adr/0005-hosting-and-portability.md) | Railway para API/jobs/banco; R2 separado; orçamento de referência de US$ 25/mês, sem gastos autorizados |
| Integração documental | Cinco ADRs, arquitetura, contratos, índices e roadmap | Estado aceito para implementação separado da operação observada |
| Continuidade da PoC | Critérios de migração e transição | Retirada depende do fluxo job → persistência → API verificado; nenhuma remoção antecipada |

## Evidências anteriores preservadas

Na elaboração e na revisão de fornecedores desta fase foram conferidos os tamanhos e
SHA-256 dos oito raw, quatro snapshots e oito arquivos de runs, além do snapshot atual,
seleção, lotes e vínculos raw. Os cinco corpos oficiais foram confrontados com o manifesto
da fase 5. A medição registra o inventário; não copia todos os arquivos ignorados pelo Git.

O replay offline e os testes locais de ingestão passaram: 41 testes em dois arquivos,
incluindo repetição, revisão, falhas de escrita e concorrência local. Esses testes não foram
repetidos na revisão de recuperação, que altera somente documentação, e não comprovam
PostgreSQL, R2 ou Railway. A versão anterior também passou em `pnpm check` e na conferência
de links. O rascunho de backup integral independente foi revisto antes de implantação.

## Revisão da política de recuperação

O MVP trata fontes públicas e não mantém login ou histórico pessoal de usuários. A revisão
retira o terceiro fornecedor de backup, dumps externos diários, manifesto conjunto e ensaio
mensal completo. Mantém backup nativo como conveniência e pipelines como caminho de
reconstrução, com perda de versões antigas aceita e sem promessa de recuperação em quatro horas.

As [fontes oficiais de backup Railway](https://docs.railway.com/volumes/backups) e
[preços](https://docs.railway.com/pricing) foram consultadas em 17/10/2026. O desenho considera
agendamento diário com retenção de seis dias, armazenamento incremental cobrado e restauração
restrita ao projeto/ambiente. Restaurar o banco não recupera automaticamente os objetos R2.

O cenário financeiro do ADR-0005 usa US$ 13,90 de consumo Railway, incluindo 1 GB-mês de
bytes únicos de backup; prevalece o mínimo Pro de US$ 20. R2 custa zero somente sob as
franquias e hipóteses declaradas. US$ 25/mês continua sendo referência, sem fatura medida
ou contratação autorizada.

**DONE no escopo documental.** A revisão delimitada conferiu política, contratos de histórico,
procedimento de recuperação, diagrama, custos e referências nos 16 documentos da fase 6
ou diretamente afetados; 15 receberam alterações nesta revisão.

- 177 links locais e 16 fragmentos válidos, incluindo referências ao procedimento de recuperação.
- Busca de inconsistências: menções remanescentes ao fornecedor de backup removido descrevem
  sua não adoção; não há exigência vigente de RPO de 24h ou RTO de 4h.
- Cenário aritmético conferido; SHA-256 de `measurement.json` idêntico ao anterior à revisão.
- `pnpm check` aprovado: Biome verificou 130 arquivos; Astro verificou 96, sem erros,
  warnings ou hints.
- `git diff --check` aprovado; arquivos Markdown novos também conferidos quanto a espaços
  no fim de linha. Nenhuma alteração de código ou arquivo preparado para commit.

Não há bloqueios conhecidos para esta entrega documental. Restauração e reconstrução em
serviços reais continuam como critérios de implementação, sem resultado operacional alegado.

## Complemento — requisitos de cache

A revisão do cache detalhou no [ADR-0003](../../../adr/0003-data-versioning-and-cache.md#requisitos-de-cache-para-implantação)
o domínio próprio do R2, a elegibilidade explícita dos JSONs, os headers de projeções e alias,
o bypass de administração/autenticação, a ausência de cache negativo e o CORS público.
[Armazenamento](../../storage.md) e o ADR-0005 foram alinhados. O cache do bucket não
configura o cache da API Railway; servir alias vencido permanece proibido.

As fontes oficiais da Cloudflare pesquisadas estão no ADR-0003. A auditoria documental
conferiu a separação das regras, as identidades/URLs, os TTLs e os critérios de implantação:
`HIT` com bytes corretos, convergência do alias em até 60 segundos, falha após expiração
sem origem, leitura fixada, recuperação de `404` após upload e CORS no navegador.

**DONE no escopo documental deste complemento.** `pnpm check` passou: Biome verificou
130 arquivos e Astro verificou 96, sem erros, warnings ou hints. Foram conferidos
181 links locais e 19 fragmentos nos documentos alterados ou novos da fase 6, além de
espaços no fim de linha e `git diff --check`. Nenhum serviço de cache foi configurado;
os testes de CDN/API/navegador descritos são critérios pendentes para a implantação.

## Limites da evidência

Não houve alteração de runtime, dependências, páginas, deploy ou dados da PoC. Não houve
provisionamento, migração SQL, importação definitiva, chamada ao R2, backup nativo configurado,
restauração remota ou benchmark de reconstrução. A implementação deve ensaiar restauração
e reconstrução, medir duração e perdas e validar referências antes de liberar publicações.

Build, navegador e testes de integração não foram repetidos: a entrega é documental.
Os diagramas Mermaid foram conferidos pelo fluxo, sem renderização gráfica. A regra de
SEO permanece aplicável às páginas públicas, que não foram alteradas. Nenhum commit,
push, contratação ou exclusão foi realizado.
