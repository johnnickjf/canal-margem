import { describe, expect, it, vi } from 'vitest';
import {
  type ComparisonCatalog,
  type ComparisonQuery,
  comparisonCatalog,
  comparisonURL,
  fetchComparison,
} from '../../src/lib/comparison';
import { capturePlatform } from '../../src/lib/platform-build';

const publication = 'a'.repeat(64);
const catalog: ComparisonCatalog = {
  api: 'https://api.example.test',
  publication,
  themes: [],
  indicators: [],
  starts: [],
  ends: [],
};
const query: ComparisonQuery = {
  series: 'tr4',
  geography: 'BR',
  from: '2024-01-01',
  to: '2025-03-31',
  calculation: 'difference',
};
function body() {
  const point = (id: string, start: string, end: string, value: string) => ({
    series: 'tr4',
    geography: 'BR',
    start,
    end,
    status: 'observed',
    node: { observation: { id, value }, origins: [] },
  });
  return {
    publication,
    data: {
      ...query,
      version: '2',
      status: 'computed',
      value: '-1',
      assessment: {
        version: 'material-v1',
        status: 'improved',
        direction: 'down',
        rule: 'Menor desemprego nesta medida.',
      },
      previous: point('b'.repeat(64), '2024-01-01', '2024-03-31', '8'),
      current: point('c'.repeat(64), '2025-01-01', '2025-03-31', '7'),
      evaluation: {
        definition: {
          formula: 'current - previous',
          methodology: 'Mesmo recorte',
          precision: 12,
          rounding: 'half_even',
        },
        request: {
          calculation: 'difference',
          version: '2',
          inputs: { current: 'c'.repeat(64), previous: 'b'.repeat(64) },
        },
        output: { value: '-1', context: { unit: 'percentage_points' } },
        warnings: [],
      },
    },
  };
}
const signal = () => new AbortController().signal;
describe('comparador', () => {
  it('usa o catálogo do build e conserva ausência sem valores artificiais', async () => {
    const snapshot = await capturePlatform();
    const result = comparisonCatalog(snapshot);
    expect(result.indicators).toHaveLength(15);
    expect(result.indicators.every((item) => item.selections.length === 0)).toBe(true);
    expect(result.api).toBeNull();
    expect(result.starts).toEqual([]);
    expect(() => comparisonURL(result, query)).toThrow('Publicação indisponível');
    snapshot.indicators = [{ ...snapshot.indicators[0], name: 'Nome da edição' }];
    expect(comparisonCatalog(snapshot).indicators[0].name).toBe('Nome da edição');
  });
  it('fixa publicação e versões e codifica geografia sem consultar o alias atual', () => {
    const url = new URL(comparisonURL(catalog, { ...query, geography: 'São Paulo & Recife' }));
    expect(url.searchParams.get('publication')).toBe(publication);
    expect(url.searchParams.get('geography')).toBe('São Paulo & Recife');
    expect(url.searchParams.get('assessment')).toBe('material-v1');
    expect(url.searchParams.get('version')).toBe('2');
  });
  it('preserva os valores do backend e omite credenciais', async () => {
    const request = vi.fn().mockResolvedValue(Response.json(body()));
    const result = await fetchComparison(catalog, query, signal(), request);
    expect(result.value).toBe('-1');
    expect(result.assessment.status).toBe('improved');
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][1].credentials).toBe('omit');
  });
  it.each([
    'publication',
    'geography',
    'date',
    'decimal',
    'input',
    'assessment',
    'calculation',
    'output',
  ])('rejeita contexto inválido: %s', async (mutation) => {
    const response = body();
    if (mutation === 'publication') response.publication = 'f'.repeat(64);
    if (mutation === 'geography') response.data.previous.geography = 'SP';
    if (mutation === 'date') response.data.to = '2024-03-31';
    if (mutation === 'decimal') response.data.value = 'NaN';
    if (mutation === 'input') response.data.evaluation.request.inputs.current = 'd'.repeat(64);
    if (mutation === 'assessment') response.data.assessment.version = 'material-v2';
    if (mutation === 'calculation') response.data.calculation = 'relative-change';
    if (mutation === 'output') response.data.evaluation.output.value = '123';
    await expect(
      fetchComparison(catalog, query, signal(), vi.fn().mockResolvedValue(Response.json(response))),
    ).rejects.toThrow('não corresponde');
  });
  it('retorna ausência sem transformá-la em estabilidade', async () => {
    const response = {
      publication,
      data: {
        ...query,
        version: '2',
        status: 'not_comparable',
        value: null,
        reason: 'endpoint_not_covered',
        assessment: {
          version: 'material-v1',
          status: 'insufficient_data',
          direction: 'unavailable',
          rule: 'Sem cobertura',
        },
      },
    };
    const result = await fetchComparison(
      catalog,
      query,
      signal(),
      vi.fn().mockResolvedValue(Response.json(response)),
    );
    expect(result.value).toBeNull();
    response.data.assessment.status = 'stable';
    await expect(
      fetchComparison(catalog, query, signal(), vi.fn().mockResolvedValue(Response.json(response))),
    ).rejects.toThrow();
  });
  it.each([410, 429, 503, 500])(
    'falha HTTP %s permite repetir sem cachear ausência',
    async (status) => {
      const request = vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status }))
        .mockResolvedValueOnce(Response.json(body()));
      await expect(fetchComparison(catalog, query, signal(), request)).rejects.toThrow();
      expect((await fetchComparison(catalog, query, signal(), request)).status).toBe('computed');
    },
  );
  it('propaga cancelamento e resposta não JSON', async () => {
    await expect(
      fetchComparison(
        catalog,
        query,
        signal(),
        vi.fn().mockRejectedValue(new DOMException('Cancelado', 'AbortError')),
      ),
    ).rejects.toThrow('Cancelado');
    await expect(
      fetchComparison(catalog, query, signal(), vi.fn().mockResolvedValue(new Response('html'))),
    ).rejects.toThrow();
  });
});
