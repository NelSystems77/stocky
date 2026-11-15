import { describe, expect, it } from 'vitest';
import { consolidarFilas, separarNuevos, validarDespacho } from './consolidado';

describe('consolidarFilas', () => {
  it('convierte CN a unidades base y respeta factor 1 en el resto', () => {
    const [cn, fc] = consolidarFilas([
      { codigo: '110-11-0030', ud: 'CN', descripcion: 'AAS', cuota: 3140, cuotaMinima: 1570, existencia: 474.5, dudosa: false },
      { codigo: '110-44-0001', ud: 'FC', descripcion: 'VACUNA', existencia: 12, dudosa: false },
    ]);
    expect(cn).toMatchObject({ cuota: 314000, cuotaMinima: 157000, existencia: 47450 });
    expect(fc).toMatchObject({ existencia: 12 });
  });
  it('no incluye campos que el reporte no trae', () => {
    const [p] = consolidarFilas([{ codigo: '110-44-0001', ud: 'FC', descripcion: 'V', existencia: 1, dudosa: false }]);
    expect(p).not.toHaveProperty('cuota');
    expect(p).not.toHaveProperty('consumo');
  });
});

describe('separarNuevos', () => {
  it('marca como nuevos solo los que faltan en un catálogo ya sembrado', () => {
    expect(separarNuevos(['a', 'b', 'c'], new Set(['a']))).toEqual({ nuevos: ['b', 'c'], sembrar: false });
  });
  it('con catálogo vacío siembra y no marca nada como nuevo', () => {
    expect(separarNuevos(['a', 'b'], new Set())).toEqual({ nuevos: [], sembrar: true });
  });
});

describe('validarDespacho', () => {
  const ebais = { codigo: '13', nombre: 'EBAIS ZETILLAL' };
  it('bloquea reportes de otro despacho', () => {
    expect(validarDespacho(ebais, '771', false)?.motivo).toMatch(/despacho 13 EBAIS ZETILLAL, no del 771/);
  });
  it('permite el propio despacho, el superadmin y reportes sin despacho', () => {
    expect(validarDespacho({ codigo: '771', nombre: null }, '771', false)).toBeNull();
    expect(validarDespacho(ebais, null, true)).toBeNull();
    expect(validarDespacho({ codigo: null, nombre: null }, '771', false)).toBeNull();
  });
});
