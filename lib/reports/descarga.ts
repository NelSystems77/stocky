import type { DatosReporte, DatosResumen } from './tipos';

export type FormatoReporte = 'pdf' | 'xlsx';

const MIME: Record<FormatoReporte, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

async function generar(d: DatosReporte | DatosResumen, formato: FormatoReporte): Promise<Uint8Array> {
  if ('secciones' in d) {
    return formato === 'pdf' ? (await import('./pdf')).generarPdfResumen(d) : (await import('./excel')).generarExcelResumen(d);
  }
  return formato === 'pdf' ? (await import('./pdf')).generarPdf(d) : (await import('./excel')).generarExcel(d);
}

/** Un reporte ya generado en el dispositivo, listo para guardar, abrir o compartir. */
export interface ArchivoReporte {
  nombre: string;
  formato: FormatoReporte;
  blob: Blob;
}

/** Genera el reporte en el dispositivo (no pasa por ningún servidor). */
export async function generarArchivo(d: DatosReporte | DatosResumen, formato: FormatoReporte): Promise<ArchivoReporte> {
  const bytes = await generar(d, formato);
  return { nombre: `${d.nombreArchivo}.${formato}`, formato, blob: new Blob([bytes as BlobPart], { type: MIME[formato] }) };
}

/**
 * Qué se le ofrece a la persona al terminar de generar. `compartir` (menú del sistema: «Guardar en Archivos», WhatsApp,
 * correo…) solo donde el navegador puede compartir archivos; `descargaAutomatica` solo con ratón (computadora):
 * en un celular la descarga que no sale de un toque directo la ignora Safari, así que ahí se usan los botones.
 */
export function decidirEntrega(soportaCompartir: boolean, punteroFino: boolean): { compartir: boolean; descargaAutomatica: boolean } {
  return { compartir: soportaCompartir, descargaAutomatica: punteroFino };
}

/** ¿Este navegador puede compartir este archivo con el menú del sistema? */
export function puedeCompartirArchivo(a: ArchivoReporte): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [aFile(a)] });
  } catch {
    return false;
  }
}

const aFile = (a: ArchivoReporte) => new File([a.blob], a.nombre, { type: MIME[a.formato] });

/** Abre el menú de compartir del sistema con el archivo. Devuelve `false` si la persona lo cerró sin elegir nada. */
export async function compartirArchivo(a: ArchivoReporte): Promise<boolean> {
  try {
    await navigator.share({ files: [aFile(a)], title: a.nombre });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
}

/** Descarga con un enlace oculto (computadora, o el botón «Descargar»). `url` es un `URL.createObjectURL` del blob. */
export function descargarDesdeUrl(url: string, nombre: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Genera el archivo y lo descarga de una vez (sin pasos intermedios). */
export async function descargarReporte(d: DatosReporte | DatosResumen, formato: FormatoReporte): Promise<void> {
  const archivo = await generarArchivo(d, formato);
  const url = URL.createObjectURL(archivo.blob);
  descargarDesdeUrl(url, archivo.nombre);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
