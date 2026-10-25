import { afterEach, describe, expect, it, vi } from 'vitest';
import { concepts } from '../../src/data/concepts';
import { conceptAliases, indicatorAliases } from '../../src/data/search-aliases';
import { capturePlatform } from '../../src/lib/platform-build';
import { platformSearchItems } from '../../src/lib/platform-search';
import {
  indexSearchItems,
  normalizeSearch,
  type SearchItem,
  searchFilter,
  searchItems,
} from '../../src/lib/search';
import { createSearch } from '../../src/scripts/search';

const platform = await capturePlatform();
const catalog = platformSearchItems(platform);
const editorial: SearchItem = {
  type: 'Análise',
  title: 'Comida na mesa',
  text: 'Aluguel, salário e habitação no orçamento.',
  url: '/analises/comida',
  meta: 'Análise editorial',
};
const index = indexSearchItems([...catalog, editorial]);
const urls = (query: string) => searchItems(index, query).map((item) => item.url);

afterEach(() => vi.unstubAllGlobals());

describe('descoberta em linguagem cotidiana', () => {
  it.each([
    ['comida', ['inflacao-alimentacao', 'cesta-basica', 'inseguranca-alimentar']],
    ['gasolina', ['gasolina']],
    ['salário', ['rendimento-real', 'salario-minimo-real', 'tr2-cv5-input']],
    ['aluguel', ['onus-aluguel']],
    ['dívida', ['comprometimento-renda', 'vf2']],
    ['supermercado', ['inflacao-alimentacao', 'cesta-basica']],
    ['sem carteira', ['informalidade']],
    ['contas atrasadas', ['vf2']],
    ['combustível', ['gasolina']],
    ['fome', ['inseguranca-alimentar']],
  ])('%s encontra indicadores pertinentes', (query, slugs) => {
    for (const slug of slugs) expect(urls(query)).toContain(`/indicador/${slug}`);
    expect(searchItems(index, query)[0].type).toBe('Indicador');
  });

  it('normaliza acentos, caixa, espaços e pontuação em consultas compostas', () => {
    expect(urls('SALÁRIO mínimo!')).toEqual(urls('salario   minimo'));
    expect(urls('o preço da gasolina?')).toContain('/indicador/gasolina');
    expect(urls('dívida pública')).toContain('/entenda/divida-publica');
    expect(urls('dívida pública')).not.toContain('/indicador/comprometimento-renda');
    expect(normalizeSearch('  INFLAÇÃO — alimentação ')).toBe('inflacao alimentacao');
  });

  it('exige todos os termos úteis e não transforma ausência em resultado', () => {
    for (const query of ['', ' ', 'a', 'de e para', '!!!', 'zzzxqv', 'comida zzzxqv'])
      expect(urls(query)).toEqual([]);
    expect(urls('salário')).not.toContain('/indicador/gasolina');
    expect(urls('salário mediano')).toEqual([]);
  });

  it('preserva o acervo e filtra tipos sem misturar conceitos e medidas', () => {
    expect(urls('comida')).toContain(editorial.url);
    for (const [filter, allowed] of [
      ['indicadores', ['Indicador']],
      ['entenda', ['Entenda']],
      ['acervo', ['Análise', 'Episódio', 'Corte']],
      ['temas', ['Tema']],
      ['politicas', ['Política']],
    ] as const) {
      const results = searchItems(index, filter === 'temas' ? 'vida' : 'salário', filter);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((item) => (allowed as readonly string[]).includes(item.type))).toBe(
        true,
      );
    }
    expect(searchFilter('desconhecido')).toBe('');
    expect(searchFilter(null)).toBe('');
    expect(searchFilter('entenda')).toBe('entenda');
    expect(searchFilter('politicas')).toBe('politicas');
    expect(urls('reforma trabalhista')).toContain('/politicas/reforma-trabalhista-2017');
  });

  it('indexa todas as rotas da edição e os conceitos sem inventar indicadores', () => {
    expect(catalog.filter((item) => item.type === 'Indicador')).toHaveLength(20);
    expect(catalog.filter((item) => item.type === 'Entenda')).toHaveLength(12);
    expect(new Set(catalog.map((item) => item.url)).size).toBe(catalog.length);
    for (const slug of Object.keys(indicatorAliases))
      expect(platform.indicators.some((item) => item.slug === slug)).toBe(true);
    for (const slug of Object.keys(conceptAliases))
      expect(concepts.some((item) => item.slug === slug)).toBe(true);
    const subset = platformSearchItems({ ...platform, indicators: [platform.indicators[0]] });
    expect(subset.filter((item) => item.type === 'Indicador').map((item) => item.url)).toEqual([
      '/indicador/rendimento-real',
    ]);
    expect(catalog.some((item) => item.url === '/indicador/divida-publica')).toBe(false);
  });
});

describe('carregamento do índice', () => {
  it('compartilha o carregamento entre consultas concorrentes e reutiliza o índice', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(catalog)));
    vi.stubGlobal('fetch', request);
    const search = createSearch('/busca.json');
    expect(await search(' ')).toEqual([]);
    expect(request).not.toHaveBeenCalled();
    const results = await Promise.all([search('comida'), search('dívida')]);
    expect(results.every((items) => items.length > 0)).toBe(true);
    expect(await search('salario', 'entenda')).toEqual(
      searchItems(indexSearchItems(catalog), 'salario', 'entenda'),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    () => Promise.reject(new Error('offline')),
    () => Promise.resolve(new Response('indisponível', { status: 503 })),
    () => Promise.resolve(new Response('json inválido')),
    () => Promise.resolve(new Response(JSON.stringify({ items: [] }))),
    () =>
      Promise.resolve(new Response(JSON.stringify([{ ...editorial, url: 'javascript:alert(1)' }]))),
    () => Promise.resolve(new Response(JSON.stringify([{ ...editorial, url: '//externo.test' }]))),
    () => Promise.resolve(new Response(JSON.stringify([{ ...editorial, url: '/\\externo.test' }]))),
    () => Promise.resolve(new Response(JSON.stringify([{ ...editorial, aliases: [null] }]))),
  ])('rejeita falhas ou índice inválido e permite nova tentativa', async (failure) => {
    const request = vi
      .fn()
      .mockImplementationOnce(failure)
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog)));
    vi.stubGlobal('fetch', request);
    const search = createSearch('/busca.json');
    await expect(search('comida')).rejects.toThrow();
    expect((await search('comida')).length).toBeGreaterThan(0);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
