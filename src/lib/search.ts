/** Item do índice de busca gerado em /busca.json. */
export type SearchItem = {
  type: 'Episódio' | 'Corte' | 'Análise' | 'Tema' | 'Indicador' | 'Entenda';
  title: string;
  text: string;
  url: string;
  meta: string;
  aliases?: string[];
};

/** Normaliza acentos, caixa e pontuação, preservando palavras e números. */
export const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();

const stopWords = new Set(
  'a o as os de do da dos das e em no na nos nas um uma por para com que qual quanto como ao aos'.split(
    ' ',
  ),
);

export type SearchFilter = '' | 'indicadores' | 'entenda' | 'acervo' | 'temas';

export function searchFilter(value: string | null): SearchFilter {
  return value === 'indicadores' || value === 'entenda' || value === 'acervo' || value === 'temas'
    ? value
    : '';
}

type IndexedItem = {
  item: SearchItem;
  title: string;
  text: string;
  aliases: string;
};

export function indexSearchItems(items: SearchItem[]): IndexedItem[] {
  return items.map((item) => ({
    item,
    title: normalizeSearch(item.title),
    text: normalizeSearch(item.text),
    aliases: normalizeSearch((item.aliases ?? []).join(' ')),
  }));
}

/** Todos os termos úteis precisam ocorrer; aliases só afetam os itens associados. */
export function searchItems(index: IndexedItem[], query: string, filter: SearchFilter = '') {
  const phrase = normalizeSearch(query);
  const terms = [...new Set(phrase.split(' '))].filter(
    (term) => term.length > 1 && !stopWords.has(term),
  );
  if (!terms.length) return [];
  return index
    .filter(({ item }) => {
      if (filter === 'indicadores') return item.type === 'Indicador';
      if (filter === 'entenda') return item.type === 'Entenda';
      if (filter === 'temas') return item.type === 'Tema';
      if (filter === 'acervo') return ['Episódio', 'Corte', 'Análise'].includes(item.type);
      return true;
    })
    .map((entry) => {
      let score = entry.item.type === 'Indicador' ? 20 : entry.item.type === 'Entenda' ? 10 : 0;
      for (const term of terms) {
        const title = entry.title.includes(term);
        const alias = entry.aliases.includes(term);
        const text = entry.text.includes(term);
        if (!title && !alias && !text) return { item: entry.item, score: 0 };
        score += (title ? 5 : 0) + (alias ? 3 : 0) + (text ? 1 : 0);
      }
      if (entry.title === phrase) score += 20;
      return { item: entry.item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}
