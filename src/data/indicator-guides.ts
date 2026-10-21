/** Reading guidance; quantitative statements come exclusively from the pinned publication. */
export const indicatorGuides: Record<
  string,
  { meaning: string; caution: string; related: string[] }
> = {
  'rendimento-real': {
    meaning:
      'Um rendimento real maior representa mais poder de compra na referência de preços da pesquisa. Leia junto com desemprego e informalidade para entender quem está trabalhando.',
    caution:
      'A média considera pessoas ocupadas com rendimento. Ela pode mudar com a composição das ocupações e não descreve o ganho de cada trabalhador.',
    related: ['salario-minimo-real', 'desemprego', 'informalidade'],
  },
  'salario-minimo-real': {
    meaning:
      'O valor acompanha o poder de compra do piso nacional depois de descontar a inflação pelo INPC. A base de preços permite comparar meses compatíveis.',
    caution:
      'Reais de dezembro de 2025 não são o valor nominal pago em cada mês. O piso não representa a renda média dos trabalhadores.',
    related: ['rendimento-real', 'tempo-por-cesta', 'tr2-cv5-input'],
  },
  desemprego: {
    meaning:
      'A taxa indica a parcela da força de trabalho que está sem ocupação e procura trabalho. Uma queda significa uma parcela menor nessa situação.',
    caution:
      'Quem deixou de procurar trabalho pode sair da força de trabalho. A taxa sozinha não mostra qualidade, proteção ou remuneração das ocupações.',
    related: ['informalidade', 'rendimento-real'],
  },
  informalidade: {
    meaning:
      'A taxa acompanha a parcela das pessoas ocupadas em trabalhos classificados como informais pelo IBGE. Ajuda a ler a proteção disponível no trabalho.',
    caution:
      'Informalidade e desemprego têm denominadores diferentes. Uma pessoa pode estar ocupada e continuar sem proteção trabalhista.',
    related: ['desemprego', 'rendimento-real'],
  },
  inflacao: {
    meaning:
      'O IPCA acompanha a mudança de preços de uma cesta de consumo. A variação mensal e a acumulada em 12 meses respondem a perguntas diferentes.',
    caution:
      'Inflação menor não significa preços menores. Uma taxa positiva indica aumento de preços no período; cada família pode enfrentar uma mudança diferente.',
    related: ['inflacao-alimentacao', 'cesta-basica', 'salario-minimo-real'],
  },
  'inflacao-alimentacao': {
    meaning:
      'Mostra a mudança dos preços da alimentação comprada para consumo em casa. Ajuda a entender a pressão sobre a compra de alimentos.',
    caution:
      'Não representa toda a inflação nem refeições fora de casa. Variação mensal e acumulada em 12 meses não devem ser somadas.',
    related: ['inflacao', 'cesta-basica', 'inseguranca-alimentar'],
  },
  gasolina: {
    meaning:
      'O preço médio pesquisado pela ANP acompanha o custo nominal de um litro de gasolina comum nos postos. A referência é a semana pesquisada.',
    caution:
      'A média Brasil não é o preço de cada posto. Mudanças nominais não descontam inflação nem medem diretamente o poder de compra.',
    related: ['inflacao', 'rendimento-real'],
  },
  'cesta-basica': {
    meaning:
      'O valor mostra o custo da cesta de alimentos da pesquisa em cada capital. O tempo por cesta relaciona esse custo ao piso nacional.',
    caution:
      'As composições regionais diferem. A cesta não cobre todos os gastos da família, e uma capital não representa o Brasil.',
    related: ['tempo-por-cesta', 'inflacao-alimentacao', 'inseguranca-alimentar'],
  },
  'tempo-por-cesta': {
    meaning:
      'Traduz o custo da cesta em horas equivalentes remuneradas pelo salário mínimo. Mais horas indicam maior esforço equivalente para comprar a mesma cesta.',
    caution:
      'A referência é de 220 horas mensais. Não representa jornada observada, salário individual nem tempo líquido após descontos.',
    related: ['cesta-basica', 'salario-minimo-real', 'tr2-cv5-input'],
  },
  'onus-aluguel': {
    meaning:
      'Conta domicílios urbanos de baixa renda que comprometem mais de 30% da renda com aluguel segundo a classificação da FJP.',
    caution:
      'É uma contagem de domicílios, não o preço médio do aluguel nem o percentual de todas as famílias. Respeite as mudanças metodológicas da pesquisa.',
    related: ['pobreza', 'rendimento-real'],
  },
  'comprometimento-renda': {
    meaning:
      'Acompanha a parcela da renda agregada das famílias destinada aos pagamentos esperados de dívidas no sistema financeiro. Mais comprometimento deixa menos espaço para outras despesas.',
    caution:
      'É uma relação agregada em média móvel trimestral, não a prestação de cada família. Não cobre toda dívida fora do sistema financeiro.',
    related: ['vf2', 'rendimento-real'],
  },
  pobreza: {
    meaning:
      'Mostra a parcela de pessoas abaixo da linha de renda definida. Uma parcela menor indica menos pessoas abaixo dessa referência monetária.',
    caution:
      'A linha usa PPC de 2017, não conversão pelo câmbio do dia. Pobreza monetária não resume todas as privações.',
    related: ['desigualdade', 'inseguranca-alimentar', 'onus-aluguel'],
  },
  desigualdade: {
    meaning:
      'O Gini resume a concentração da renda numa escala de zero a um. Quanto mais próximo de zero, menor a desigualdade medida.',
    caution:
      'O índice não informa o nível de renda nem identifica quem ganhou ou perdeu. Leia junto com pobreza e rendimento.',
    related: ['pobreza', 'rendimento-real'],
  },
  'inseguranca-alimentar': {
    meaning:
      'Mostra a parcela dos domicílios com restrição de acesso à alimentação em algum grau da EBIA. Inclui situações leves, moderadas e graves.',
    caution:
      'O total não equivale apenas à fome grave. As edições disponíveis não formam necessariamente uma série anual contínua.',
    related: ['pobreza', 'cesta-basica', 'inflacao-alimentacao'],
  },
  'pib-por-pessoa': {
    meaning:
      'A variação em volume acompanha o crescimento da produção por habitante descontando a mudança de preços. Uma taxa positiva indica crescimento nessa medida.',
    caution:
      'PIB por pessoa não é a renda recebida por cada pessoa. Crescimento não informa como os ganhos foram distribuídos.',
    related: ['rendimento-real', 'desigualdade', 'pobreza'],
  },
};
