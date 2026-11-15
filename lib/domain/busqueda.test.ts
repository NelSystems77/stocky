import { describe, expect, it } from 'vitest';
import { coincide, normalizarBusqueda } from './busqueda';

describe('búsqueda', () => {
  it('normaliza tildes, mayúsculas y guiones', () => {
    expect(normalizarBusqueda('CÁPSULA 110-16-0010')).toBe('capsula110160010');
  });
  it('encuentra por código con o sin guiones', () => {
    expect(coincide('110-16-0010', '110-16-0010', 'PARACETAMOL 500 MG')).toBe(true);
    expect(coincide('110160010', '110-16-0010', 'PARACETAMOL 500 MG')).toBe(true);
    expect(coincide('16-00', '110-16-0010', 'PARACETAMOL 500 MG')).toBe(true);
  });
  it('encuentra por nombre sin importar tildes y exige todas las palabras', () => {
    expect(coincide('capsula', '110-04-0044', 'ABACAVIR CÁPSULA')).toBe(true);
    expect(coincide('paracetamol 500', '110-16-0010', 'PARACETAMOL 500 MG, TABLETA')).toBe(true);
    expect(coincide('paracetamol 1000', '110-16-0010', 'PARACETAMOL 500 MG, TABLETA')).toBe(false);
  });
  it('consulta vacía coincide con todo', () => {
    expect(coincide('   ', '110-16-0010', 'X')).toBe(true);
  });
});
