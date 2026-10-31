# Triagem técnica de rotas — 27/10/2026

Estado: parcial. Este inventário registra somente a triagem automatizada; não é uma revisão visual, de acessibilidade assistiva ou de todos os estados.

O Astro de desenvolvimento em `127.0.0.1:4321` estava sem publicação: `/indicador/desemprego` apresentava ausência de dados. O roteiro usa os 88 caminhos `index.html` presentes no build e visitou cada um em desktop 1440 × 1000 e celular 393 × 851, com JavaScript ativo e desativado; reduziu movimento no celular e nos dois estados sem JavaScript. Verificou resposta HTTP 200, título, um `h1`, texto em `main`, canonical e descrição presentes, ausência de rolagem horizontal no documento e foco em algum elemento após o primeiro Tab.

As quatro verificações passaram nas 88 rotas listadas. A presença de metadados não comprova sua correção; o primeiro Tab não comprova a ordem completa do teclado. Não foram testados aqui resultados de formulários, falhas, carregamento, busca, contraste, screenshots ou o estado com dados. O servidor de desenvolvimento continuava ativo durante a varredura; as alterações de rótulos posteriores não estão cobertas por ela.

Um caminho inexistente foi examinado separadamente nas mesmas quatro combinações: HTTP 404, título e `h1` presentes, `main` presente e sem rolagem horizontal detectada. Sem validação visual ou de recuperação por teclado.

Na inspeção visual inicial da abertura da cesta com dados, em 1440 × 900 e 393 × 900, os
valores ficam abaixo da primeira tela; no celular, a navegação da plataforma e a navegação
interna ocupam grande parte da altura antes da pergunta. Avaliar a hierarquia e uma solução
com teclado e sem JavaScript; esta observação não cobre o restante da página ou outras rotas.
Na abertura de `/auditoria` em 393 × 900, a mesma navegação ocupa quase metade da tela antes
do conteúdo principal. A observação reforça a necessidade de revisar o shell móvel compartilhado.

Em 31/10, a abertura de desemprego foi inspecionada novamente com a geração 6, em 393 × 851
e 1440 × 1000, sem JavaScript e com movimento reduzido. Um resumo anterior à navegação interna
mostra Brasil, período e 5,4%; no celular ele aparece na primeira tela. Para múltiplos recortes,
o resumo indica a quantidade e leva à lista, sem escolher uma geografia. A ausência e o estado
pendente são apresentados explicitamente. Esta inspeção não substitui a revisão das demais
variantes e telas, nem verifica indexação externa.
O teste de build com fixture passou em desktop e celular, sem JavaScript, para recorte único,
múltiplos recortes, ausência e recálculo pendente; também conferiu navegação e acessibilidade
automática dos fluxos cobertos. O build com a edição local gerou 89 páginas.

Em 31/10, as aberturas de auditoria, busca, Entenda, inflação, políticas, Bolsa Família,
evidências, estudo dos quinze anos e tema custo de vida foram inspecionadas em 1440 × 1000
e 393 × 851 com a geração 6. A busca cortava o exemplo no campo móvel; o exemplo foi
encurtado e o tamanho do texto ajustado. Na ficha do estudo, o título completo ocupava quase
toda a primeira tela em ambos os tamanhos; sua escala foi reduzida sem abreviar o título.
As duas aberturas foram novamente inspecionadas sem JavaScript. Os testes de busca e evidências
passaram nos dois tamanhos, com SEO e acessibilidade automática nos cenários cobertos. Essa
revisão das aberturas não cobre o restante das páginas, todas as fichas, resultados dinâmicos
ou tecnologias assistivas.

Roteiro reproduzível: servir o artefato estático localmente e apontar `MARGEM_AUDIT_ORIGIN`
para essa origem; `MARGEM_AUDIT_DIR` seleciona a pasta `site` e
`MARGEM_AUDIT_REPORT` define o relatório JSON ignorado pelo Git. O roteiro lista apenas
diretórios `index.html`; JSON, RSS e sitemap são contratos, não telas.

Em 31/10, a lista abaixo foi comparada aos 88 caminhos `index.html` dos builds atualizados
com e sem a geração 6: não houve caminhos extras ou ausentes. As famílias de páginas e rotas
dinâmicas em `src/pages` estão representadas; a página 404 é um arquivo separado, e JSON e
RSS não entram nessa contagem. Nos dois builds, uma varredura do HTML encontrou canonicals
esperados, descrições, JSON-LD válido, IDs únicos e destinos existentes para links iniciados
por `/` e fragmentos locais ou nesses links;
as 87 páginas indexáveis constavam no sitemap, com a exclusão prevista de `/design-system`.
O 404 tinha um `h1` e `noindex, follow`. A verificação não confirma indexação externa nem
comprova a pertinência editorial de todos os metadados ou links.

No artefato mais recente com a geração 6, a auditoria funcional percorreu 88 rotas em quatro
estados (desktop/celular, JavaScript ativo/desativado): 352 combinações sem problemas
detectados. Axe e largura do documento foram examinados nas mesmas 88 rotas em 1440 × 1000
e 393 × 851, com JavaScript e movimento reduzido: 176 combinações sem violações automáticas
nem overflow no documento. Os relatórios locais foram `.data/phase25-ui-audit-final.json`
e `.data/phase25-a11y-final.json`. Para repetir contra um artefato servido em `127.0.0.1:4329`:

```bash
MARGEM_AUDIT_DIR=.data/publication-builds/edition-1mPNe8/site \
MARGEM_AUDIT_ORIGIN=http://127.0.0.1:4329 \
MARGEM_AUDIT_REPORT=.data/phase25-ui-audit-final.json \
node scripts/phase25-ui-audit.mjs

MARGEM_AUDIT_DIR=.data/publication-builds/edition-1mPNe8/site \
MARGEM_AUDIT_ORIGIN=http://127.0.0.1:4329 \
MARGEM_AUDIT_REPORT=.data/phase25-a11y-final.json \
node scripts/phase25-a11y-audit.mjs
```

O build mais recente gerou 89 páginas: 88 rotas públicas e o arquivo 404. A lista acima foi
reconciliada com `src/pages`; não houve caminhos extras ou ausentes. A checagem do HTML não
encontrou divergências em canonicals, descrições, JSON-LD, IDs únicos ou destinos de links
locais; 87 páginas indexáveis estavam no sitemap, com a exclusão prevista de `/design-system`.
O 404 tinha `h1` e `noindex, follow`. Estas varreduras não abrem todos os controles, não
substituem avaliação com tecnologias assistivas e não comprovam indexação externa.

Em 31/10 foram capturadas 19 rotas em 1440 × 1000 e 393 × 851; os arquivos estão ignorados
em `.data/phase25-visual-review`. A inspeção visual manual detalhada cobriu 11 delas: home,
entrada de dados, auditoria, tema custo de vida, desemprego, comparação, calculadora, busca,
políticas, estudo dos quinze anos do Bolsa Família e Entenda. Os layouts amostrados mantiveram
hierarquia e legibilidade. As outras capturas não foram tratadas como revisão manual. A
inspeção não cobre todas as fichas, estados dinâmicos ou leitor de tela. O resultado geral da
Fase 25 permanece parcial.

| Rota | Desktop JS | Celular JS | Desktop sem JS | Celular sem JS |
|---|---|---|---|---|
| `/` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/analises` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/analises/duas-horas-por-dia` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/analises/economia-e-gente` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/analises/o-preco-do-aluguel` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/analises/quem-paga-a-conta` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/auditoria` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/busca` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/calculadora` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/comparar` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/dados` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/design-system` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/como-ler-os-dados` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/deficit` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/desigualdade` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/divida-publica` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/inflacao` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/informalidade` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/juros` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/pib` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/pib-per-capita` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/renda-nominal` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/renda-real` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/entenda/selic` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/evidencias` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/evidencias/avaliacao-impacto-na-pratica` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/evidencias/bolsa-familia-inseguranca-2009-2013` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/evidencias/bolsa-familia-quinze-anos` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/cesta-basica` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/comprometimento-renda` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/context` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/desemprego` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/desigualdade` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/gasolina` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/inflacao` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/inflacao-alimentacao` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/informalidade` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/inseguranca-alimentar` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/onus-aluguel` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/pib-por-pessoa` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/pobreza` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/rendimento-real` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/salario-minimo-real` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/tempo-por-cesta` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/tr2-cv5-input` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/tr2-input` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/tr3` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/indicador/vf2` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/manifesto` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/politicas` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/politicas/bolsa-familia-2023` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/politicas/reforma-previdenciaria-2019` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/politicas/reforma-trabalhista-2017` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/politicas/valorizacao-salario-minimo-2024` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/sobre` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/tema/custo-de-vida` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/tema/economia-e-estado` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/tema/qualidade-de-vida` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/tema/trabalho-e-renda` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/tema/vida-financeira` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/cidade` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/custo-de-vida` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/democracia` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/desigualdade` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/habitacao` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/poder-economico` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/renda` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/servicos-publicos` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/tecnologia-e-trabalho` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/trabalho` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/tributacao` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/temas/vida-cotidiana` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m015-a-feira-ficou-cara` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m015-c1-economia-e-gente` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m016-c1-quem-avalia-o-entregador` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m016-o-app-e-o-patrao` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m017-escala-6x1` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m018-c1-quem-pega-o-onibus` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m018-duas-horas-por-dia` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m019-c1-imposto-no-carrinho` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m019-quem-paga-a-conta` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m020-c1-aluguel-ou-comida` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m020-o-preco-do-aluguel` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m021-c1-a-vida-real` | triagem passou | triagem passou | triagem passou | triagem passou |
| `/videos/m021-o-emprego-subiu` | triagem passou | triagem passou | triagem passou | triagem passou |
