/** Reading guidance; quantitative statements come exclusively from the pinned publication. */
export const indicatorGuides: Record<
  string,
  { importance: string; meaning: string; caution: string; related: string[] }
> = {
  'rendimento-real': {
    importance:
      'Ajuda a acompanhar o poder de compra do trabalho entre pessoas ocupadas com rendimento.',
    meaning:
      'Um rendimento real maior representa mais poder de compra na referência de preços da pesquisa. Leia junto com desemprego e informalidade para entender quem está trabalhando.',
    caution:
      'A média considera pessoas ocupadas com rendimento. Ela pode mudar com a composição das ocupações e não descreve o ganho de cada trabalhador.',
    related: ['salario-minimo-real', 'desemprego', 'informalidade'],
  },
  'salario-minimo-real': {
    importance:
      'Permite acompanhar se o piso nacional preserva poder de compra, com o mesmo deflator e base de preços.',
    meaning:
      'O valor acompanha o poder de compra do piso nacional depois de descontar a inflação pelo INPC. A base de preços permite comparar meses compatíveis.',
    caution:
      'Reais de dezembro de 2025 não são o valor nominal pago em cada mês. O piso não representa a renda média dos trabalhadores.',
    related: ['rendimento-real', 'tempo-por-cesta', 'tr2-cv5-input'],
  },
  desemprego: {
    importance:
      'Mostra a dificuldade de conseguir trabalho entre as pessoas que fazem parte da força de trabalho.',
    meaning:
      'A taxa indica a parcela da força de trabalho que está sem ocupação e procura trabalho. Uma queda significa uma parcela menor nessa situação.',
    caution:
      'Quem deixou de procurar trabalho pode sair da força de trabalho. A taxa sozinha não mostra qualidade, proteção ou remuneração das ocupações.',
    related: ['informalidade', 'rendimento-real'],
  },
  informalidade: {
    importance:
      'Acrescenta uma leitura da inserção no trabalho que a taxa de desemprego não mostra.',
    meaning:
      'A taxa acompanha a parcela das pessoas ocupadas em trabalhos classificados como informais pelo IBGE. Ajuda a ler a proteção disponível no trabalho.',
    caution:
      'Informalidade e desemprego têm denominadores diferentes. Uma pessoa pode estar ocupada e continuar sem proteção trabalhista.',
    related: ['desemprego', 'rendimento-real'],
  },
  inflacao: {
    importance:
      'Ajuda a interpretar a pressão dos preços sobre o orçamento e a diferença entre renda nominal e real.',
    meaning:
      'O IPCA acompanha a mudança de preços de uma cesta de consumo. A variação mensal e a acumulada em 12 meses respondem a perguntas diferentes.',
    caution:
      'Inflação menor não significa preços menores. Uma taxa positiva indica aumento de preços no período; cada família pode enfrentar uma mudança diferente.',
    related: ['inflacao-alimentacao', 'cesta-basica', 'salario-minimo-real'],
  },
  'inflacao-alimentacao': {
    importance: 'Ajuda a acompanhar uma despesa essencial, cujo peso varia entre famílias.',
    meaning:
      'Mostra a mudança dos preços da alimentação comprada para consumo em casa. Ajuda a entender a pressão sobre a compra de alimentos.',
    caution:
      'Não representa toda a inflação nem refeições fora de casa. Variação mensal e acumulada em 12 meses não devem ser somadas.',
    related: ['inflacao', 'cesta-basica', 'inseguranca-alimentar'],
  },
  gasolina: {
    importance:
      'Acompanha um custo de deslocamento, com o recorte e a frequência da pesquisa de preços.',
    meaning:
      'O preço médio pesquisado pela ANP acompanha o custo nominal de um litro de gasolina comum nos postos. A referência é a semana pesquisada.',
    caution:
      'A média Brasil não é o preço de cada posto. Mudanças nominais não descontam inflação nem medem diretamente o poder de compra.',
    related: ['inflacao', 'rendimento-real'],
  },
  'cesta-basica': {
    importance:
      'Oferece uma referência do custo de alimentos essenciais, respeitando a composição da cesta de cada região.',
    meaning:
      'O valor mostra o custo da cesta de alimentos da pesquisa em cada capital. O tempo por cesta relaciona esse custo ao piso nacional.',
    caution:
      'As composições regionais diferem. A cesta não cobre todos os gastos da família, e uma capital não representa o Brasil.',
    related: ['tempo-por-cesta', 'inflacao-alimentacao', 'inseguranca-alimentar'],
  },
  'tempo-por-cesta': {
    importance:
      'Expressa o custo dos alimentos em uma referência de remuneração, aproximando preço e esforço de compra.',
    meaning:
      'Traduz o custo da cesta em horas equivalentes remuneradas pelo salário mínimo. Mais horas indicam maior esforço equivalente para comprar a mesma cesta.',
    caution:
      'A referência é de 220 horas mensais. Não representa jornada observada, salário individual nem tempo líquido após descontos.',
    related: ['cesta-basica', 'salario-minimo-real', 'tr2-cv5-input'],
  },
  'onus-aluguel': {
    importance:
      'Ajuda a dimensionar a dificuldade de pagar moradia entre domicílios urbanos de baixa renda.',
    meaning:
      'Conta domicílios urbanos de baixa renda que comprometem mais de 30% da renda com aluguel segundo a classificação da FJP.',
    caution:
      'É uma contagem de domicílios, não o preço médio do aluguel nem o percentual de todas as famílias. Respeite as mudanças metodológicas da pesquisa.',
    related: ['pobreza', 'rendimento-real'],
  },
  'comprometimento-renda': {
    importance:
      'Ajuda a acompanhar o espaço que os pagamentos de dívidas ocupam na renda agregada das famílias.',
    meaning:
      'Acompanha a parcela da renda agregada das famílias destinada aos pagamentos esperados de dívidas no sistema financeiro. Mais comprometimento deixa menos espaço para outras despesas.',
    caution:
      'É uma relação agregada em média móvel trimestral, não a prestação de cada família. Não cobre toda dívida fora do sistema financeiro.',
    related: ['vf2', 'rendimento-real'],
  },
  pobreza: {
    importance:
      'Ajuda a dimensionar a insuficiência de renda em relação a uma linha explícita, sem resumir todas as privações.',
    meaning:
      'Mostra a parcela de pessoas abaixo da linha de renda definida. Uma parcela menor indica menos pessoas abaixo dessa referência monetária.',
    caution:
      'A linha usa PPC de 2017, não conversão pelo câmbio do dia. Pobreza monetária não resume todas as privações.',
    related: ['desigualdade', 'inseguranca-alimentar', 'onus-aluguel'],
  },
  desigualdade: {
    importance: 'Mostra uma dimensão da distribuição da renda que a média, sozinha, esconde.',
    meaning:
      'O Gini resume a concentração da renda numa escala de zero a um. Quanto mais próximo de zero, menor a desigualdade medida.',
    caution:
      'O índice não informa o nível de renda nem identifica quem ganhou ou perdeu. Leia junto com pobreza e rendimento.',
    related: ['pobreza', 'rendimento-real'],
  },
  'inseguranca-alimentar': {
    importance:
      'Ajuda a dimensionar dificuldades de acesso à alimentação que preços e renda, isoladamente, não descrevem.',
    meaning:
      'Mostra a parcela dos domicílios com restrição de acesso à alimentação em algum grau da EBIA. Inclui situações leves, moderadas e graves.',
    caution:
      'O total não equivale apenas à fome grave. As edições disponíveis não formam necessariamente uma série anual contínua.',
    related: ['pobreza', 'cesta-basica', 'inflacao-alimentacao'],
  },
  'pib-por-pessoa': {
    importance:
      'Relaciona a evolução da produção ao tamanho da população para acompanhar a atividade por habitante.',
    meaning:
      'A variação em volume acompanha o crescimento da produção por habitante descontando a mudança de preços. Uma taxa positiva indica crescimento nessa medida.',
    caution:
      'PIB por pessoa não é a renda recebida por cada pessoa. Crescimento não informa como os ganhos foram distribuídos.',
    related: ['rendimento-real', 'desigualdade', 'pobreza'],
  },
  tr3: {
    importance: 'Ajuda a contextualizar a duração do trabalho junto com ocupação e rendimento.',
    meaning:
      'A medida acompanha horas habitualmente trabalhadas por semana. Confira a população e o recorte publicados.',
    caution:
      'Não é uma jornada contratual de todas as pessoas. Dividir o rendimento médio pelas horas médias não produz automaticamente rendimento por hora comparável.',
    related: ['rendimento-real', 'informalidade'],
  },
  vf2: {
    importance: 'Acrescenta contexto sobre atrasos nos pagamentos do crédito bancário.',
    meaning:
      'A inadimplência bancária acompanha atrasos conforme o critério da série publicada. Confira modalidade, população e janela de atraso.',
    caution:
      'Não equivale a todo endividamento das famílias nem ao comprometimento da renda. A cobertura está limitada ao recorte da série.',
    related: ['comprometimento-renda'],
  },
  context: {
    importance:
      'Participação e subutilização ampliam a leitura do mercado de trabalho além da taxa de desemprego.',
    meaning:
      'Esta página reúne medidas complementares com denominadores próprios. Leia a definição de cada recorte publicado.',
    caution:
      'Medidas distintas não devem ser somadas. Uma mudança na participação pode alterar a leitura da taxa de desemprego.',
    related: ['desemprego', 'informalidade', 'rendimento-real'],
  },
  'tr2-input': {
    importance: 'É a referência de preços usada no cálculo do salário mínimo real do Margem.',
    meaning:
      'O número-índice do INPC permite ajustar valores nominais à base de preços definida no cálculo.',
    caution:
      'O nível do índice não é a inflação mensal em porcentagem. INPC e IPCA têm populações e pesos distintos.',
    related: ['salario-minimo-real', 'inflacao'],
  },
  'tr2-cv5-input': {
    importance:
      'É o piso em dinheiro usado como entrada do mínimo real e do tempo equivalente por cesta.',
    meaning:
      'O salário mínimo nominal é o valor do piso nacional no mês, sem descontar a inflação.',
    caution:
      'Não é a remuneração média ou líquida de cada pessoa. No tempo por cesta, a referência de 220 horas é uma equivalência de cálculo.',
    related: ['salario-minimo-real', 'tempo-por-cesta'],
  },
};
