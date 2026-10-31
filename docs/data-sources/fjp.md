# Fundação João Pinheiro — ônus do aluguel

Verificado em **17/10/2026**. Atende **CV6**, número estimado de domicílios urbanos com renda domiciliar de até três salários mínimos e aluguel superior a 30% dessa renda, classificados no componente do Déficit Habitacional. Unidade **domicílios**, não percentual de locatários ou participação no déficit.

## Dataset e obtenção

O [índice oficial](https://fjp.mg.gov.br/deficit-habitacional-no-brasil/) vincula relatórios e estimativas em planilhas. A página foi legível pela ferramenta web; requisição HTTP direta devolveu 403. Os arquivos vinculados no Google Drive foram baixados sem login. O hospedeiro não muda a autoria FJP; preservar o vínculo ao índice oficial.

| Edição / arquivo vinculado pela FJP | Caminho exato do componente nacional | Evidência |
|---|---|---|
| [2024](https://docs.google.com/spreadsheets/d/1AwlL17JBmASv8Jurnkb6zhfXc0fzGQwp/edit) — `2026.06.11_Estimativas Déficit Habitacional no Brasil (2024).xlsx` | `DH_Componentes!I56`; A56 = 2024, B56 = Brasil, I1 = Ônus | 3.587.776,7972144 domicílios estimados |
| [2023](https://docs.google.com/spreadsheets/d/1lQzsAuzhRCEJufiIEI_tVzO4vllcBT38/edit) — `Deficit_2023_site.xlsx` | `DH_Componentes!I56`; ano 2023, Brasil | 3.665.439,8798232903 |
| [2022](https://docs.google.com/spreadsheets/d/1OqAuggLve9HoPrI8jJcaAfSu1q5DCvdc/edit) — `Deficit_2022.xlsx` | `DH_Componentes!I56`; ano 2022, Brasil | 3.242.780,43138197 |
| [2016–2019 reponderados](https://docs.google.com/spreadsheets/d/1y0c_oDcNpcq29fJyPAA4jtjDTAzij2MW/edit) — edição de 15/06/2023 | Aba `Ônus`, coluna D `Contagem`, C = Brasil, A = ano; linhas 55, 109, 163 e 217 | Quatro observações nacionais, preservadas em amostra |

Em 27/10/2026, o índice oficial passou a apontar a série reponderada de 2016–2019 para
[outra planilha](https://docs.google.com/spreadsheets/d/1JXmSxIz4Hvl8tua6E10OrvoMa6v6z-88/edit).
O arquivo exportado tem a mesma aba e os mesmos recortes, mas sua representação numérica
contém pequenas diferenças nas últimas casas decimais. A coleta usa o novo vínculo e
preserva seus bytes e valores próprios; a amostra de 17/10 continua referindo-se ao arquivo
anterior. Não se presume que os arquivos sejam byte a byte idênticos.

Os valores e cabeçalhos são [extratos dos arquivos](evidence/files.json), com URL e hash no [manifesto](evidence/manifest.json). São estimativas ponderadas, por isso o original contém frações; não rejeitar como contagem inválida nem truncar antes de preservar. O relatório apresenta números arredondados.

Obtenção observada de XLSX, sem autenticação:

```text
https://drive.google.com/uc?export=download&id={id_do_arquivo}
https://docs.google.com/spreadsheets/d/1AwlL17JBmASv8Jurnkb6zhfXc0fzGQwp/export?format=xlsx
```

Ambos os caminhos funcionaram para 2024. Não presumir que exportação funcione em todos os arquivos ou que IDs sejam permanentes; descobrir a edição no índice e validar assinatura ZIP/XLSX. HTML de login ou bloqueio não é planilha vazia.

## Método, universo e comparabilidade

Referência inicial: **edição 2024, divulgada em 2026**, [relatório oficial vinculado](https://drive.google.com/file/d/1wcGG-95LHqzhjXbtTvCnFh2XX2vL0xyW/view). A seção de metodologia e o capítulo 6 explicam o recorte: domicílios urbanos alugados com renda domiciliar até três salários mínimos e aluguel acima de 30% da renda total. O número não cobre todos os locatários nem mede renda média comprometida.

O déficit usa uma **hierarquia de componentes**: domicílios já classificados como improvisados, rústicos ou cômodos são descontados nas etapas seguintes; unidades domésticas conviventes têm regra própria. Portanto, a contagem da coluna Ônus não equivale a filtrar todos os domicílios pelo limiar de renda/aluguel sem essas exclusões. Não reprocessar microdados para criar um substituto sem nova metodologia.

O relatório de 2024 apresenta 3.587.777 domicílios com ônus e participação de 62,1% no déficit; esse percentual é outro denominador e não atende CV6. A [seleção da fase 3](../systems/mvp-indicators.md) continua usando a contagem.

Há arquivos 2016–2019 reponderados e 2022–2024. O índice também aponta relatórios antigos de outra base, mas esta verificação não estabelece uma retrospectiva homogênea desde 2012. **2020 e 2021 não foram identificados nos arquivos selecionados**; não interpolar. Revisões de pesos, mudanças da PNAD para PNAD Contínua, tratamento de unidades conviventes e uso do CadÚnico no componente de improvisados impedem emenda automática. Mesmo um componente da PNAD precisa ser avaliado dentro da hierarquia da edição. Preservar os sete valores catalogados, segmentados por método/edição; usar 2024 como recorte inicial antes de liberar comparação histórica.

Coberturas disponíveis incluem Brasil, regiões, UF, RM e estratos geográficos nas abas próprias. A seleção inicial é Brasil urbano. Não somar linhas de Brasil, regiões, UF e RM, que se sobrepõem.

## Atualização, direitos e futura ingestão

Frequência de referência anual; divulgação por edição, sem calendário fixo ou SLA identificado. A planilha 2024 tem nome datado de junho/2026. Monitorar índice e notas, não supor atraso de um ano ou publicação anual ininterrupta. Guardar o ano de referência separado da edição e da coleta.

Nenhuma credencial foi necessária para os arquivos; não foi encontrada licença explícita de redistribuição nas planilhas examinadas. Registrar FJP, edição e arquivo, preservar a atribuição e confirmar condições antes de redistribuir a base completa. Não aplicar automaticamente licença de rodapé do Google ou de outra fonte.

Job futuro por edição: capturar índice/relatório e planilha original → validar aba, cabeçalho, ano e território → selecionar a coluna de contagem → preservar precisão e método → comparar revisões → aceitar. Conferir valor não negativo, identidade da unidade, coerência com o componente no relatório e ausência de duplicatas. Um arquivo revisado no mesmo link deve gerar nova versão preservada, conforme [operações](../systems/data-operations.md). Falha de acesso, troca de aba ou edição metodologicamente incompatível bloqueia a atualização afetada; não substituir pela participação percentual.
