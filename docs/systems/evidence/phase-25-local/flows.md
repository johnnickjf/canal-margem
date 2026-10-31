# Revisão inicial de fluxos — 27/10/2026

Estado: parcial. O preview local usou o build estático fixado na geração 5 e a API local em
`127.0.0.1:8080`; os cenários abaixo são exemplos sintéticos, não perfis reais. A API e o site
não foram publicados externamente.

## Comparador

Em Chromium desktop (1440 × 900) e celular (393 × 900), movimento reduzido, foi selecionado
desemprego Brasil entre o primeiro e o último trimestre de 2025. A API devolveu diferença de
−1,9 ponto percentual (7% para 5,1%); o resultado mostrou a regra e o caminho para auditar as
observações, sem atribuir causalidade. Ao enviar sem indicador, o foco foi para a mensagem de
seleção obrigatória. Uma resposta HTTP 503 simulada na chamada de comparação produziu mensagem
de indisponibilidade e nenhuma avaliação numérica. O teste do erro foi apenas no celular.

A revisão detectou que o resultado exibia `BR` e `quarterly`, e as opções de capitais usavam
códigos. Foram substituídos por nomes e frequências legíveis, mantendo os IDs no contrato da
consulta; após o rebuild, o resultado exibiu `Brasil` e `trimestral`, e a opção da cesta exibiu
`São Paulo`. A revisão visual completa, cobertura de todos os cálculos e navegação integral por
teclado seguem pendentes.

Em 31/10, a abertura foi revista em 1440 × 1000 e 393 × 851, com o build da geração 6.
O formulário começa na primeira tela móvel, após instrução resumida; o exemplo de datas e os
links para cobertura e critérios foram preservados em uma seção expansível. O teste de build
com fixture passou em desktop e celular, incluindo abertura por teclado sem JavaScript, envio,
resultado, falhas, recuperação e acessibilidade automática. Isso não comprova uso com leitor
de tela ou a cobertura de todas as combinações de dados reais.

## Calculadora

Nos mesmos dois tamanhos, renda hipotética de R$ 3.000, duas pessoas e despesas de R$ 1.800
produziram saldo de R$ 1.200. Para São Paulo em dezembro/2025, o formulário exibiu a cesta de
R$ 845,95. No celular, selecionar região fora da cobertura preservou o orçamento e informou a
ausência de cesta sem estimar preço. O ensaio não valida todos os limites numéricos, o tempo
individual, falhas de rede ou leitores de tela.

Após o rebuild da geração 6, repetiram-se os dois fluxos em desktop e celular: a comparação de
desemprego do início de 2025 ao fim de junho/2026 mostrou −1,6 ponto percentual, e a cesta de
São Paulo em setembro/2026 apareceu como R$ 922,51 no cenário hipotético.

Os testes `calculator.spec.ts`, `search.spec.ts` e `editorial.spec.ts` passaram em desktop e
celular (30 casos) no build com dados. A primeira execução apontou duas falhas porque o teste
da ordem do menu não incluía o item Dados; a expectativa foi corrigida e a suíte repetida. Os
testes da calculadora cobrem método, fontes, SEO e acesso sem JavaScript; não substituem as
simulações acima. Busca cobre consultas, filtros, falha HTTP, recuperação e acesso sem JavaScript.

Em 31/10, a abertura da calculadora foi encurtada em desktop e celular; as ressalvas completas
sobre a cesta e os limites do cenário continuam em seção expansível, e o aviso de envio dos
valores permanece antes do formulário. O teste de leitura e SEO sem JavaScript passou nos dois
tamanhos, incluindo a abertura da seção por teclado. Com a geração 6 e API local, uma nova
simulação móvel com renda de R$ 3.000 e despesas de R$ 1.800 mostrou saldo de R$ 1.200 e cesta
de São Paulo de setembro/2026 a R$ 922,51. O ensaio não cobre todos os perfis ou tecnologias
assistivas.

As suítes de políticas e evidências também passaram em desktop e celular (26 casos) usando um
build estático separado sem API, incluindo fontes, navegação sem JavaScript, SEO e axe. A
primeira tentativa usou o servidor de desenvolvimento, cujas URLs canônicas não tinham a barra
final esperada pelo teste; a verificação foi repetida no HTML de build. Esses testes não
substituem a revisão visual, de todos os estados ou das fichas com dados.

Na edição 6 com dados, uma segunda triagem percorreu as nove rotas dos catálogos e fichas de
políticas e evidências em desktop e celular, com e sem JavaScript. Confirmou HTTP 200, um `h1`,
texto principal e canonical, sem overflow detectado; o axe não apontou violações nos dois
tamanhos com JavaScript. A verificação não conferiu cada afirmação, interação ou apresentação
visual das fichas.

## Auditoria

Na geração 6, a página apresentava 27 recortes de cesta com códigos de capital e repetia o
mesmo nome de região para cada grupo de capturas, sinalizado pelo axe em desktop e celular.
Os recortes passaram a mostrar nomes legíveis com o código preservado; os grupos deixaram de
criar regiões repetidas e mantiveram os títulos. O texto sobre edições antigas foi ajustado:
suas consultas dependem dos arquivos preservados, e a geração 1 local continua indisponível.

Após o rebuild, o teste de auditoria passou nos dois tamanhos, incluindo axe e navegação sem
JavaScript. No celular sem JavaScript, os 27 recortes incluíam São Paulo, os links internos
testados tinham destino, não havia IDs duplicados nem overflow no documento. Canonical,
BreadcrumbList, sitemap e ausência de bloqueio em `robots.txt` foram conferidos localmente.
Isso não comprova acessibilidade com leitor de tela ou disponibilidade de todos os manifestos.
