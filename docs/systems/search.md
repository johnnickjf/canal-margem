# Busca — fase 15

A rota `/busca` encontra indicadores, conceitos do Entenda, temas, episódios, cortes e
análises com vocabulário cotidiano. A busca usa o índice estático `/busca.json`, gerado
junto das páginas, sem serviço adicional ou IA.

## Vocabulário e relevância

Os [aliases editoriais](../../src/data/search-aliases.ts) associam palavras a indicadores
e conceitos específicos. Exemplos de descoberta:

| Consulta | Indicadores relacionados |
|---|---|
| comida | Inflação da alimentação, cesta básica, tempo por cesta e insegurança alimentar |
| gasolina, combustível, abastecer | Preço da gasolina |
| salário | Rendimento real, mínimo real, mínimo nominal e tempo por cesta |
| aluguel, moradia, habitação | Ônus excessivo com aluguel urbano |
| dívida, parcelas | Comprometimento da renda e, conforme o termo, inadimplência bancária |
| bico, sem carteira | Informalidade |

A associação serve à descoberta; não declara equivalência entre conceitos. A dívida
pública aparece como explicação no Entenda; a busca não cria uma série de dívida pública
nem indicadores ausentes do catálogo. Rendimento mediano e rendimento por hora continuam
fora das medidas disponíveis nesta entrega.

O [motor](../../src/lib/search.ts) normaliza caixa, acentos, espaços e pontuação. Descarta
artigos e preposições comuns e exige todos os termos úteis restantes. Títulos e aliases
têm peso maior que o texto; indicadores e conceitos recebem prioridade sobre o acervo.
A ordenação preserva a ordem do índice em empates. Não há correção de erros de digitação,
stemming, busca semântica ou interpretação livre de perguntas.

## Índice e contexto dos dados

[platformSearchItems](../../src/lib/platform-search.ts) recebe o catálogo da publicação
capturada no início do build. Sem API configurada, usa as mesmas definições locais que
geram as páginas. Inclui os 20 indicadores locais (15 principais e cinco auxiliares),
os cinco temas socioeconômicos, os 11 conceitos e o guia de leitura. Com API configurada,
os indicadores e temas vêm exclusivamente do catálogo dessa edição.

[busca.json.ts](../../src/pages/busca.json.ts) acrescenta o acervo pelas consultas existentes
de conteúdo, preservando a exclusão de rascunhos no build de produção. Cada item tem tipo,
título, texto, URL, metadados e aliases opcionais. URLs editoriais permanecem estáveis.
O índice contém definições, sem valores ou alegações de cobertura; a página de destino
informa disponibilidade, período e fonte. Nenhuma consulta no navegador acessa a API ou
resolve outra publicação. O parâmetro `q` da API HTTP mantém seu contrato textual anterior;
esta busca de produto opera no índice do site.

## Interface e falhas

A [página](../../src/pages/busca.astro) oferece exemplos e filtros para indicadores,
Entenda, vídeos/análises e temas. `q` e `tipo` ficam na URL, inclusive após envio pelo
teclado; links compartilhados e retorno pelo histórico restauram os campos. Consultas
pela interface têm limite de 200 caracteres. Não há envio de termos a terceiros.

O [cliente](../../src/scripts/search-page.ts) aplica debounce de 120 ms e impede que uma
consulta antiga sobrescreva outra após edição, limpeza ou troca de filtro. Os resultados
são inseridos como texto, sem interpretar HTML. O [carregador](../../src/scripts/search.ts)
compartilha o índice entre consultas, verifica HTTP, formato e URLs locais e limita a
requisição a dez segundos. Falha HTTP, rede, timeout ou JSON inválido mostra erro e permite
nova tentativa; não fica armazenada como índice vazio.

Carregamento e contagem são anunciados em uma região de status. Na ausência de resultados
ou diante de erro, o usuário pode explorar os indicadores, conceitos e temas pelo catálogo
em HTML. Sem JavaScript, a pesquisa por palavras não executa; uma mensagem explica isso e
o catálogo completo continua disponível por listas expansíveis nativas e links.

## Verificação e limites

[Testes unitários](../../tests/unit/search.test.ts) cobrem os exemplos do roadmap, aliases,
consultas compostas, acentos, filtros, resultados vazios, cobertura do catálogo, ausência
de séries inventadas, carregamento compartilhado, rejeição de índice inválido e retry.
[Playwright](../../tests/search.spec.ts) verifica navegação real, exemplos, filtros, URL,
teclado, erros, concorrência, texto não interpretado como HTML, axe e largura em desktop
e celular, além do catálogo sem JavaScript e SEO. Capturas ficam em `test-results/`.
O [build isolado](../../tests/content-build.spec.ts) confirma que o índice usa a definição
do catálogo da API, que cada destino existe e que rascunhos não aparecem no índice.

A página mantém título, descrição, canonical sem parâmetros e metadados de compartilhamento
pela base compartilhada. O catálogo é legível em HTML; sitemap e `robots.txt` mantêm a rota
pública, conforme a [regra permanente de SEO e descoberta por IA](../../AGENTS.md).
Validações locais não comprovam indexação externa, uso por pessoas reais ou produção.
A próxima etapa é o comparador da fase 16; implantação Railway/R2 permanece posterior.
