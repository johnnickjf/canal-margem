import { describe, expect, it } from 'vitest';
import {
  decimalLabel,
  frequencyLabel,
  geographyLabel,
  unitLabel,
} from '../../src/lib/indicator-display';

describe('apresentação de recortes e valores', () => {
  it('preserva todos os algarismos sem conversão para ponto flutuante', () => {
    expect(decimalLabel('3587776.7972144')).toBe('3.587.776,7972144');
    expect(decimalLabel('-0.000000000000000001')).toBe('-0,000000000000000001');
    expect(decimalLabel('1518')).toBe('1.518');
  });
  it('nomeia territórios e unidades e mantém identificadores desconhecidos', () => {
    expect(geographyLabel('BR-city-3550308')).toBe('São Paulo');
    expect(geographyLabel('BR')).toBe('Brasil');
    expect(geographyLabel('BR-outro')).toBe('BR-outro');
    expect(unitLabel('households')).toBe('domicílios');
    expect(unitLabel('h/basket')).toBe('horas/cesta');
    expect(unitLabel('desconhecida')).toBe('desconhecida');
    expect(frequencyLabel('quarterly')).toBe('trimestral');
    expect(frequencyLabel('outro')).toBe('outro');
  });
});
