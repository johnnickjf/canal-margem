import type { SearchItem } from '@/lib/search';

/** Normaliza para comparação: minúsculas, sem acentos. */
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

type Indexed = SearchItem & { _title: string; _text: string };

/**
 * Busca simples por termos, com peso maior para o título.
 * Para acervos grandes, troque por Pagefind mantendo a mesma interface.
 */
export function createSearch(endpoint: string) {
  let index: Promise<Indexed[]> | undefined;

  const load = () =>
    (index ??= fetch(endpoint)
      .then((res) => res.json() as Promise<SearchItem[]>)
      .then((items) =>
        items.map((item) => ({
          ...item,
          _title: normalize(item.title),
          _text: normalize(item.text),
        })),
      ));

  return async (query: string): Promise<SearchItem[]> => {
    const terms = normalize(query)
      .split(/\s+/)
      .filter((t) => t.length > 1);
    if (!terms.length) return [];
    const items = await load();

    return items
      .map((item) => {
        let score = 0;
        for (const term of terms) {
          const inTitle = item._title.includes(term);
          const inText = item._text.includes(term);
          if (!inTitle && !inText) return { item, score: 0 };
          score += (inTitle ? 5 : 0) + (inText ? 1 : 0);
        }
        return { item, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item: { _title, _text, ...rest } }) => rest);
  };
}
