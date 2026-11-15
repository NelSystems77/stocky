import { describe, expect, it } from 'vitest';
import { estadoStock } from './stock';

describe('estadoStock', () => {
  it('A6: agotado = cuota > 0 y existencia 0', () => {
    expect(estadoStock({ cuota: 522000, cuotaMinima: 261000, existencia: 0 })).toBe('agotado');
  });
  it('A5: bajo = existencia menor que la cuota mínima', () => {
    expect(estadoStock({ cuota: 314000, cuotaMinima: 157000, existencia: 100 })).toBe('bajo');
  });
  it('en la cuota mínima exacta ya no es bajo', () => {
    expect(estadoStock({ cuota: 200, cuotaMinima: 100, existencia: 100 })).toBe('ok');
  });
  it('agotado tiene prioridad sobre bajo', () => {
    expect(estadoStock({ cuota: 10, cuotaMinima: 5, existencia: 0 })).toBe('agotado');
  });
  it('sin cuota no hay política: ni agotado ni bajo', () => {
    expect(estadoStock({ cuota: 0, cuotaMinima: 0, existencia: 0 })).toBe('sinCuota');
    expect(estadoStock({ existencia: 6 })).toBe('sinCuota');
  });
  it('sin existencia leída → sinDatos', () => {
    expect(estadoStock({ cuota: 10 })).toBe('sinDatos');
  });
});
