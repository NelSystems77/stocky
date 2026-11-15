import { describe, expect, it } from 'vitest';
import { aleatorioSeguro, generarClave } from './clave';

describe('generarClave', () => {
  it('tiene 12 caracteres por defecto y respeta la longitud pedida', () => {
    expect(generarClave()).toHaveLength(12);
    expect(generarClave(16)).toHaveLength(16);
  });
  it('siempre trae minúscula, mayúscula y dígito', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarClave(8);
      expect(c).toMatch(/[a-z]/);
      expect(c).toMatch(/[A-Z]/);
      expect(c).toMatch(/[0-9]/);
    }
  });
  it('nunca usa caracteres ambiguos', () => {
    for (let i = 0; i < 200; i++) expect(generarClave(20)).not.toMatch(/[01OIl]/);
  });
  it('no repite: dos claves seguidas distintas', () => {
    expect(generarClave()).not.toBe(generarClave());
  });
  it('con un aleatorio fijo es determinista (se puede probar)', () => {
    expect(generarClave(12, () => 0)).toBe(generarClave(12, () => 0));
  });
  it('aleatorioSeguro queda dentro del rango', () => {
    for (let i = 0; i < 500; i++) {
      const n = aleatorioSeguro(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });
});
