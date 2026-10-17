# Fontes de dados

Este diretório receberá o catálogo das fontes necessárias aos [15 indicadores principais da fase 3](../systems/mvp-indicators.md), seus contextos e entradas auxiliares. O [mapa de fontes](../research/source-map.md) registra evidências documentais e prioridades. Nenhuma integração ou endpoint de dados foi validado nessa seleção.

Começar por `ibge.md`, `bcb.md`, `anp.md`, `conab-dieese.md` e `fjp.md`. A origem conjunta Conab/DIEESE não exige duplicar a coleta. Incluir:

- INPC geral como contexto da inflação e número-índice corrente/base para o mínimo real;
- mínimo nominal com convenção mensal e vigência, comum às duas derivadas;
- cesta nominal por capital, composição, mês e referência de 220 horas para o tempo por cesta;
- ônus do aluguel com unidade de contagem, universo e edição da FJP;
- insegurança alimentar com denominador de domicílios, graus e edições disponíveis;
- jornada, participação e subutilização na PNAD e inadimplência PF do BCB como contexto.

Investigar na fase 4 renda/hora do IBGE, Peic/CNC e inflação por faixa de renda/Ipea, registrando decisão e limites mesmo quando a conclusão for adiar. Não assumir que Peic e inadimplência bancária sejam medidas intercambiáveis. Tesouro, MDS, MTE, ANEEL, SINISA, Inep e DATASUS ficam mapeados para expansão, sem exigir integração nesta entrega.

Cada documento deverá registrar:

- indicadores atendidos, datasets, identificadores de séries e links oficiais;
- endpoints ou arquivos, formatos, autenticação e limites;
- periodicidade, atraso de publicação, histórico e resolução geográfica;
- unidades, metodologia, qualidade, lacunas e quebras de série;
- revisões, vintages e estratégia de preservação dos dados originais;
- estratégia de ingestão e atualização, validações e falhas esperadas;
- data e evidência da verificação das informações.

A matriz indicador → fonte → dataset → série → frequência → pipeline será elaborada na fase 4. Investigações preliminares pertencem a [research](../research/README.md).
