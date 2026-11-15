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
  it('unifica X-XX-XX-XXXX con XXX-XX-XXXX (mismo código impreso de dos formas)', () => {
    expect(normalizarCodigo('1-10-16-0010')).toBe('110-16-0010');
    expect(parsearCodigo('4-70-06-2403')).toBe('470-06-2403');
    expect(parsearCodigo('1-10-16-0010')).toBe(parsearCodigo('110-16-0010'));
  });
  it('normaliza espacios y guiones tipográficos', () => {
    expect(normalizarCodigo(' 110–16 – 0010 ')).toBe('110-16-0010');
    expect(parsearCodigo(' 110–16–0010 ')).toBe('110-16-0010');
    expect(parsearCodigo('xx')).toBeNull();
  });
});
