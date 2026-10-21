/** Editorial context, independent of the edition's quantitative results. */
export const themeGuides: Record<string, { summary: string; reading: string; caution: string }> = {
  'trabalho-e-renda': {
    summary:
      'Conseguir uma ocupação, receber melhor e ter proteção no trabalho são partes diferentes da mesma pergunta. Leia renda, desemprego e informalidade em conjunto.',
    reading:
      'O rendimento real considera a mudança dos preços. O salário mínimo real acompanha o poder de compra do piso nacional. Desemprego e informalidade ajudam a entender quem participa desse mercado e em quais condições.',
    caution:
      'Uma média de renda não descreve cada trabalhador. A taxa de desemprego considera quem está na força de trabalho; sua queda, sozinha, não informa a qualidade das ocupações.',
  },
  'custo-de-vida': {
    summary:
      'A compra do mês, a alimentação, o combustível e o aluguel pesam de formas diferentes no orçamento. Explore preços, inflação e tempo de trabalho para entender essas pressões.',
    reading:
      'Inflação mede a mudança dos preços, enquanto a cesta básica e a gasolina mostram custos em reais. O tempo por cesta traduz o custo em horas equivalentes no salário mínimo. O ônus do aluguel trata dos domicílios de baixa renda.',
    caution:
      'Inflação menor não significa preços menores. A cesta varia por capital e composição regional; ela não representa todos os gastos de uma família. O tempo equivalente usa 220 horas mensais, sem representar a jornada de cada pessoa.',
  },
  'vida-financeira': {
    summary:
      'Parcelas e juros comprometem parte da renda antes das outras despesas. O comprometimento da renda ajuda a acompanhar essa pressão sobre as famílias.',
    reading:
      'O indicador relaciona pagamentos esperados de dívidas no sistema financeiro à renda agregada das famílias. Ele permite acompanhar a parcela destinada ao serviço dessas dívidas.',
    caution:
      'O resultado agregado não é a parcela paga por cada família e não cobre toda dívida fora do sistema financeiro. Comprometimento da renda e inadimplência medem situações diferentes.',
  },
  'qualidade-de-vida': {
    summary:
      'A renda disponível e o acesso à alimentação ajudam a entender as condições de vida. Pobreza, desigualdade e insegurança alimentar mostram aspectos diferentes dessas condições.',
    reading:
      'A pobreza monetária compara renda com uma linha definida. O Gini resume a distribuição da renda. A insegurança alimentar registra restrições de acesso à alimentação nos domicílios.',
    caution:
      'Uma melhora na média não garante melhora para todos. As pesquisas têm períodos e populações de referência próprios; nem toda medida está disponível a cada ano.',
  },
  'economia-e-estado': {
    summary:
      'A produção por habitante ajuda a acompanhar a atividade econômica em relação ao tamanho da população. É um ponto de partida para discutir os recursos disponíveis no país.',
    reading:
      'A variação em volume do PIB por pessoa acompanha o crescimento da produção por habitante descontando a mudança dos preços.',
    caution:
      'PIB por pessoa não equivale à renda recebida por cada pessoa. Seu crescimento não informa, sozinho, como os ganhos foram distribuídos nem o efeito de uma política pública.',
  },
};
