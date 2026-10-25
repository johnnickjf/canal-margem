import { describe, expect, it } from 'vitest';
import indicators from '../../backend/internal/publications/indicators.json';
import raw from '../../src/data/policies.json';
import { historyChart } from '../../src/lib/indicator-history';
import {
  overlaps,
  policyTimeline,
  timelineX,
  validatePolicyCatalog,
} from '../../src/lib/policy-catalog';

const slugs = indicators.map((item) => item.slug);
const catalog = validatePolicyCatalog(raw, slugs);

describe('catálogo editorial de políticas', () => {
  it('preserva vigência distinta de assinatura/publicação e fim em aberto', () => {
    expect(catalog.legislation[0].enacted_at).toBe('2017-07-13');
    expect(catalog.legislation[0].published_at).toBe('2017-07-14');
    expect(catalog.policies[0].effective_periods[0].start).toBe('2017-11-11');
    expect(catalog.policies[0].effective_periods[0].end).toBeNull();
    expect(catalog.governments.at(-1)?.end).toBeNull();
    expect(
      catalog.policies.find((item) => item.id === 'reforma-previdenciaria-2019')?.effective_periods,
    ).toHaveLength(2);
  });

  it.each([
    [
      'data civil impossível',
      (data: typeof raw) => {
        data.policies[0].effective_periods[0].start = '2017-02-30';
      },
    ],
    [
      'intervalo invertido',
      (data: typeof raw) => {
        data.policies[0].effective_periods[0].end = '2010-01-01';
      },
    ],
    [
      'governo invertido',
      (data: typeof raw) => {
        data.governments[0].end = '2010-01-01';
      },
    ],
    [
      'publicação anterior',
      (data: typeof raw) => {
        data.legislation[0].published_at = '2010-01-01';
      },
    ],
    [
      'política duplicada',
      (data: typeof raw) => {
        data.policies.push(data.policies[0]);
      },
    ],
    [
      'vigência duplicada',
      (data: typeof raw) => {
        data.policies[0].effective_periods.push(data.policies[0].effective_periods[0]);
      },
    ],
    [
      'lei desconhecida',
      (data: typeof raw) => {
        data.policies[0].legal_references[0].legislation = 'ausente';
      },
    ],
    [
      'vigência sem lei vinculada',
      (data: typeof raw) => {
        data.policies[0].effective_periods[0].references[0].legislation = 'ec-103-2019';
      },
    ],
    [
      'indicador desconhecido',
      (data: typeof raw) => {
        data.policies[0].affected_indicators[0].indicator = 'ausente';
      },
    ],
    [
      'indicador duplicado',
      (data: typeof raw) => {
        data.policies[0].affected_indicators.push(data.policies[0].affected_indicators[0]);
      },
    ],
    [
      'governo desconhecido',
      (data: typeof raw) => {
        data.policies[0].government_periods[0].government = 'ausente';
      },
    ],
    [
      'relação causal',
      (data: typeof raw) => {
        data.policies[0].affected_indicators[0].relationship = 'causal';
      },
    ],
    [
      'fonte insegura',
      (data: typeof raw) => {
        data.legislation[0].sources[0].url = 'javascript:alert(1)';
      },
    ],
    [
      'fonte ausente',
      (data: typeof raw) => {
        data.legislation[0].sources = [];
      },
    ],
    [
      'campo de score',
      (data: typeof raw) => {
        Object.assign(data.policies[0], { score: 10 });
      },
    ],
  ])('rejeita %s antes da geração', (_, mutate) => {
    const data = structuredClone(raw);
    mutate(data);
    expect(() => validatePolicyCatalog(data, slugs)).toThrow();
  });

  it('valida relações também contra o catálogo fixado da API', () => {
    expect(() => validatePolicyCatalog(raw, ['desemprego'])).toThrow(/Indicador/);
  });
});

describe('linha histórica de contexto', () => {
  it('inclui extremos e não confunde ausência com período vigente', () => {
    expect(overlaps('2025-01-01', null, '2031-01-01', '2031-01-31')).toBe(true);
    expect(overlaps('2025-01-01', '2030-12-31', '2030-12-31', '2031-01-01')).toBe(true);
    expect(overlaps('2025-01-01', '2030-12-31', '2031-01-01', '2031-01-31')).toBe(false);
    expect(policyTimeline(catalog, 'desemprego', '2016-01-01', '2017-11-10')).toEqual([]);
    expect(policyTimeline(catalog, 'gasolina', '2012-01-01', '2025-12-31')).toEqual([]);
  });

  it('recorta intervalos sem alterar datas originais e inclui governos sucessores', () => {
    const rows = policyTimeline(catalog, 'desemprego', '2024-01-01', '2025-03-31');
    const policy = rows.find((item) => item.kind === 'policy');
    expect(policy).toMatchObject({ start: '2017-11-11', end: null, x1: 30, x2: 650 });
    expect(rows.filter((item) => item.kind === 'government').map((item) => item.id)).toEqual([
      'lula-2023',
    ]);
    expect(catalog.policies[0].effective_periods[0].end).toBeNull();
  });

  it('mantém prazos por dispositivo e limita a regra adicional do mínimo a 2030', () => {
    const before = policyTimeline(catalog, 'salario-minimo-real', '2024-01-01', '2024-12-31');
    expect(before.filter((item) => item.kind === 'policy')).toHaveLength(1);
    const during = policyTimeline(catalog, 'salario-minimo-real', '2024-01-01', '2025-12-31');
    expect(during.filter((item) => item.kind === 'policy')).toHaveLength(2);
    expect(during.find((item) => item.id.endsWith('limite-real'))?.x1).toBeGreaterThan(30);
    const after = policyTimeline(catalog, 'salario-minimo-real', '2031-01-01', '2031-12-31');
    expect(after.filter((item) => item.kind === 'policy')).toHaveLength(1);
  });

  it('usa o mesmo eixo das observações, inclusive com um único ponto', () => {
    const history = ['2024-01-01', '2025-01-01', '2025-12-31'].map((date) => ({
      series: 'fixture',
      geography: 'BR',
      start: date,
      end: date,
      status: 'observed',
      node: {
        observation: { id: date, status: 'observed', value: '1.000000000000000001' },
        origins: [],
      },
    }));
    const chart = historyChart(history);
    expect(chart?.dots[1].x).toBe(timelineX('2025-01-01', history[0].end, history[2].end));
    const rows = policyTimeline(catalog, 'salario-minimo-real', '2024-01-01', '2025-12-31');
    expect(rows.find((item) => item.id.endsWith('limite-real'))?.x1).toBe(chart?.dots[1].x);
    expect(policyTimeline(catalog, 'desemprego', '2025-01-01', '2025-01-01')[0]).toMatchObject({
      x1: 340,
      x2: 340,
    });
    expect(historyChart([history[0]])?.dots[0].x).toBe(340);
  });
});
