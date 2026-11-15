import { describe, expect, it } from 'vitest';
import { cobertura, consumoDiario, consumoDiarioPromedio } from './consumo';

describe('consumo', () => {
  it('consumo diario = cantidad ÷ días hábiles', () => {
    expect(consumoDiario(100, 5)).toBe(20);
    expect(consumoDiario(100, 0)).toBeNull();
  });
  it('promedia solo las últimas 4 cargas', () => {
    const cargas = [
      { cantidad: 1000, diasHabiles: 1 }, // fuera de ventana
      { cantidad: 10, diasHabiles: 1 },
      { cantidad: 20, diasHabiles: 1 },
      { cantidad: 30, diasHabiles: 1 },
      { cantidad: 40, diasHabiles: 1 },
    ];
    expect(consumoDiarioPromedio(cargas)).toBe(25);
  });
  it('ignora cargas sin días hábiles y devuelve null si no hay ninguna', () => {
    expect(consumoDiarioPromedio([{ cantidad: 5, diasHabiles: 0 }])).toBeNull();
    expect(consumoDiarioPromedio([])).toBeNull();
  });
});

describe('cobertura', () => {
  it('existencia ÷ consumo diario', () => {
    expect(cobertura(100, 20)).toBe(5);
  });
  it('sin consumo → null, nunca divide entre cero', () => {
    expect(cobertura(100, null)).toBeNull();
    expect(cobertura(100, 0)).toBeNull();
  });
});
