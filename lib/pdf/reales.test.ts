/**
 * Verifica el parser contra los PDF reales de SIFA, que NO están en el repositorio.
 * Uso:  STOCKY_PDF_DIR=/ruta/con/los/pdf npm run test
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extraerLineas } from './leerPdf';
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
});
