import { describe, expect, it } from 'vitest';
import { crearFoto, filasConteo, type LineaConteo } from '@/lib/domain/conteo';
import { reporteConteo } from './conteo';
import { generarExcel } from './excel';
import { generarPdf } from './pdf';

const emisor = { usuario: 'Ana Pérez', unidad: '771', generadoEn: new Date('2026-11-21T18:00:00Z') };
const meta = { fecha: '2026-11-21', fechaReporteSifa: '2026-11-20' };

const foto = crearFoto([
  { codigo: '110-05-0003', descripcion: 'AMOXICILINA 500 MG', ud: 'CN', existencia: 5000 },
  { codigo: '110-16-0010', descripcion: 'PARACETAMOL 500 MG', ud: 'CN', existencia: 20000 },
  { codigo: '110-20-0001', descripcion: 'JERINGA 5 ML', ud: 'FC', existencia: 40 },
]);
const lineas: LineaConteo[] = [
  { codigo: '110-16-0010', contado: 15000, observacion: 'caja abierta' },
  { codigo: '110-20-0001', contado: 40, observacion: '' },
  { codigo: '110-99-0001', contado: 300, observacion: '', fueraDeSifa: { descripcion: 'PRODUCTO NUEVO', ud: 'CN' } },
];
const filas = filasConteo(foto, lineas);

describe('reporteConteo', () => {
  const r = reporteConteo(filas, meta, emisor);

  it('tiene las columnas del §13 y el encabezado con usuario, unidad y fechas', () => {
    expect(r.columnas).toEqual(['Código', 'Descripción', 'UD', 'SIFA', 'Contado', 'Diferencia', 'Observación']);
    expect(r.usuario).toBe('Ana Pérez');
    expect(r.unidad).toBe('771');
    expect(r.detalle.join(' ')).toContain('21 de noviembre 2026');
    expect(r.detalle.join(' ')).toContain('20 de noviembre 2026');
    expect(r.nombreArchivo).toBe('conteo_20261121');
  });
  it('muestra SIFA, contado y diferencia en la UD del producto, con el signo - cuando falta', () => {
    const f = r.filas.find((x) => x[0] === '110-16-0010');
    expect(f?.[3]).toBe('200 CN');
    expect(f?.[4]).toBe('150 CN');
    expect(String(f?.[5])).toMatch(/^-50 CN/);
    expect(f?.[6]).toBe('caja abierta');
  });
  it('sin contar no es 0: va con guion y sin diferencia; coincide va en 0', () => {
    const sin = r.filas.find((x) => x[0] === '110-05-0003');
    expect([sin?.[4], sin?.[5]]).toEqual(['—', '—']);
    expect(r.filas.find((x) => x[0] === '110-20-0001')?.[5]).toBe('0');
  });
  it('un producto fuera de SIFA queda marcado y suma como sobrante', () => {
    const f = r.filas.find((x) => x[0] === '110-99-0001');
    expect(String(f?.[1])).toContain('no está en SIFA');
    expect(f?.[3]).toBe('—');
    expect(String(f?.[5])).toMatch(/^\+3 CN/);
  });
  it('resalta solo las filas con diferencia y pone la diferencia en negrita', () => {
    const resaltadas = (r.filasResaltadas ?? []).map((i) => r.filas[i]?.[0]);
    expect(resaltadas).toEqual(['110-16-0010', '110-99-0001']);
    expect(r.columnasNegrita).toEqual([5]);
  });
  it('el resumen cuenta contados, con diferencia, faltantes y sobrantes', () => {
    expect(r.resumen).toEqual(['Productos contados: 3 de 4 (1 sin contar)', 'Con diferencia: 2', 'Faltantes (-): 1', 'Sobrantes (+): 1']);
  });
  it('solo diferencias deja esas filas y reindexa el resalte; el resumen sigue siendo del conteo completo', () => {
    const s = reporteConteo(filas, meta, emisor, true);
    expect(s.filas.map((f) => f[0])).toEqual(['110-16-0010', '110-99-0001']);
    expect(s.filasResaltadas).toEqual([0, 1]);
    expect(s.resumen[0]).toContain('3 de 4');
  });
});

describe('exportar el conteo', () => {
  it('genera un PDF y un Excel válidos', async () => {
    const datos = reporteConteo(filas, meta, emisor);
    const pdf = await generarPdf(datos);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    const xlsx = await generarExcel(datos);
    expect(new TextDecoder('latin1').decode(xlsx.slice(0, 2))).toBe('PK');
  });
  it('el Excel pinta de gris solo las filas con diferencia', async () => {
    const datos = reporteConteo(filas, meta, emisor);
    const XLSX = await import('xlsx-js-style');
    const libro = XLSX.read(await generarExcel(datos), { type: 'array', cellStyles: true });
    const hoja = libro.Sheets[libro.SheetNames[0] ?? ''];
    if (!hoja) throw new Error('sin hoja');
    // (La negrita se escribe en el archivo, pero la librería no la devuelve al leer: se verificó a mano en styles.xml.)
    const fila = (codigo: string) => {
      for (let r = 0; r < 30; r++) if (hoja[XLSX.utils.encode_cell({ r, c: 0 })]?.v === codigo) return r;
      throw new Error(`no está ${codigo}`);
    };
    const relleno = (r: number, c: number) => hoja[XLSX.utils.encode_cell({ r, c })]?.s?.fgColor?.rgb as string | undefined;
    const falta = fila('110-16-0010');
    const coincide = fila('110-20-0001');
    const sinContar = fila('110-05-0003');
    expect(relleno(falta, 0)?.toUpperCase()).toBe('D1D5DB');
    expect(relleno(falta, 5)?.toUpperCase()).toBe('D1D5DB');
    expect(relleno(coincide, 0)).toBeUndefined();
    expect(relleno(sinContar, 0)).toBeUndefined();
  });
});
