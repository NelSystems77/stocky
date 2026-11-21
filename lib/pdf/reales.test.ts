/**
 * Verifica el parser contra los PDF reales de SIFA, que NO están en el repositorio.
 * Uso:  STOCKY_PDF_DIR=/ruta/con/los/pdf npm run test
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extraerLineas } from './leerPdf';
import { consolidarFilas } from '@/lib/domain/consolidado';
import { clasificarRepetidos, compararLotes, cuadrarConExistencias, esMedicamento, hayCambios, lotesDesdeFilas, planGuardadoLotes, type LoteGuardado } from '@/lib/domain/lotes';
import { parsearLotes } from './lotes';
import { parsearReporte } from './parser';

const dir = process.env['STOCKY_PDF_DIR'];

async function leer(nombre: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const datos = new Uint8Array(readFileSync(join(dir!, nombre)));
  return parsearReporte(await extraerLineas(pdfjs as never, datos));
}

describe.skipIf(!dir)('PDF reales de SIFA', () => {
  it('existencias de despacho 771', async () => {
    const r = await leer('existenciasdespacho771.pdf');
    expect(r.tipo).toBe('existenciasDespacho');
    expect(r.filas).toHaveLength(1039);
    expect(r.advertencias).toEqual([]);
    expect(r.filas.find((f) => f.codigo === '110-04-0044')?.descripcion).toBe('ABACAVIR 300 MILIGRAMOS (COMO SULFA');
    expect(r.filas.find((f) => f.codigo === '110-28-1020')?.descripcion).toMatch(/^LAMOTRIGINA 25 MG/);
    expect(r.filas.find((f) => f.codigo === '110-16-0010')).toMatchObject({ ud: 'CN', cuota: 5220, cuotaMinima: 2610 });
  }, 60_000);

  it('productos en despacho (EBAIS)', async () => {
    const a = await leer('ejemplo_f12.pdf');
    expect(a.filas).toHaveLength(336);
    expect(a.advertencias).toEqual([]);
    const b = await leer('rancho.pdf');
    expect(b.filas).toHaveLength(301);
    expect(b.advertencias).toEqual([]);
  }, 60_000);

  it('lotes y vencimientos 771 (Rpt_VenceBodega)', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const datos = new Uint8Array(readFileSync(join(dir!, 'rpt_vencebodega.pdf')));
    const r = parsearLotes(await extraerLineas(pdfjs as never, datos));
    expect(r.fechaReporte).toBe('2026-11-20');
    expect(r.despacho.codigo).toBe('771');
    expect(r.filas).toHaveLength(551);
    expect(r.totalDeclarado).toBe(2345178658.76);
    expect(r.cuadra).toBe(true);
    expect(r.filas.filter((f) => f.dudosa)).toHaveLength(13);
    // Tres lotes vienen repetidos con la misma fecha: se suman, no se pierden.
    expect(r.repetidos.map((x) => [x.codigo, x.lote, x.cantidades])).toEqual([
      ['110-39-0900', '4162601', [1060, 3200]],
      ['110-14-2640', 'T1AIZ01', [42, 16]],
      ['110-19-3240', '75WH104', [132, 80]],
    ]);
    expect(r.advertencias).toEqual([]);
    expect(lotesDesdeFilas(r.filas)).toHaveLength(548);
    expect(r.filas.find((f) => f.codigo === '110-16-0010')).toMatchObject({ lote: '250242', vence: '2030-02-18', existencia: 4256.8 });
  }, 60_000);

  it('lotes y existencias del 20/11/2026 se cruzan: 436 coinciden y 1 difiere (fusidato, 154 contra 233)', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const leerLineas = async (nombre: string) => extraerLineas(pdfjs as never, new Uint8Array(readFileSync(join(dir!, nombre))));
    const existencias = parsearReporte(await leerLineas('rpt_existenciasdespacho20112026.pdf'));
    expect(existencias.tipo).toBe('existenciasDespacho');
    expect(existencias.fechaReporte).toBe('2026-11-20');
    expect(existencias.filas).toHaveLength(1039);
    expect(existencias.advertencias).toEqual([]);
    const nombres = new Map(existencias.filas.map((f) => [f.codigo, f.descripcion]));
    const lotes = lotesDesdeFilas(parsearLotes(await leerLineas('rpt_vencebodega.pdf')).filas, undefined, nombres);
    // Las 13 filas con la descripción partida en el PDF de lotes toman el nombre completo de las existencias.
    expect(lotes.find((l) => l.codigo === '110-04-0045')).toMatchObject({ lote: 'FD25237', vence: '2027-03-30', cantidad: 1440, descripcion: expect.stringMatching(/^ABACAVIR 600 MG/) });
    expect(lotes.find((l) => l.codigo === '110-28-1020')?.descripcion).toMatch(/^LAMOTRIGINA 25 MG/);
    expect(lotes.every((l) => nombres.has(l.codigo))).toBe(true);
    // Cargar el mismo reporte dos veces no duplica lotes, cantidades ni productos (medicamentos y no medicamentos).
    const primera = new Map<string, LoteGuardado>(planGuardadoLotes(lotes, [], '2026-11-20').lotes.map((l) => [l.id, { ...l.datos, id: l.id }]));
    expect(primera.size).toBe(lotes.length);
    expect([...primera.values()].filter((l) => !esMedicamento(l.codigo))).toHaveLength(23);
    const segunda = planGuardadoLotes(lotes, [...primera.values()], '2026-11-20');
    expect(segunda.salidas).toEqual([]);
    expect(segunda.lotes.every((l) => l.datos.cantidad === primera.get(l.id)?.cantidad && l.datos.cantidadIngresada === primera.get(l.id)?.cantidadIngresada)).toBe(true);
    expect(hayCambios(compararLotes([...primera.values()], lotes))).toBe(false);
    const c = cuadrarConExistencias(lotes, consolidarFilas(existencias.filas));
    // Los 3 lotes en dos filas se suman y coinciden con SIFA: no hay duplicados.
    expect(clasificarRepetidos(parsearLotes(await leerLineas('rpt_vencebodega.pdf')).repetidos, c).map((x) => [x.codigo, x.suma, x.estado])).toEqual([
      ['110-39-0900', 4260, 'coincide'],
      ['110-14-2640', 58, 'coincide'],
      ['110-19-3240', 212, 'coincide'],
    ]);
    expect(c.coinciden).toBe(436);
    expect(c.sinLotes).toEqual([]);
    expect(c.sinExistencia).toEqual([]);
    expect(c.diferencias).toEqual([{ codigo: '110-46-2660', descripcion: expect.stringMatching(/^FUSIDATO SODICO/), ud: 'TU', lotes: 154, existencia: 233 }]);
  }, 120_000);
});

