/** Item do índice de busca gerado em /busca.json. */
export type SearchItem = {
  type: 'Episódio' | 'Corte' | 'Análise' | 'Tema';
  title: string;
  text: string;
  url: string;
  meta: string;
};
