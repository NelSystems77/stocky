import { describe, expect, it } from 'vitest';
import { aUnidadesBase, deUnidadesBase, factorUD } from './unidades';

describe('unidades', () => {
  it('CN = cientos', () => {
    expect(aUnidadesBase(1.5, 'CN')).toBe(150);
    expect(aUnidadesBase(0.07, ' cn ')).toBe(7);
  });
  it('FC, TR, tubo, ampolla y frasco valen 1', () => {
    for (const ud of ['FC', 'TR', 'tubo', 'ampolla', 'frasco']) expect(factorUD(ud)).toBe(1);
    expect(aUnidadesBase(12, 'FC')).toBe(12);
  });
  it('usa la tabla editable', () => {
    expect(aUnidadesBase(2, 'CJ', { CJ: 30 })).toBe(60);
    expect(factorUD('CN', { CN: -5 })).toBe(1);
  });

  it('convierte de unidades base a la UD (inversa)', () => {
    expect(deUnidadesBase(20000, 'CN')).toBe(200);
    expect(deUnidadesBase(20050, 'CN')).toBe(200.5);
    expect(deUnidadesBase(12, 'FC')).toBe(12);
    expect(deUnidadesBase(aUnidadesBase(1.5, 'CN'), 'CN')).toBe(1.5);
  });
});
