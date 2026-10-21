import { describe, expect, it } from 'vitest';
import { decimalDirection, historyChart } from '../../src/lib/indicator-history';
import type { HistoryPoint } from '../../src/lib/platform-build';

const point = (end: string, value: string | null, method = 'v1'): HistoryPoint => ({
  series: 'tr4',
  geography: 'BR',
  start: end,
  end,
  status: value === null ? 'missing' : 'observed',
  node:
    value === null
      ? undefined
      : {
          observation: { id: end, value, status: 'observed', context: { method } },
          origins: [],
        },
});
describe('histórico do indicador', () => {
  it('preserva diferenças decimais abaixo da precisão de float e rótulos exatos', () => {
    const chart = historyChart([
      point('2025-01-01', '1000000000000000000.000000000000000001'),
      point('2025-02-01', '1000000000000000000.000000000000000002'),
    ]);
    expect(chart?.dots.map(({ y }) => y)).toEqual([230, 30]);
    expect(chart?.min).toBe('1000000000000000000.000000000000000001');
    expect(chart?.segments).toHaveLength(1);
  });
  it('não liga lacunas ou mudanças de método e usa tempo proporcional', () => {
    const chart = historyChart([
      point('2024-01-01', '1'),
      point('2024-01-02', '2'),
      point('2024-02-01', null),
      point('2024-04-01', '3'),
      point('2024-05-01', '4', 'v2'),
    ]);
    expect(chart?.segments).toHaveLength(1);
    expect(chart?.dots).toHaveLength(4);
    expect(chart?.dots[1].x).toBeLessThan(40);
  });
  it('trata zero, negativos, séries constantes, ponto único e ausência', () => {
    expect(historyChart([])).toBeNull();
    expect(historyChart([point('2025-01-01', null)])).toBeNull();
    expect(historyChart([point('2025-01-01', '0')])?.dots[0]).toMatchObject({ x: 340, y: 130 });
    const chart = historyChart([point('2025-01-01', '-2.5'), point('2025-02-01', '0')]);
    expect(chart?.min).toBe('-2.5');
    expect(chart?.max).toBe('0');
  });
  it('classifica somente o sinal decimal da comparação publicada', () => {
    expect(decimalDirection('0.000')).toBe('flat');
    expect(decimalDirection('-0.000')).toBe('flat');
    expect(decimalDirection('-0.000000000000000001')).toBe('down');
    expect(decimalDirection('0.000000000000000001')).toBe('up');
  });
});

it('interrompe a linha em quebras de método dentro da mesma versão', () => {
  const first = point('2025-01-01', '1');
  const second = point('2025-02-01', '2');
  if (second.node)
    second.node.observation.context = { method: 'v1', method_segment: 'nova-pesquisa' };
  expect(historyChart([first, second])?.segments).toEqual([]);
});
