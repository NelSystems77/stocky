import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MARCA, type DatosReporte, type DatosResumen } from './tipos';

/** Excel del resumen: una hoja por sección, cada una con el encabezado, su tabla y sus totales. */
export async function generarExcelResumen(d: DatosResumen): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const fecha = format(d.generadoEn, "d 'de' MMMM yyyy, h:mm a", { locale: es });
  const libro = XLSX.utils.book_new();
  const usados = new Set<string>();

  for (const s of d.secciones) {
    const filas: (string | number)[][] = [
      [MARCA],
      [`${d.titulo} · ${s.titulo}`],
      [`${d.usuario}${d.unidad ? ` · Unidad ${d.unidad}` : ''}`],
      [`Generado el ${fecha}`],
      ...d.detalle.map((l) => [l]),
      [],
      ...(s.filas.length === 0 ? [['Sin registros']] : [s.columnas, ...s.filas]),
      [],
      ...(s.resumen.length > 0 ? [['Resumen'], ...s.resumen.map((l) => [l])] : []),
    ];
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja['!cols'] = s.columnas.map((titulo, i) => ({
      wch: Math.min(60, Math.max(titulo.length, ...s.filas.map((f) => String(f[i] ?? '').length)) + 2),
    }));
    // Nombre de hoja: máximo 31 caracteres, sin caracteres prohibidos y único.
    let nombre = s.titulo.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    while (usados.has(nombre)) nombre = `${nombre.slice(0, 29)}_`;
    usados.add(nombre);
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
  }
  return new Uint8Array(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/** Gris de las filas resaltadas (con diferencia): el mismo del PDF. */
const GRIS_RESALTE = 'D1D5DB';

/**
 * Genera el libro de Excel en el dispositivo. Solo se usa para escribir, nunca para leer archivos ajenos.
 * Usa `xlsx-js-style` (SheetJS con estilos) porque SheetJS no escribe colores de relleno; el resto del código sigue con `xlsx`.
 */
export async function generarExcel(d: DatosReporte): Promise<Uint8Array> {
  const XLSX = await import('xlsx-js-style');
  const fecha = format(d.generadoEn, "d 'de' MMMM yyyy, h:mm a", { locale: es });

  const filas: (string | number)[][] = [
    [MARCA],
    [d.titulo],
    [`${d.usuario}${d.unidad ? ` · Unidad ${d.unidad}` : ''}`],
    [`Generado el ${fecha}`],
    ...d.detalle.map((l) => [l]),
    [],
    d.columnas,
    ...d.filas,
    [],
    ['Resumen'],
    ...d.resumen.map((l) => [l]),
  ];

  const hoja = XLSX.utils.aoa_to_sheet(filas);
  // Ancho de cada columna según el contenido de la tabla (con tope para que no se desborde).
  hoja['!cols'] = d.columnas.map((titulo, i) => ({
    wch: Math.min(60, Math.max(titulo.length, ...d.filas.map((f) => String(f[i] ?? '').length)) + 2),
  }));

  // Filas resaltadas (p. ej. con diferencia en el conteo): fondo gris y, en las columnas indicadas, negrita.
  if (d.filasResaltadas && d.filasResaltadas.length > 0) {
    const primeraFila = 4 + d.detalle.length + 2; // marca, título, usuario, fecha, detalle, línea en blanco y encabezado de la tabla
    const negrita = new Set(d.columnasNegrita ?? []);
    for (const i of d.filasResaltadas) {
      for (let c = 0; c < d.columnas.length; c++) {
        const dir = XLSX.utils.encode_cell({ r: primeraFila + i, c });
        const celda = hoja[dir] ?? (hoja[dir] = { t: 's', v: '' });
        celda.s = { fill: { patternType: 'solid', fgColor: { rgb: GRIS_RESALTE } }, font: { bold: negrita.has(c) } };
      }
    }
  }

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, d.titulo.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  return new Uint8Array(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
