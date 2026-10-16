import { describe, expect, it } from 'vitest';
import {
  durationToISO,
  episodeCode,
  formatDateLong,
  formatDateMono,
  formatDateShort,
  padIndex,
  readingTime,
  toISODate,
} from '../../src/lib/format';

describe('identificadores editoriais', () => {
  it.each([
    [1, 'M / 001'],
    [21, 'M / 021'],
    [1000, 'M / 1000'],
  ])('formata o episódio %s sem truncar o número', (input, expected) => {
    expect(episodeCode(input)).toBe(expected);
  });
  it('preenche índices com largura padrão ou explícita, sem truncar', () => {
    expect(padIndex(3)).toBe('03');
    expect(padIndex(3, 4)).toBe('0003');
    expect(padIndex(123)).toBe('123');
  });
});

describe('datas editoriais em UTC', () => {
  it.each([
    ['2026-10-02T00:00:00Z', '02.10.2026', '02 OUT 2026', '2 de outubro de 2026', '2026-10-02'],
    [
      '2026-10-01T23:30:00-03:00',
      '02.10.2026',
      '02 OUT 2026',
      '2 de outubro de 2026',
      '2026-10-02',
    ],
    ['2024-02-29T00:00:00Z', '29.02.2024', '29 FEV 2024', '29 de fevereiro de 2024', '2024-02-29'],
    [
      '2026-12-31T23:30:00-03:00',
      '01.01.2027',
      '01 JAN 2027',
      '1 de janeiro de 2027',
      '2027-01-01',
    ],
  ])('mantém formatos e metadados coerentes para %s', (input, mono, short, long, iso) => {
    const date = new Date(input);
    expect(formatDateMono(date)).toBe(mono);
    expect(formatDateShort(date)).toBe(short);
    expect(formatDateLong(date)).toBe(long);
    expect(toISODate(date)).toBe(iso);
  });
});

describe('durações para metadados de vídeo', () => {
  it.each([
    ['24:18', 'PT24M18S'],
    ['00:00', 'PT0S'],
    ['00:09', 'PT9S'],
    ['01:00', 'PT1M0S'],
    ['01:02:03', 'PT1H2M3S'],
    ['00:02:03', 'PT2M3S'],
    ['01:00:00', 'PT1H0S'],
  ])('converte %s para %s', (input, expected) => {
    expect(durationToISO(input)).toBe(expected);
  });
});

describe('tempo de leitura', () => {
  it('mantém o mínimo de um minuto para texto vazio ou somente marcação', () => {
    expect(readingTime()).toBe(1);
    expect(readingTime('')).toBe(1);
    expect(readingTime(' # > * _ ` - [ ] ( ) \n\t ')).toBe(1);
  });
  it.each([
    [200, 1],
    [299, 1],
    [300, 2],
    [500, 3],
  ])('estima %s palavras em %s minutos', (words, expected) => {
    const text = Array.from({ length: words }, () => '**palavra**').join(' \n ');
    expect(readingTime(text)).toBe(expected);
  });
});
