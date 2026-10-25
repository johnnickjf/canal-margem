import { indexSearchItems, type SearchFilter, type SearchItem, searchItems } from '@/lib/search';

/** Um índice por página; falhas permitem nova tentativa no próximo envio. */
export function createSearch(endpoint: string) {
  let index: Promise<ReturnType<typeof indexSearchItems>> | undefined;
  const load = () =>
    (index ??= fetch(endpoint, { signal: AbortSignal.timeout(10_000) })
      .then(async (response) => {
        if (!response.ok) throw new Error('Índice de busca indisponível.');
        const items: unknown = await response.json();
        if (
          !Array.isArray(items) ||
          items.some(
            (item) =>
              !item ||
              ![
                'Episódio',
                'Corte',
                'Análise',
                'Tema',
                'Indicador',
                'Entenda',
                'Política',
              ].includes(item.type) ||
              ['title', 'text', 'url', 'meta'].some((key) => typeof item[key] !== 'string') ||
              !/^\/(?![\\/])/.test(item.url) ||
              Array.from(item.url as string).some(
                (character) => character === '\\' || character.charCodeAt(0) <= 32,
              ) ||
              (item.aliases !== undefined &&
                (!Array.isArray(item.aliases) ||
                  item.aliases.some((alias: unknown) => typeof alias !== 'string'))),
          )
        )
          throw new Error('Índice de busca inválido.');
        return indexSearchItems(items as SearchItem[]);
      })
      .catch((error: unknown) => {
        index = undefined;
        throw error;
      }));

  return async (query: string, filter: SearchFilter = ''): Promise<SearchItem[]> => {
    if (!query.trim()) return [];
    return searchItems(await load(), query, filter);
  };
}
