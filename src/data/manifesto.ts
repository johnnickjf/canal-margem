/**
 * Manifesto editorial — fonte única para a página /manifesto e o trecho da home.
 * Teses curtas (2–5 palavras no título), argumento antes de conclusão.
 */

export type Thesis = {
  title: string;
  body: string;
};

export const manifesto = {
  title: 'Outro ponto de vista é [possível]',
  opening:
    'A MARGEM nasce de uma suspeita simples: boa parte do debate sobre política e economia acontece longe de onde a vida acontece. Entre o gráfico e a fila do ônibus, alguma coisa se perde. É desse intervalo que a gente fala.',
  theses: [
    {
      title: 'A vida real também é política',
      body: 'Política não acontece só em Brasília. Ela está no preço da passagem, na fila do posto de saúde, no aluguel que vence dia cinco e na escala que não deixa tempo para os filhos. Começamos por aí.',
    },
    {
      title: 'Economia é gente',
      body: 'Antes de ser juro, índice e projeção, economia é o que se come, onde se mora e quanto se trabalha. Nosso trabalho é traduzir os números de volta para as pessoas que eles descrevem.',
    },
    {
      title: 'Pergunta antes da conclusão',
      body: 'Não começamos pelo veredito. Começamos pela pergunta — quem paga? quem ganha? quem decide? — e construímos o argumento à vista de quem lê, passo a passo.',
    },
    {
      title: 'Dado com contexto',
      body: 'Número sem contexto pode enganar tanto quanto uma mentira. Mostramos de onde vem o dado, o que ele mede, desde quando e o que fica de fora dele.',
    },
    {
      title: 'Contraponto honesto',
      body: 'Apresentamos o melhor argumento de quem discorda, não a caricatura dele. Quem nos acompanha merece decidir com a informação completa na mesa.',
    },
    {
      title: 'Ponto de vista, sem bandeira',
      body: 'Não somos braço de partido, nem neutros de fachada. Temos um olhar declarado: o de quem vive de salário, depende do serviço público e mora longe do centro das decisões.',
    },
    {
      title: 'Da margem se constrói um país',
      body: 'Olhar a partir da margem é olhar para a maioria. É dali que vêm as perguntas que nem sempre cabem no centro do debate — e é para lá que as respostas precisam voltar.',
    },
  ] satisfies Thesis[],
  closing: 'Mesmas pessoas. Outras perguntas.',
} as const;

/** Formato editorial recomendado pelo manual (seção 13). */
export const editorialFormula = [
  'Gancho',
  'Problema',
  'Dado',
  'Contexto',
  'Exemplo',
  'Contraponto',
  'Interpretação',
  'Conclusão',
] as const;

export const voice = ['Crítico', 'Claro', 'Humano', 'Popular', 'Objetivo', 'Contextual'] as const;
