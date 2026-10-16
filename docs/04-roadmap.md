# Margem — Roadmap

## Objetivo

Este documento organiza a evolução do Canal Margem do site editorial atual até uma primeira versão funcional da plataforma socioeconômica.

Ele descreve etapas e resultados esperados, não datas. Os valores numéricos nos exemplos são ilustrativos.

Cada etapa poderá posteriormente ser quebrada em milestones, issues e tarefas menores.

---

## Fase 0 — Conhecer e organizar o projeto existente

### Objetivo

Criar uma base segura para evolução sem perder o que já funciona.

### Trabalho

#### Auditoria do codebase

Levantar:

- stack;
- dependências;
- organização;
- rotas;
- componentes;
- estilos;
- design tokens;
- assets;
- build;
- testes;
- linting;
- deploy;
- CI/CD;
- analytics existentes;
- SEO existente.

#### Auditoria visual

Identificar:

- cores;
- tipografia;
- espaçamento;
- ícones;
- ilustrações;
- grid;
- padrões editoriais;
- componentes reutilizáveis.

#### Documentação

Adicionar:

```text
01-project-vision.md
02-product-design.md
03-technical-architecture.md
04-roadmap.md
```

Criar a estrutura dentro de `docs/`:

```text
research/
adr/
data-sources/
systems/
```

### Resultado esperado

O projeto existente está compreendido e documentado.

Nenhuma grande implementação nova é necessária nesta fase.

---

## Fase 1 — Fundação do produto e design system

### Objetivo

Transformar a identidade visual atual em uma base reutilizável para a futura plataforma.

### Trabalho

Identificar ou criar tokens para:

- cores;
- tipografia;
- spacing;
- radius;
- borders;
- shadows;
- breakpoints;
- largura de conteúdo;
- hierarquia textual.

Consolidar componentes básicos:

- Button;
- Link;
- Card;
- Container;
- Section;
- Heading;
- Tooltip;
- Drawer;
- Modal;
- Tabs;
- Badge;
- Search;
- Select;
- Skeleton;
- Empty State;
- Error State.

Criar os primeiros componentes específicos do Margem:

- IndicatorCard;
- SourceBadge;
- DataFreshness;
- MethodologyWarning;
- Trend;
- TimeRangeSelector;
- ExplanationDrawer.

### Resultado esperado

Os tokens e componentes editoriais existentes são consolidados e ampliados para formar o design system reutilizável da plataforma.

---

## Fase 2 — Modelo conceitual dos dados

### Estado

Especificada em [Modelo conceitual dos dados](systems/data-model.md), com [exemplos fictícios](systems/examples/data-model.json) de metadados, revisão histórica, ausência e cálculos derivados. O [catálogo de operações](systems/data-operations.md) complementa a fase com leituras, escritas e garantias de consistência, incluindo aceitação e publicação. A entrega é conceitual: não implementa schema executável, banco, ingestão ou engine. A próxima etapa é a seleção de indicadores da fase 3.

### Objetivo

Definir como o Margem entende indicadores antes de construir bancos e pipelines.

### Trabalho

Definir entidades como:

```text
Theme
Indicator
IndicatorSeries
Observation
Source
Dataset
Methodology
Geography
Unit
Policy
GovernmentPeriod
```

Definir relações.

Exemplo:

```text
Theme
  ↓
Indicator
  ↓
Series
  ↓
Observation
```

Definir metadados obrigatórios:

```text
value
unit
reference_period
geography
source
dataset
published_at
retrieved_at
methodology_version
vintage
revision_status
```

Definir como representar indicadores derivados.

Exemplo:

```text
renda por hora
tempo de trabalho por litro de gasolina
horas de trabalho por cesta básica
```

### Resultado esperado

Modelo conceitual independente de banco de dados ou framework.

---

## Fase 3 — Definição do MVP de indicadores

### Objetivo

Evitar começar tentando integrar centenas de séries.

Selecionar aproximadamente 10–15 indicadores que permitam validar o produto.

### Candidatos

#### Trabalho e renda

- rendimento real;
- rendimento por hora;
- salário mínimo real;
- horas trabalhadas;
- desemprego;
- informalidade.

#### Custo de vida

- IPCA;
- alimentação;
- cesta básica;
- gasolina;
- habitação.

#### Vida financeira

- comprometimento da renda;
- inadimplência ou endividamento.

#### Qualidade de vida

- pobreza;
- desigualdade.

#### Economia e Estado

- PIB per capita;
- dívida pública;
- investimento.

A lista definitiva deverá priorizar indicadores:

- compreensíveis;
- relevantes;
- historicamente comparáveis;
- com fontes confiáveis;
- tecnicamente simples de manter.

### Resultado esperado

Lista oficial dos indicadores do MVP.

---

## Fase 4 — Catálogo de fontes

### Objetivo

Mapear exatamente de onde virá cada dado do MVP.

### Trabalho

Criar documentação para as fontes necessárias.

Prováveis primeiras fontes:

```text
IBGE
Banco Central
Ipea
Tesouro Nacional
ANP
DIEESE
```

Para cada indicador:

```text
indicator
source
dataset
series_id
endpoint/file
frequency
historical_range
geographic_resolution
methodology
known_breaks
```

Criar uma matriz:

```text
Indicador
↓
Fonte
↓
Dataset
↓
Série
↓
Frequência
↓
Pipeline necessário
```

### Resultado esperado

Nenhum indicador do MVP existe sem uma fonte identificada.

---

## Fase 5 — Prova de conceito de ingestão

### Objetivo

Provar o fluxo completo de dados utilizando poucas fontes.

### Escopo recomendado

Começar com duas fontes:

- IBGE;
- Banco Central.

Selecionar entre três e cinco séries.

### Pipeline

```text
Fetch
 ↓
Validate
 ↓
Raw Store
 ↓
Normalize
 ↓
Persist
 ↓
Expose
```

Implementar:

- idempotência;
- logs;
- timestamps;
- retries básicos;
- armazenamento raw;
- validação de schema;
- controle de atualização.

### Resultado esperado

Uma série oficial consegue percorrer automaticamente todo o caminho entre a fonte e o Margem.

---

## Fase 6 — Arquitetura de armazenamento

### Objetivo

Tomar decisões baseadas na prova de conceito, não em especulação.

### Decisões

Avaliar:

- banco principal;
- object storage;
- armazenamento raw;
- banco analítico, se necessário;
- cache;
- retenção;
- versionamento;
- backups.

Criar ADRs para as decisões relevantes.

Exemplos:

```text
ADR-0001 Primary Database
ADR-0002 Raw Object Storage
ADR-0003 Data Versioning
```

### Resultado esperado

Infraestrutura de armazenamento definida e documentada.

---

## Fase 7 — Pipeline de dados do MVP

### Objetivo

Integrar todas as fontes necessárias para os indicadores selecionados.

### Trabalho

Criar jobs independentes por fonte.

Exemplo:

```text
IBGE ingestion
BCB ingestion
ANP ingestion
Tesouro ingestion
Ipea ingestion
DIEESE ingestion
```

Criar mecanismos de:

- agendamento;
- retry;
- schema validation;
- quality checks;
- versionamento;
- observabilidade.

Separar:

```text
raw
normalized
derived
published
```

### Resultado esperado

Os dados necessários para o MVP são atualizados automaticamente.

---

## Fase 8 — Indicator Engine

### Objetivo

Separar dado bruto de interpretação e cálculo.

### Responsabilidades

Calcular:

- variações;
- valores reais;
- índices;
- comparações temporais;
- relações renda/preço;
- tempo de trabalho;
- indicadores compostos permitidos.

Cada cálculo deverá ter:

```text
formula
version
inputs
output
methodology
```

Nenhum cálculo relevante deve existir apenas dentro de um componente do frontend.

### Resultado esperado

Cálculos são centralizados, reproduzíveis e testáveis.

---

## Fase 9 — Margem API

### Objetivo

Criar um contrato estável entre dados e produtos.

### Primeiros recursos

Exemplo conceitual:

```text
GET /themes
GET /themes/:slug

GET /indicators
GET /indicators/:slug

GET /indicators/:slug/series

GET /sources/:id

GET /comparisons
```

A API deverá retornar tanto valores quanto contexto necessário para interpretação.

### Requisitos

- cache;
- paginação quando necessária;
- filtros;
- versionamento;
- documentação;
- erros consistentes;
- proteção contra abuso.

### Resultado esperado

Frontend não conhece IBGE, BCB ou qualquer outro provedor.

Ele conhece apenas o contrato do Margem.

---

## Fase 10 — Shell da nova experiência

### Objetivo

Integrar a nova plataforma ao site existente preservando a identidade atual.

### Criar

```text
/
```

Home evoluída.

```text
/tema/:slug
```

Página temática.

```text
/indicador/:slug
```

Página do indicador.

```text
/comparar
```

Comparador.

```text
/entenda/:slug
```

Conteúdo educacional.

### Resultado esperado

O site editorial atual evolui gradualmente para o shell da plataforma.

---

## Fase 11 — Home orientada a perguntas

### Objetivo

Validar a principal hipótese de UX.

A entrada não será uma lista de indicadores.

Será:

> O que você quer entender?

Áreas iniciais:

- Trabalho e renda;
- Custo de vida;
- Vida financeira;
- Qualidade de vida;
- Economia e Estado.

### Resultado esperado

Usuários chegam às informações sem precisar conhecer terminologia econômica.

---

## Fase 12 — Página temática

### Objetivo

Criar um nível intermediário entre pergunta e indicador.

Exemplo:

```text
Custo de vida

Quanto custa viver no Brasil?

Alimentação
Moradia
Energia
Combustíveis
Inflação
```

Apresentar:

- resumo;
- principais mudanças;
- indicadores;
- explicações;
- acesso ao comparador.

### Resultado esperado

Os dados ganham narrativa sem perder auditabilidade.

---

## Fase 13 — Página de indicador

### Objetivo

Construir o componente central do produto.

Cada página deverá responder:

1. o que aconteceu?
2. o que significa?
3. como sabemos disso?

Elementos:

- valor;
- tendência;
- gráfico;
- período;
- comparação;
- interpretação;
- fonte;
- atualização;
- metodologia;
- alertas;
- indicadores relacionados.

### Resultado esperado

Primeira experiência completa de consumo de um indicador.

---

## Fase 14 — Camada “Entenda”

### Objetivo

Remover a necessidade de conhecimento econômico prévio.

Criar conteúdo para conceitos como:

- inflação;
- renda real;
- renda nominal;
- PIB;
- PIB per capita;
- dívida pública;
- déficit;
- juros;
- Selic;
- informalidade;
- desigualdade.

Cada conceito deverá responder:

- o que é;
- por que importa;
- como interpretar;
- erros comuns;
- indicadores relacionados.

### Resultado esperado

A plataforma também funciona como mecanismo de alfabetização econômica.

---

## Fase 15 — Busca

### Objetivo

Permitir linguagem cotidiana.

Exemplos:

```text
comida
gasolina
salário
aluguel
dívida
```

devem encontrar os indicadores tecnicamente relacionados.

Inicialmente não é necessário utilizar IA.

Taxonomia, aliases e full-text search podem resolver grande parte do problema.

### Resultado esperado

O usuário não precisa conhecer o nome oficial de uma série.

---

## Fase 16 — Comparador

### Objetivo

Permitir análise histórica sem produzir um score político opaco.

Usuário seleciona:

- períodos;
- indicadores;
- temas;
- eventualmente governos.

Resultado:

```text
melhorou
piorou
estável
sem dados suficientes
```

Cada conclusão deverá ser expansível até os dados utilizados.

### Resultado esperado

Primeira ferramenta analítica propriamente dita do Margem.

---

## Fase 17 — Tempo de trabalho

### Objetivo

Implementar uma das principais características conceituais da plataforma.

Converter preços em equivalentes como:

```text
R$
% da renda
minutos de trabalho
horas de trabalho
```

Exemplo:

```text
1 litro de gasolina
R$ 6,20

ou

18 minutos de trabalho
```

### Resultado esperado

Indicadores abstratos passam a ter tradução material imediata.

---

## Fase 18 — Políticas públicas e linha histórica

### Objetivo

Começar a conectar indicadores a decisões políticas.

Criar modelo para:

```text
Policy
Legislation
Government
EffectivePeriod
AffectedIndicators
```

Exemplos:

- teto de gastos;
- reforma trabalhista;
- reforma previdenciária;
- política de salário mínimo;
- privatizações;
- programas de transferência de renda.

Importante:

essa camada não deve afirmar causalidade automaticamente.

Ela estabelece contexto temporal e relações investigáveis.

### Resultado esperado

Usuário consegue visualizar política e dados na mesma linha histórica.

---

## Fase 19 — Evidência e causalidade

### Objetivo

Distinguir claramente:

```text
aconteceu durante
```

de:

```text
foi causado por
```

Criar modelo para associar:

- pesquisas acadêmicas;
- estudos de impacto;
- notas técnicas;
- avaliações;
- metodologias.

Classificar evidências quando aplicável.

### Resultado esperado

A plataforma não usa simples correlação temporal como argumento causal.

---

## Fase 20 — Calculadora socioeconômica

### Objetivo

Somente depois que dados, comparação, UX e metodologia estiverem maduros, desenvolver a ferramenta originalmente imaginada.

Entrada possível:

- renda;
- região;
- vínculo de trabalho;
- composição familiar;
- aluguel/moradia;
- transporte;
- prioridades socioeconômicas.

Saída:

> Estas políticas possuem estes impactos históricos e estimados sobre as dimensões que mais afetam o seu perfil.

Não:

> Vote no candidato X.

### Resultado esperado

Ferramenta baseada em indicadores auditáveis e metodologia explícita.

---

## Fase 21 — Escala e performance

### Objetivo

Preparar o sistema conforme uso real justificar.

Avaliar:

- CDN;
- edge cache;
- response cache;
- materialized views;
- precomputation;
- replicas;
- filas;
- processamento incremental;
- banco analítico dedicado.

Não adotar infraestrutura complexa antecipadamente.

### Resultado esperado

Arquitetura escala de acordo com demanda observada.

---

## Fase 22 — Observabilidade e operação

### Objetivo

Garantir confiabilidade contínua.

Monitorar:

- APIs externas;
- pipelines;
- jobs;
- freshness;
- dados ausentes;
- mudanças de schema;
- erros;
- latência;
- cache;
- API;
- frontend.

Criar alertas para dados desatualizados.

### Resultado esperado

É possível saber rapidamente quando algum dado deixou de ser atualizado corretamente.

---

## Fase 23 — Auditoria e transparência pública

### Objetivo

Transformar rastreabilidade em parte visível do produto.

Permitir ao usuário visualizar:

```text
Indicador
↓
Cálculo
↓
Série
↓
Dataset
↓
Fonte
```

Quando possível oferecer:

- fonte original;
- metodologia;
- fórmula;
- histórico de revisões;
- dataset.

### Resultado esperado

O Margem consegue demonstrar de onde cada afirmação quantitativa surgiu.

---

## Linha crítica para o primeiro MVP

Nem todas as fases anteriores são necessárias antes de lançar algo.

Uma primeira versão utilizável pode seguir esta sequência:

```text
0. Auditoria
↓
1. Design system
↓
2. Modelo conceitual
↓
3. Indicadores MVP
↓
4. Fontes
↓
5. Ingestion PoC
↓
6. Storage
↓
7. Pipelines MVP
↓
8. Indicator Engine
↓
9. API
↓
10. Shell
↓
11. Home
↓
12. Temas
↓
13. Indicadores
↓
14. Entenda
↓
15. Busca
↓
16. Comparador
↓
17. Tempo de trabalho
```

Políticas públicas, causalidade e calculadora socioeconômica podem evoluir posteriormente sobre uma fundação já testada.

---

## Critérios para considerar o MVP funcional

O MVP estará funcional quando:

1. dados são obtidos automaticamente de fontes oficiais;
2. o sistema preserva a origem dos dados;
3. pelo menos 10 indicadores relevantes estão disponíveis;
4. usuários conseguem navegar por perguntas e temas;
5. cada indicador possui explicação acessível;
6. gráficos apresentam contexto temporal;
7. fontes e metodologia estão visíveis;
8. usuários conseguem comparar períodos;
9. pelo menos alguns preços podem ser expressos em tempo de trabalho;
10. nenhuma página depende diretamente da disponibilidade das APIs governamentais;
11. atualizações de dados funcionam em background;
12. falhas de ingestão podem ser detectadas;
13. a identidade visual permanece coerente com o Canal Margem.

---

## Princípio de execução

O roadmap deve ser implementado de maneira incremental.

Cada fase deve responder:

> qual hipótese estamos validando?

> qual é o menor sistema necessário para validá-la?

> quais decisões precisam ser documentadas?

> o que ainda pode permanecer em aberto?

O objetivo não é construir toda a arquitetura imaginável.

É permitir que o Margem cresça sem perder rastreabilidade, clareza de produto e capacidade de evolução.
