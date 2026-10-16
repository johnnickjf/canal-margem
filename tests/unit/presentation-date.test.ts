import { describe, expect, it } from 'vitest';
import { presentationDate } from '../../src/lib/presentation-date';

describe('datas de apresentação', () => {
  it.each([
    ['2026-10-01', '01/10/2026'],
    ['2024-02-29', '29/02/2024'],
    ['2000-02-29', '29/02/2000'],
    ['2026-01-01', '01/01/2026'],
    ['2026-12-31', '31/12/2026'],
  ])('preserva o dia de %s mesmo em fuso negativo', (input, expected) => {
    expect(presentationDate(input)).toBe(expected);
  });

  it.each([
    '2026-02-29',
    '1900-02-29',
    '2026-02-31',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '2026-01-32',
    '01/10/2026',
    '2026-1-01',
    '2026-10-01T00:00:00Z',
    '',
  ])('rejeita a data inválida ou fora do contrato: %s', (input) => {
    expect(() => presentationDate(input)).toThrow();
  });
});
