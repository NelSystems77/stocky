import { describe, expect, it } from 'vitest';
import type { RegistroAgotado } from '@/lib/domain/agotados';
import { generarExcel } from './excel';
import { generarPdf } from './pdf';
import { reporteAgotados, reporteBajos, type ProductoReporte } from './construir';

const emisor = { usuario: 'Ana Pérez', unidad: '771', generadoEn: new Date('2026-11-12T18:00:00Z') };

const prod = (codigo: string, ud: string, existencia: number | undefined, cuotaMinima: number, cuota = cuotaMinima * 3): ProductoReporte => ({
  codigo,
  descripcion: `Producto ${codigo}`,
  ud,
  existencia,
  cuotaMinima,
  cuota,
});

describe('reporteBajos', () => {
  const productos = [
    prod('110-16-0010', 'CN', 4000, 10000, 30000), // 40 CN de mínima 100 CN → 40 %
    prod('110-16-0020', 'FC', 5, 10), //            50 %
    prod('110-16-0030', 'FC', 0, 10), //            agotado: no es bajo
    prod('110-16-0040', 'FC', 50, 10), //           ok
    prod('110-16-0050', 'FC', 1, 10), //            10 %
  ];
  const r = reporteBajos(productos, '2026-11-12', emisor);

  it('incluye solo los bajos, del más escaso al menos escaso', () => {
    expect(r.filas.map((f) => f[0])).toEqual(['110-16-0050', '110-16-0010', '110-16-0020']);
  });
  it('muestra las cantidades en la UD del producto', () => {
    const fila = r.filas.find((f) => f[0] === '110-16-0010');
    expect(fila?.[2]).toBe('40 CN');
    expect(fila?.[3]).toBe('100 CN');
    expect(fila?.[4]).toBe('300 CN');
  });
  it('lleva usuario, unidad, fecha del reporte, resumen y nombre de archivo', () => {
    expect(r.usuario).toBe('Ana Pérez');
    expect(r.unidad).toBe('771');
    expect(r.detalle[0]).toContain('12 nov 2026');
    expect(r.resumen[0]).toBe('Productos bajos: 3');
    expect(r.nombreArchivo).toBe('bajos_20261112');
  });
  it('sin bajos devuelve la tabla vacía y resumen en 0', () => {
    const vacio = reporteBajos([prod('A', 'FC', 50, 10)], null, emisor);
    expect(vacio.filas).toEqual([]);
    expect(vacio.resumen[0]).toBe('Productos bajos: 0');
  });
});

describe('reporteAgotados', () => {
  const reg = (id: string, codigo: string, fechaAgotado: string, fechaIngreso: string | null, notas = ''): RegistroAgotado => ({
    id,
    codigo,
    fechaAgotado,
    fechaIngreso,
    origen: 'detectado',
    notas,
  });
  const registros = [
    reg('1', 'A', '2026-11-03', null, 'Pedido en trámite'),
    reg('2', 'B', '2026-11-05', '2026-11-12'),
    reg('3', 'C', '2026-09-01', '2026-09-20'), // fuera del período
    reg('4', 'D', '2026-10-25', null), //        ya estaba agotado y sigue
  ];
  const descripciones = new Map([
    ['A', 'Amoxicilina'],
    ['B', 'Ibuprofeno'],
  ]);
  const r = reporteAgotados(registros, descripciones, { desde: '2026-11-01', hasta: '2026-11-15' }, '2026-11-15', emisor);

  it('incluye los que tocan el período y deja fuera los anteriores', () => {
    expect(r.filas.map((f) => f[0])).toEqual(['D', 'A', 'B']);
  });
  it('calcula días agotado, ingreso y descripción', () => {
    const a = r.filas.find((f) => f[0] === 'A');
    expect(a).toEqual(['A', 'Amoxicilina', '3 nov 2026', 'Sigue agotado', 12, 'Pedido en trámite']);
    const b = r.filas.find((f) => f[0] === 'B');
    expect(b?.[3]).toBe('12 nov 2026');
    expect(b?.[4]).toBe(7);
  });
  it('un producto sin descripción conocida muestra una raya', () => {
    expect(r.filas.find((f) => f[0] === 'D')?.[1]).toBe('—');
  });
  it('resume cuántos siguen agotados y cuántos se reabastecieron', () => {
    expect(r.resumen).toEqual(['Productos en el reporte: 3', 'Siguen agotados: 2', 'Ya reabastecidos: 1']);
    expect(r.nombreArchivo).toBe('agotados_20261101_20261115');
  });
});

describe('generadores', () => {
  const datos = reporteBajos([prod('110-16-0010', 'CN', 4000, 10000), prod('110-16-0020', 'FC', 5, 10)], '2026-11-12', emisor);

  it('el PDF es un PDF válido con contenido', async () => {
    const bytes = await generarPdf(datos);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1500);
  });

  it('el PDF se genera también con muchas filas (varias páginas) y sin filas', async () => {
    const muchas = { ...datos, filas: Array.from({ length: 120 }, (_, i) => [`C-${i}`, 'Descripción larga de producto', '1 FC', '2 FC', '3 FC']) };
    expect((await generarPdf(muchas)).length).toBeGreaterThan(5000);
    expect((await generarPdf({ ...datos, filas: [] })).length).toBeGreaterThan(1000);
  });

  it('el Excel es un libro válido con encabezado, tabla y resumen', async () => {
    const bytes = await generarExcel(datos);
    expect(new TextDecoder().decode(bytes.slice(0, 2))).toBe('PK'); // .xlsx es un zip
    const XLSX = await import('xlsx');
    const libro = XLSX.read(bytes, { type: 'array' });
    const hoja = libro.Sheets[libro.SheetNames[0] as string];
    const filas = XLSX.utils.sheet_to_json<string[]>(hoja!, { header: 1, blankrows: false });
    const texto = filas.flat().join('|');
    expect(texto).toContain('Stocky by NelSystems');
    expect(texto).toContain('Productos bajos');
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('110-16-0010');
    expect(texto).toContain('Resumen');
  });
});
