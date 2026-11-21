/**
 * Verifica el parser contra los PDF reales de SIFA, que NO están en el repositorio.
 * Uso:  STOCKY_PDF_DIR=/ruta/con/los/pdf npm run test
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extraerLineas } from './leerPdf';
import { consolidarFilas } from '@/lib/domain/consolidado';
import { cuadrarConExistencias, lotesDesdeFilas } from '@/lib/domain/lotes';
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
    expect(r.advertencias.filter((a) => a.startsWith('Lote repetido'))).toHaveLength(3);
    expect(r.advertencias.filter((a) => !a.startsWith('Lote repetido'))).toEqual([]);
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
    const lotes = lotesDesdeFilas(parsearLotes(await leerLineas('rpt_vencebodega.pdf')).filas);
    const c = cuadrarConExistencias(lotes, consolidarFilas(existencias.filas));
    expect(c.coinciden).toBe(436);
    expect(c.sinLotes).toEqual([]);
    expect(c.sinExistencia).toEqual([]);
    expect(c.diferencias).toEqual([{ codigo: '110-46-2660', descripcion: expect.stringMatching(/^FUSIDATO SODICO/), ud: 'TU', lotes: 154, existencia: 233 }]);
  }, 120_000);
});

