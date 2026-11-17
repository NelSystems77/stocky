import type { DatosReporte, DatosResumen } from './tipos';

async function generar(d: DatosReporte | DatosResumen, formato: FormatoReporte): Promise<Uint8Array> {
  if ('secciones' in d) {
    return formato === 'pdf' ? (await import('./pdf')).generarPdfResumen(d) : (await import('./excel')).generarExcelResumen(d);
  }
  return formato === 'pdf' ? (await import('./pdf')).generarPdf(d) : (await import('./excel')).generarExcel(d);
}

export type FormatoReporte = 'pdf' | 'xlsx';

const MIME: Record<FormatoReporte, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Genera el archivo en el dispositivo y lo descarga. Los reportes no pasan por ningún servidor. */
export async function descargarReporte(d: DatosReporte | DatosResumen, formato: FormatoReporte): Promise<void> {
  const bytes = await generar(d, formato);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[formato] }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${d.nombreArchivo}.${formato}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
