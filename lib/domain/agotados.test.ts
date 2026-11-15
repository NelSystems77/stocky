import { describe, expect, it } from 'vitest';
import { diasAgotado, proponerAgotados, registrosACerrar, separarRegistros, type ProductoStock, type RegistroAgotado } from './agotados';

const p = (codigo: string, existencia: number | undefined, fechaReporte = '2026-11-12', extra: Partial<ProductoStock> = {}): ProductoStock => ({
  codigo,
  cuota: 100,
  cuotaMinima: 20,
  existencia,
  fechaReporte,
  ...extra,
});
const r = (id: string, codigo: string, fechaAgotado: string, fechaIngreso: string | null = null): RegistroAgotado => ({
  id,
  codigo,
  fechaAgotado,
  fechaIngreso,
  origen: 'detectado',
  notas: '',
});

describe('proponerAgotados', () => {
  it('propone solo los agotados (cuota > 0 y existencia 0) sin registro abierto', () => {
    const productos = [p('A', 0), p('B', 50), p('C', 0), p('D', 5), p('E', 0, '2026-11-12', { cuota: 0, cuotaMinima: 0 })];
    expect(proponerAgotados(productos, [r('1', 'C', '2026-11-05')]).map((x) => x.codigo)).toEqual(['A']);
  });
  it('un registro cerrado no impide proponerlo otra vez (volvió a agotarse)', () => {
    expect(proponerAgotados([p('A', 0)], [r('1', 'A', '2026-10-01', '2026-10-10')]).map((x) => x.codigo)).toEqual(['A']);
  });
  it('no propone productos sin existencia en el reporte', () => {
    expect(proponerAgotados([p('A', undefined)], [])).toEqual([]);
  });
});

describe('registrosACerrar', () => {
  it('cierra con la fecha del reporte donde ya hay existencia', () => {
    expect(registrosACerrar([p('A', 30, '2026-11-12')], [r('1', 'A', '2026-11-05')])).toEqual([{ id: '1', fechaIngreso: '2026-11-12' }]);
  });
  it('no cierra si sigue en 0, si no hay dato o si el producto no aparece', () => {
    const regs = [r('1', 'A', '2026-11-05'), r('2', 'B', '2026-11-05'), r('3', 'Z', '2026-11-05')];
    expect(registrosACerrar([p('A', 0), p('B', undefined)], regs)).toEqual([]);
  });
  it('un reporte anterior al agotamiento no lo cierra', () => {
    expect(registrosACerrar([p('A', 30, '2026-11-01')], [r('1', 'A', '2026-11-05')])).toEqual([]);
  });
  it('ignora los registros ya cerrados', () => {
    expect(registrosACerrar([p('A', 30)], [r('1', 'A', '2026-10-01', '2026-10-10')])).toEqual([]);
  });
});

describe('diasAgotado', () => {
  it('cuenta hasta el ingreso si está cerrado', () => {
    expect(diasAgotado({ fechaAgotado: '2026-11-05', fechaIngreso: '2026-11-12' }, '2026-12-01')).toBe(7);
  });
  it('cuenta hasta hoy si sigue agotado', () => {
    expect(diasAgotado({ fechaAgotado: '2026-11-05', fechaIngreso: null }, '2026-11-15')).toBe(10);
  });
  it('el mismo día es 0 y nunca es negativo', () => {
    expect(diasAgotado({ fechaAgotado: '2026-11-05', fechaIngreso: null }, '2026-11-05')).toBe(0);
    expect(diasAgotado({ fechaAgotado: '2026-11-05', fechaIngreso: null }, '2026-11-01')).toBe(0);
  });
});

describe('separarRegistros', () => {
  it('activos por antigüedad y cerrados del más reciente al más antiguo', () => {
    const { activos, cerrados } = separarRegistros([
      r('1', 'B', '2026-11-10'),
      r('2', 'A', '2026-11-02'),
      r('3', 'C', '2026-09-01', '2026-09-20'),
      r('4', 'D', '2026-10-01', '2026-10-15'),
    ]);
    expect(activos.map((x) => x.id)).toEqual(['2', '1']);
    expect(cerrados.map((x) => x.id)).toEqual(['4', '3']);
  });
});
