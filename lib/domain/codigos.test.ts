import { describe, expect, it } from 'vitest';
import { esCodigoValido, normalizarCodigo, parsearCodigo } from './codigos';

describe('códigos', () => {
  it('acepta ambos formatos', () => {
    expect(esCodigoValido('110-16-0010')).toBe(true);
    expect(esCodigoValido('1-10-16-0010')).toBe(true);
  });
  it('rechaza otros', () => {
    expect(esCodigoValido('110160010')).toBe(false);
    expect(esCodigoValido('11-16-0010')).toBe(false);
    expect(esCodigoValido('abc-16-0010')).toBe(false);
  });
  it('normaliza espacios y guiones tipográficos', () => {
    expect(normalizarCodigo(' 110–16 – 0010 ')).toBe('110-16-0010');
    expect(parsearCodigo(' 110–16–0010 ')).toBe('110-16-0010');
    expect(parsearCodigo('xx')).toBeNull();
  });
});
