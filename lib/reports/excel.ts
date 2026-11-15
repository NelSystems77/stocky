import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MARCA, type DatosReporte } from './tipos';

/** Genera el libro de Excel en el dispositivo. SheetJS solo se usa para escribir, nunca para leer archivos ajenos. */
export async function generarExcel(d: DatosReporte): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
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

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, d.titulo.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  return new Uint8Array(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
