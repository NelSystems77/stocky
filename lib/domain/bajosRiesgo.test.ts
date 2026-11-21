import { describe, expect, it } from 'vitest';
import { bajosYRiesgo, resumenBajosRiesgo, type ProductoBajosRiesgo } from './bajosRiesgo';
import type { AnalisisRiesgo } from './riesgo';
import { reporteBajosYRiesgo } from '@/lib/reports/bajosRiesgo';

const prod = (codigo: string, existencia: number | undefined, cuotaMinima = 100, ud = 'FC'): ProductoBajosRiesgo => ({
  codigo,
  descripcion: `Producto ${codigo}`,
  ud,
  existencia,
  cuotaMinima,
  cuota: cuotaMinima * 3,
});
const riesgo = (nivel: AnalisisRiesgo['nivel'], cobertura: number | null, diasAlIngreso = 10): AnalisisRiesgo => ({
  consumoDiario: cobertura === null ? null : 1,
  cobertura,
  diasAlIngreso,
  nivel,
});

describe('bajosYRiesgo (A3, A4 y A5)', () => {
  const productos = [
    prod('110-00-0001', 500), //  ok en todo
    prod('110-00-0002', 300), //  riesgo (A4), no bajo
    prod('110-00-0003', 300), //  crítico (A3), no bajo
    prod('110-00-0004', 50), //   bajo (A5), sin análisis de riesgo
    prod('110-00-0005', 50), //   crítico y además bajo
    prod('110-00-0006', 0), //    agotado: no entra
    prod('110-00-0007', 20), //   bajo, más escaso que el 4
    prod('110-00-0008', 500), //  sin consumo y no bajo: no entra
  ];
  const riesgos = new Map<string, AnalisisRiesgo>([
    ['110-00-0001', riesgo('ok', 90)],
    ['110-00-0002', riesgo('riesgo', 12)],
    ['110-00-0003', riesgo('critico', 4)],
    ['110-00-0005', riesgo('critico', 2)],
    ['110-00-0006', riesgo('agotado', 0)],
    ['110-00-0008', riesgo('sinConsumo', null)],
  ]);
  const filas = bajosYRiesgo(productos, riesgos);

  it('incluye solo A3, A4 y A5; los agotados, los sin consumo no bajos y los ok quedan fuera', () => {
    expect(filas.map((f) => f.producto.codigo).sort()).toEqual(['110-00-0002', '110-00-0003', '110-00-0004', '110-00-0005', '110-00-0007']);
  });
  it('ordena crítico (menos días primero), luego en riesgo, luego bajos (el más lejos de su mínima primero)', () => {
    expect(filas.map((f) => [f.producto.codigo, f.prioridad])).toEqual([
      ['110-00-0005', 'critico'],
      ['110-00-0003', 'critico'],
      ['110-00-0002', 'riesgo'],
      ['110-00-0007', 'bajo'],
      ['110-00-0004', 'bajo'],
    ]);
  });
  it('un producto crítico y bajo sale una sola vez, con la prioridad más urgente y la marca de bajo', () => {
    const f = filas.filter((x) => x.producto.codigo === '110-00-0005');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ prioridad: 'critico', bajoMinima: true });
  });
  it('sin consumos cargados solo hay bajos', () => {
    const solo = bajosYRiesgo(productos, new Map());
    expect(solo.map((f) => f.prioridad)).toEqual(['bajo', 'bajo', 'bajo']);
    expect(solo.map((f) => f.producto.codigo)).toEqual(['110-00-0007', '110-00-0004', '110-00-0005']);
  });
  it('un producto sin existencia importada no entra', () => {
    expect(bajosYRiesgo([prod('110-00-0009', undefined)], new Map())).toEqual([]);
  });
  it('resumen por nivel y cuántos son también bajos', () => {
    expect(resumenBajosRiesgo(filas)).toEqual({ total: 5, criticos: 2, enRiesgo: 1, bajos: 2, tambienBajos: 1 });
  });
});

describe('reporteBajosYRiesgo', () => {
  const emisor = { usuario: 'Ana Pérez', unidad: '771', generadoEn: new Date('2026-11-21T18:00:00Z') };
  const productos = [prod('110-16-0010', 4000, 10000, 'CN'), prod('110-00-0003', 300)];
  const riesgos = new Map<string, AnalisisRiesgo>([
    ['110-16-0010', riesgo('critico', 4.7, 9)],
    ['110-00-0003', riesgo('riesgo', 12, 10)],
  ]);
  const filas = bajosYRiesgo(productos, riesgos);
  const r = reporteBajosYRiesgo(filas, { fechaReporte: '2026-11-20', margen: 7, hayConsumos: true }, emisor, '2026-11-21');

  it('tiene encabezado, columnas y nombre de archivo', () => {
    expect(r.usuario).toBe('Ana Pérez');
    expect(r.unidad).toBe('771');
    expect(r.columnas).toEqual(['Código', 'Descripción', 'Prioridad', 'Existencia', 'Cuota mínima', 'Alcanza (días hábiles)', 'Ingreso en (días)', 'Nota']);
    expect(r.detalle[0]).toContain('20 nov 2026');
    expect(r.nombreArchivo).toBe('bajos_y_riesgo_20261120');
  });
  it('muestra las cantidades en la UD, los días enteros y la nota de también bajo', () => {
    const f = r.filas.find((x) => x[0] === '110-16-0010');
    expect(f).toEqual(['110-16-0010', 'Producto 110-16-0010', 'Crítico', '40 CN', '100 CN', '4', '9', 'También bajo cuota mínima']);
    expect(r.filas.find((x) => x[0] === '110-00-0003')?.[2]).toBe('En riesgo');
  });
  it('el resumen cuenta por nivel y avisa que los agotados van aparte', () => {
    expect(r.resumen[0]).toBe('Productos en el reporte: 2');
    expect(r.resumen[1]).toBe('Críticos: 1 · En riesgo: 1 · Bajos: 0');
    expect(r.resumen.join(' ')).toContain('agotados');
  });
  it('sin consumos lo dice en el resumen', () => {
    const sin = reporteBajosYRiesgo(bajosYRiesgo(productos, new Map()), { fechaReporte: null, margen: 7, hayConsumos: false }, emisor, '2026-11-21');
    expect(sin.resumen.join(' ')).toContain('No hay consumos cargados');
    expect(sin.nombreArchivo).toBe('bajos_y_riesgo_20261121');
  });
});
