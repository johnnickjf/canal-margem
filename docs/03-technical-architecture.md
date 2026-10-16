# Margem — Arquitetura Técnica

## Status

Requisitos para a arquitetura futura. API de indicadores, armazenamento e pipelines ainda não estão implementados. O frontend é estático; sua base está inventariada na [auditoria da fase 0](systems/frontend.md). O [modelo conceitual da fase 2](systems/data-model.md) fixa entidades e semântica dos dados, sem escolher infraestrutura.

As escolhas de tecnologia serão registradas em Architecture Decision Records (ADRs).

---

## 1. Objetivo

Descrever a arquitetura necessária para:

- coletar dados externos;
- preservar dados originais;
- normalizar séries;
- calcular indicadores;
- armazenar históricos;
- servir grandes volumes de leitura;
- garantir rastreabilidade;
- suportar comparação histórica;
- fornecer uma API estável para os produtos Margem.

---

## 2. Princípio fundamental

Os produtos clientes não deverão depender diretamente das APIs dos provedores de dados.

Evitar:

```text
Frontend → IBGE
Frontend → BCB
Frontend → ANP
```

Preferir:

```text
Fontes externas
      ↓
Ingestion
      ↓
Raw Store
      ↓
Processamento
      ↓
Indicator Store
      ↓
Margem API
      ↓
Produtos
```

---

## 3. Categorias de fontes

### APIs

Exemplos:

- IBGE;
- Banco Central;
- IpeaData;
- Tesouro;
- BNDES;
- Câmara;
- Senado.

### Bulk datasets

Exemplos:

- ANP;
- RAIS;
- Caged;
- Inep;
- Receita Federal.

Formatos possíveis:

- CSV;
- TXT;
- ZIP;
- JSON;
- XML;
- Parquet.

### Fontes especiais

Fontes sem API ou dataset estruturado poderão necessitar parsers específicos.

Exemplo:

- DIEESE.

Scraping genérico deverá ser considerado último recurso.

---

## 4. Frequência de atualização

O sistema não terá como objetivo oferecer tempo real.

A regra será:

> dado oficial mais recente disponível.

Cada série deverá possuir sua própria política de sincronização.

Exemplos:

- diária;
- semanal;
- mensal;
- trimestral;
- anual.

---

## 5. Camadas de dados

### Raw

Cópia imutável do conteúdo obtido na fonte.

Objetivos:

- auditoria;
- reprocessamento;
- recuperação;
- comparação entre versões.

### Normalized

Representação padronizada dos dados externos.

### Indicators

Séries e indicadores já preparados para consumo pelos produtos.

### Derived Indicators

Indicadores produzidos pelo próprio Margem.

Exemplos:

- renda real por hora;
- minutos de trabalho necessários para comprar um litro de combustível;
- horas necessárias para adquirir cesta básica.

No [modelo conceitual](systems/data-model.md#camadas-e-integração-futura), os nomes canônicos das camadas são `raw`, `normalized`, `derived` e `published`. `Indicators` corresponde ao catálogo e à projeção publicada; `Derived Indicators` corresponde a indicadores `kind: derived` com observações calculadas. Uma projeção publicada pode conter dados externos ou derivados. Essas responsabilidades não exigem armazenamentos separados.

---

## 6. Provenance

Nenhum número deverá existir sem metadados suficientes para explicar sua origem.

Metadados canônicos definidos no [modelo conceitual](systems/data-model.md#metadados-obrigatórios-de-observação). A observação referencia uma série, que identifica o indicador e o código externo:

```text
series
value
unit
geography
reference_period
published_at
retrieved_at
source
dataset
methodology
methodology_version
revision_status
vintage
```

Indicadores derivados registram o cálculo e a versão, inputs por IDs imutáveis e parâmetros em `derivation`. A especificação de cálculo guarda:

```text
formula
inputs
calculation_version
methodology
methodology_version
```

`revision_status` admite `unrevised`, `revised` e `unknown`; não se reduz a um booleano. Publicação, coleta, estado preliminar/final e atualização são dimensões distintas. As condições de ausência e os campos complementares obrigatórios estão no modelo; esta lista resumida não é um schema de validação.

---

## 7. Versionamento e vintages

Quando uma instituição revisa dados históricos, o Margem deverá ser capaz de distinguir:

> qual é o valor oficial atual?

de:

> qual valor era conhecido em determinada data?

Por isso, revisões não deverão simplesmente sobrescrever registros antigos.

---

## 8. Dimensão geográfica

Sempre que possível deverá ser utilizada uma identificação geográfica canônica.

Para municípios e unidades federativas brasileiras, códigos IBGE são candidatos naturais.

Níveis possíveis:

- Brasil;
- região;
- UF;
- município.

Alguns indicadores poderão existir somente em determinados níveis.

---

## 9. API do Margem

Uma única API do Margem deverá esconder as diferenças existentes entre fontes externas.

Exemplo conceitual:

```text
GET /indicators
GET /indicators/:id
GET /indicators/:id/series
GET /themes/:id
GET /comparisons
GET /sources/:id
```

O contrato definitivo será definido posteriormente, incluindo o uso de IDs ou slugs e o acesso público ou privado.

---

## 10. Estratégia para grandes volumes de leitura

A arquitetura deverá assumir:

- muitas leituras;
- poucas escritas;
- atualizações relativamente espaçadas;
- séries históricas altamente cacheáveis.

Consequentemente deverão ser estudados:

- CDN;
- HTTP caching;
- materialized views;
- precomputed aggregates;
- cache distribuído;
- compressão;
- armazenamento columnar para analytics;
- separação entre workloads analíticos e transacionais.

Nenhuma tecnologia específica está definida neste momento.

O [catálogo de operações e consistência](systems/data-operations.md) fixa consultas por publicação, paginação estável e cache identificado pelo manifesto. Escritas aceitam lotes validados e preservam revisões; leituras públicas usam uma publicação completa e imutável. Essa separação lógica pode ser implementada no mesmo banco.

---

## 11. Processamento em background

O sistema deverá possuir mecanismos para:

- descobrir novas versões;
- baixar dados;
- validar integridade;
- armazenar raw;
- transformar dados;
- recalcular indicadores afetados;
- validar resultados;
- publicar nova versão.

Coleta, aceitação validada e ativação pública são momentos distintos, definidos no [catálogo](systems/data-operations.md#três-momentos-distintos). O canal muda de publicação de forma indivisível, com geração esperada para detectar concorrência. Preparação parcial não muda a visão pública; derivadas pendentes são informadas sem misturar resultados antigos com inputs revisados. As garantias são requisitos conceituais, ainda sem implementação de pipeline.

Fluxo conceitual:

```text
Scheduler
   ↓
Fetch
   ↓
Validate
   ↓
Raw Store
   ↓
Transform
   ↓
Quality Checks
   ↓
Indicator Store
   ↓
Cache invalidation
```

---

## 12. Qualidade de dados

Pipelines deverão detectar:

- ausência inesperada de dados;
- mudanças de schema;
- valores fora de faixa;
- mudanças de unidade;
- revisões;
- quebra de série;
- falhas de download;
- duplicidades.

Erros silenciosos são especialmente perigosos neste projeto porque podem alterar interpretações socioeconômicas.

---

## 13. Observabilidade

A futura infraestrutura deverá registrar pelo menos:

- última sincronização;
- status;
- quantidade de registros;
- versão importada;
- erros;
- tempo de execução;
- fonte;
- dataset;
- indicadores afetados.

---

## 14. Reprodutibilidade

O sistema deverá permitir responder:

> Como o valor mostrado ao usuário foi produzido?

Idealmente será possível reconstruir:

```text
valor apresentado
     ↓
fórmula
     ↓
inputs normalizados
     ↓
dados raw
     ↓
fonte pública
```

---

## 15. Documentação futura

Este documento será complementado por documentos específicos.

### Data Sources

Um documento por fornecedor.

Exemplo:

```text
/docs/data-sources/ibge.md
/docs/data-sources/bcb.md
/docs/data-sources/ipea.md
/docs/data-sources/anp.md
```

Cada documento deverá registrar:

- endpoints;
- autenticação;
- limites;
- datasets utilizados;
- periodicidade;
- particularidades;
- qualidade;
- processo de ingestão.

### Systems

Documentos para componentes internos.

Exemplo:

```text
/docs/systems/ingestion.md
/docs/systems/data-processing.md
/docs/systems/api.md
/docs/systems/frontend.md
```

### ADR

Decisões arquiteturais relevantes deverão ser registradas separadamente.

Exemplo:

```text
/docs/adr/0001-primary-database.md
/docs/adr/0002-raw-storage.md
/docs/adr/0003-job-orchestration.md
```

Um ADR deverá explicar:

- contexto;
- alternativas;
- decisão;
- consequências.

---

## 16. Decisões ainda em aberto

Entre as principais:

- banco transacional;
- banco analítico;
- object storage;
- formato dos dados raw;
- formato de dados intermediários;
- processamento batch;
- orquestração;
- estratégia de cache;
- infraestrutura;
- API pública ou privada;
- estratégia de deploy;
- filas;
- monitoramento;
- versionamento de datasets;
- mecanismos de cálculo;
- atualização incremental;
- custos operacionais.

Essas decisões deverão ser tomadas a partir dos requisitos e volume esperado, não antecipadamente.
