/** Editorial explanations, independent of the data publication. Examples are hypothetical. */
export type Concept = {
  slug: string;
  title: string;
  question: string;
  definition: string;
  importance: string;
  interpretation: string;
  example: string;
  pitfalls: string[];
  indicators: string[];
  themes: string[];
  related: string[];
  sources: { name: string; url: string }[];
};

const inflation = { name: 'IBGE — Inflação', url: 'https://www.ibge.gov.br/explica/inflacao.php' };
const gdp = {
  name: 'IBGE — Produto Interno Bruto',
  url: 'https://www.ibge.gov.br/explica/pib.php',
};
const income = {
  name: 'IBGE — PNAD Contínua: rendimentos e notas de deflação',
  url: 'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9173-pesquisa-nacional-por-amostra-de-domicilios-continua-trabalho-e-rendimento.html',
};
const fiscal = {
  name: 'Banco Central — Estatísticas fiscais',
  url: 'https://www.bcb.gov.br/estatisticas/estatisticasfiscais',
};

export const conceptEditorial = { author: 'Margem', reviewedAt: '2026-10-21' };

export const concepts: Concept[] = [
  {
    slug: 'inflacao',
    title: 'Inflação',
    question: 'Por que o dinheiro compra menos?',
    definition:
      'Inflação é o aumento dos preços de bens e serviços ao longo do tempo. Um índice como o IPCA reúne mudanças de muitos preços em uma cesta de consumo, com pesos diferentes.',
    importance:
      'Quando os preços sobem e a renda não acompanha, fica mais difícil manter as mesmas compras. A cesta de cada família pode diferir da cesta do índice.',
    interpretation:
      'Confira o índice e o período: inflação do mês e acumulada em 12 meses são medidas distintas. Uma taxa positiva menor indica que os preços continuam subindo, mais devagar.',
    example:
      'Uma cesta hipotética de R$ 100 que sobe 10% passa a R$ 110. Se depois sobe 5%, chega a R$ 115,50: a inflação diminuiu, mas a cesta não ficou mais barata.',
    pitfalls: [
      'Confundir inflação menor com queda de preços.',
      'Somar taxas mensais para obter a acumulada; as variações se compõem.',
      'Tratar o IPCA como a mudança exata dos gastos de toda família.',
    ],
    indicators: [
      'inflacao',
      'inflacao-alimentacao',
      'cesta-basica',
      'salario-minimo-real',
      'tr2-input',
    ],
    themes: ['custo-de-vida', 'trabalho-e-renda'],
    related: ['renda-real', 'renda-nominal', 'selic'],
    sources: [inflation],
  },
  {
    slug: 'renda-real',
    title: 'Renda real',
    question: 'Ganhar mais significa comprar mais?',
    definition:
      'Renda real é a renda ajustada por um índice de preços para expressar poder de compra em uma base de referência. O ajuste permite comparar valores de períodos diferentes.',
    importance:
      'Um aumento em reais pode apenas repor preços mais altos. A renda real ajuda a distinguir esse efeito de um ganho de poder de compra.',
    interpretation:
      'Compare valores na mesma base de preços e confira o deflator. No Margem, o mínimo real usa INPC; o rendimento da PNAD mantém o método e a base da divulgação do IBGE.',
    example:
      'Se uma renda hipotética passa de R$ 1.000 para R$ 1.100 e os preços da referência sobem 10%, o poder de compra fica igual. Os R$ 100 adicionais não são ganho real.',
    pitfalls: [
      'Comparar reais de bases diferentes.',
      'Trocar o deflator de uma série sem preservar seu método.',
      'Confundir a média dos ocupados com o ganho de cada pessoa.',
    ],
    indicators: ['rendimento-real', 'salario-minimo-real', 'tempo-por-cesta'],
    themes: ['trabalho-e-renda', 'custo-de-vida'],
    related: ['renda-nominal', 'inflacao', 'desigualdade'],
    sources: [income, inflation],
  },
  {
    slug: 'renda-nominal',
    title: 'Renda nominal',
    question: 'O que o valor em reais conta?',
    definition:
      'Renda nominal é o valor em dinheiro no período a que se refere, sem descontar a mudança dos preços. Ela informa a quantia recebida ou definida, como o piso salarial de um mês.',
    importance:
      'Esse valor entra no orçamento e no pagamento das contas. Para saber se ele compra mais ao longo do tempo, também precisamos conhecer a inflação.',
    interpretation:
      'Confira se a renda é habitual ou efetivamente recebida, individual ou domiciliar. Relacione preços e renda nominal do mesmo período antes de calcular uma proporção.',
    example:
      'Uma renda hipotética que passa de R$ 2.000 para R$ 2.100 aumenta 5% em termos nominais. Sem a mudança dos preços, esse dado não informa se houve ganho de poder de compra.',
    pitfalls: [
      'Chamar todo aumento nominal de ganho real.',
      'Confundir salário mínimo com rendimento médio.',
      'Misturar renda individual com renda domiciliar por pessoa.',
    ],
    indicators: ['tr2-cv5-input', 'rendimento-real', 'tempo-por-cesta', 'comprometimento-renda'],
    themes: ['trabalho-e-renda', 'vida-financeira'],
    related: ['renda-real', 'inflacao'],
    sources: [income],
  },
  {
    slug: 'pib',
    title: 'PIB',
    question: 'O que significa a economia crescer?',
    definition:
      'O Produto Interno Bruto mede o valor dos bens e serviços finais produzidos em um território durante um período. É uma medida de produção, não um estoque de riqueza.',
    importance:
      'Ajuda a acompanhar a atividade econômica. Para entender as condições de vida, é preciso olhar também para renda, distribuição e população.',
    interpretation:
      'Separe valores a preços correntes de mudanças em volume, que descontam o efeito dos preços. Confira também se a comparação é anual ou trimestral.',
    example:
      'Se a produção hipotética mantém a quantidade e apenas seus preços dobram, seu valor nominal dobra. Isso não significa que o volume produzido dobrou.',
    pitfalls: [
      'Tratar o PIB como dinheiro disponível para gastar.',
      'Confundir crescimento nominal com crescimento em volume.',
      'Concluir que toda pessoa ganhou renda quando o PIB cresceu.',
    ],
    indicators: ['pib-por-pessoa', 'rendimento-real', 'desigualdade'],
    themes: ['economia-e-estado'],
    related: ['pib-per-capita', 'desigualdade'],
    sources: [gdp],
  },
  {
    slug: 'pib-per-capita',
    title: 'PIB per capita',
    question: 'Produção por pessoa é renda de cada pessoa?',
    definition:
      'PIB per capita é o PIB dividido pela população. Expressa a produção média por habitante, sem indicar como ela é distribuída.',
    importance:
      'Permite ler a produção considerando o tamanho da população. Uma produção total maior pode acompanhar uma produção por habitante menor.',
    interpretation:
      'No Margem, o indicador apresenta a variação anual em volume do PIB por pessoa, em porcentagem. Uma taxa de crescimento não é um valor de renda em reais.',
    example:
      'Uma produção hipotética de R$ 1.000 para dez habitantes corresponde a R$ 100 por pessoa. Essa divisão não significa que cada habitante recebeu R$ 100.',
    pitfalls: [
      'Ler a média como pagamento recebido por cada pessoa.',
      'Ignorar diferenças de distribuição da renda.',
      'Comparar taxas em volume com valores em reais correntes.',
    ],
    indicators: ['pib-por-pessoa', 'desigualdade', 'pobreza'],
    themes: ['economia-e-estado', 'qualidade-de-vida'],
    related: ['pib', 'desigualdade'],
    sources: [gdp],
  },
  {
    slug: 'divida-publica',
    title: 'Dívida pública',
    question: 'O que o governo deve e como se financia?',
    definition:
      'Dívida pública é o conjunto de obrigações financeiras dos governos em uma data. Pode incluir títulos e contratos, com diferentes prazos e formas de remuneração.',
    importance:
      'O custo e o vencimento dessas obrigações influenciam o financiamento do Estado. Parte da dívida que vence pode ser refinanciada por novas emissões.',
    interpretation:
      'Confira o conceito: dívida bruta, líquida e Dívida Pública Federal têm abrangências diferentes. O estoque é medido em uma data; déficit é um resultado ao longo de um período.',
    example:
      'Refinanciar R$ 100 hipotéticos que vencem, emitindo outros R$ 100, substitui uma obrigação. O valor emitido, sozinho, não revela o aumento líquido da dívida.',
    pitfalls: [
      'Confundir dívida do governo com dívidas das famílias.',
      'Tratar toda emissão como novo gasto.',
      'Comparar percentuais do PIB sem observar também o denominador.',
    ],
    indicators: ['pib-por-pessoa'],
    themes: ['economia-e-estado'],
    related: ['deficit', 'juros', 'pib'],
    sources: [
      { name: 'Tesouro Nacional — A dinâmica da dívida', url: 'https://tesouro.github.io/divida/' },
      fiscal,
    ],
  },
  {
    slug: 'deficit',
    title: 'Déficit',
    question: 'Qual é a diferença entre déficit e dívida?',
    definition:
      'Déficit é um resultado negativo das contas públicas em um período. O resultado primário exclui os juros; o resultado nominal também considera os juros nominais apropriados.',
    importance:
      'Ajuda a compreender as necessidades de financiamento do setor público. A leitura depende de quais entes e quais contas entram na apuração.',
    interpretation:
      'Confira se o número é primário ou nominal, o período e a abrangência institucional. Déficit é um fluxo; dívida é um estoque, que também pode mudar por outros ajustes.',
    example:
      'Se receitas e despesas primárias hipotéticas se igualam, o resultado primário é zero. Com R$ 10 de juros líquidos apropriados, o resultado nominal pode ser deficitário em R$ 10.',
    pitfalls: [
      'Usar déficit primário e nominal como sinônimos.',
      'Confundir o resultado de um mês com o acumulado do ano.',
      'Inferir qualidade de cada gasto apenas pelo saldo agregado.',
    ],
    indicators: ['pib-por-pessoa'],
    themes: ['economia-e-estado'],
    related: ['divida-publica', 'juros', 'pib'],
    sources: [fiscal],
  },
  {
    slug: 'juros',
    title: 'Juros',
    question: 'Quanto custa usar dinheiro ao longo do tempo?',
    definition:
      'Juros são a remuneração pelo uso de dinheiro durante um período. Para quem toma um empréstimo, compõem seu custo; para quem empresta, compõem o retorno.',
    importance:
      'Mudam o valor a pagar por uma dívida e a remuneração de aplicações. Prazo e forma de capitalização alteram o resultado.',
    interpretation:
      'Leia a taxa junto com sua periodicidade. Em juros compostos, os juros passam a integrar a base do período seguinte. O custo efetivo total do crédito inclui também outros encargos.',
    example:
      'R$ 100 hipotéticos a 10% ao mês, sem pagamentos, tornam-se R$ 110 após um mês e R$ 121 após dois, sob juros compostos. A taxa é apenas ilustrativa.',
    pitfalls: [
      'Comparar taxa mensal com anual diretamente.',
      'Confundir taxa de juros com o custo total do empréstimo.',
      'Achar que a Selic é a taxa cobrada em todo crédito.',
    ],
    indicators: ['comprometimento-renda', 'vf2'],
    themes: ['vida-financeira', 'economia-e-estado'],
    related: ['selic', 'inflacao', 'divida-publica'],
    sources: [
      {
        name: 'Banco Central — Caderno de Educação Financeira',
        url: 'https://www.bcb.gov.br/content/cidadaniafinanceira/documentos_cidadania/Cuidando_do_seu_dinheiro_Gestao_de_Financas_Pessoais/caderno_cidadania_financeira.pdf',
      },
    ],
  },
  {
    slug: 'selic',
    title: 'Selic',
    question: 'Por que a taxa básica aparece nas notícias?',
    definition:
      'A Selic é a taxa básica de juros da economia brasileira. O Copom define uma meta, e o Banco Central atua para que a taxa efetiva das operações de referência fique próxima dela.',
    importance:
      'Ela influencia outras taxas, o custo do crédito e decisões de consumo e investimento. É um instrumento da política monetária para o controle da inflação.',
    interpretation:
      'Diferencie a meta da taxa efetiva e confira o período de vigência. Uma mudança influencia a economia ao longo do tempo; o efeito não é imediato nem igual para todos.',
    example:
      'Uma mudança hipotética na meta não altera automaticamente, na mesma proporção, a prestação de um contrato já firmado. As condições do contrato também importam.',
    pitfalls: [
      'Confundir Selic com juros do cartão ou de qualquer financiamento.',
      'Tratar meta e taxa efetiva como a mesma série.',
      'Atribuir toda mudança da inflação apenas à Selic.',
    ],
    indicators: ['inflacao', 'comprometimento-renda'],
    themes: ['economia-e-estado', 'vida-financeira'],
    related: ['juros', 'inflacao'],
    sources: [
      {
        name: 'Banco Central — Taxa Selic',
        url: 'https://www.bcb.gov.br/controleinflacao/taxaselic',
      },
    ],
  },
  {
    slug: 'informalidade',
    title: 'Informalidade',
    question: 'Estar trabalhando significa ter proteção?',
    definition:
      'Na PNAD Contínua, a informalidade reúne empregados privados e domésticos sem carteira, empregadores e trabalhadores por conta própria sem CNPJ, além de trabalhadores familiares auxiliares.',
    importance:
      'Mostra uma dimensão da inserção no trabalho que a taxa de desemprego não revela. Estar ocupado não garante vínculo formal.',
    interpretation:
      'A taxa usa a população ocupada como denominador. Compare a mesma classificação e o mesmo período; leia junto com rendimento e desemprego.',
    example:
      'Se quatro de dez pessoas ocupadas hipotéticas forem classificadas como informais, a taxa será 40%. As pessoas desocupadas não entram nesse denominador.',
    pitfalls: [
      'Confundir informalidade com desemprego.',
      'Classificar todo trabalho por conta própria como informal.',
      'Concluir que a taxa mede a renda ou toda a proteção de cada pessoa.',
    ],
    indicators: ['informalidade', 'desemprego', 'rendimento-real'],
    themes: ['trabalho-e-renda'],
    related: ['renda-real', 'desigualdade'],
    sources: [
      {
        name: 'IBGE — PNAD Contínua: classificação da informalidade',
        url: 'https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/46676-pnad-continua-trimestral-desocupacao-sobe-em-15-das-27-ufs-no-1-trimestre-de-2026',
      },
    ],
  },
  {
    slug: 'desigualdade',
    title: 'Desigualdade',
    question: 'Como a renda se distribui?',
    definition:
      'Desigualdade de renda descreve diferenças na distribuição dos rendimentos. O índice de Gini resume a concentração em uma escala de zero a um: valores menores indicam menor desigualdade medida.',
    importance:
      'Uma média de renda pode subir sem que o ganho alcance todos. Observar a distribuição ajuda a interpretar quem participa dos resultados da economia.',
    interpretation:
      'Confira qual renda e população entram no índice. No Margem, o Gini usa rendimento domiciliar por pessoa de todas as fontes, incluindo benefícios.',
    example:
      'Duas populações hipotéticas podem ter a mesma renda média e distribuições diferentes: em uma, todos recebem valores próximos; na outra, poucos concentram a maior parte.',
    pitfalls: [
      'Confundir menor desigualdade com menor pobreza em qualquer situação.',
      'Usar Gini para identificar o ganho de cada grupo.',
      'Comparar índices de rendas e universos diferentes.',
    ],
    indicators: ['desigualdade', 'pobreza', 'rendimento-real', 'pib-por-pessoa'],
    themes: ['qualidade-de-vida', 'trabalho-e-renda'],
    related: ['renda-real', 'pib-per-capita'],
    sources: [
      {
        name: 'IBGE — Indicadores Sociais Mínimos: conceito de Gini',
        url: 'https://www.ibge.gov.br/estatisticas/sociais/populacao/17374-indicadores-sociaisminimos.html',
      },
    ],
  },
];

/** Explicit editorial relations; they neither add series nor assert causality. */
export const indicatorConcepts: Record<string, string[]> = {
  'rendimento-real': ['renda-real', 'renda-nominal', 'desigualdade'],
  'salario-minimo-real': ['renda-real', 'renda-nominal', 'inflacao'],
  desemprego: ['informalidade', 'renda-real'],
  informalidade: ['informalidade', 'renda-real'],
  inflacao: ['inflacao', 'selic'],
  'inflacao-alimentacao': ['inflacao', 'renda-real'],
  gasolina: ['inflacao', 'renda-nominal'],
  'cesta-basica': ['inflacao', 'renda-nominal'],
  'tempo-por-cesta': ['renda-nominal', 'renda-real', 'inflacao'],
  'onus-aluguel': ['renda-nominal', 'desigualdade'],
  'comprometimento-renda': ['juros', 'renda-nominal', 'selic'],
  pobreza: ['desigualdade', 'renda-real'],
  desigualdade: ['desigualdade', 'renda-real'],
  'inseguranca-alimentar': ['desigualdade', 'inflacao'],
  'pib-por-pessoa': ['pib-per-capita', 'pib', 'desigualdade'],
  tr3: ['renda-real', 'informalidade'],
  vf2: ['juros', 'renda-nominal'],
  context: ['informalidade', 'renda-real'],
  'tr2-input': ['inflacao', 'renda-real'],
  'tr2-cv5-input': ['renda-nominal', 'renda-real'],
};
