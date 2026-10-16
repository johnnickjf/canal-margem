import { describe, expect, it } from 'vitest';
import { parseHeadline, plainHeadline } from '../../src/lib/headline';

describe('títulos editoriais e versões para metadados', () => {
  it.each([
    ['O preço do [aluguel]', 'O preço do ', 'aluguel', ''],
    ['[Economia] é gente', '', 'Economia', ' é gente'],
    ['Quem [paga] a conta?', 'Quem ', 'paga', ' a conta?'],
    ['[Ação & reação]', '', 'Ação & reação', ''],
  ])('separa o destaque de %s sem perder texto ou acentos', (title, before, highlight, after) => {
    expect(parseHeadline(title)).toEqual({ before, highlight, after });
    expect(plainHeadline(title)).toBe(`${before}${highlight}${after}`);
  });

  it.each(['Sem destaque', 'Título [incompleto', 'Título [] vazio', 'Título com ] solto', ''])(
    'preserva títulos sem um destaque válido: %s',
    (title) => {
      expect(parseHeadline(title)).toEqual({ before: title, highlight: '', after: '' });
      expect(plainHeadline(title)).toBe(title);
    },
  );
});
