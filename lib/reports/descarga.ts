import type { DatosReporte } from './tipos';

export type FormatoReporte = 'pdf' | 'xlsx';

const MIME: Record<FormatoReporte, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Genera el archivo en el dispositivo y lo descarga. Los reportes no pasan por ningún servidor. */
export async function descargarReporte(d: DatosReporte, formato: FormatoReporte): Promise<void> {
  const bytes = formato === 'pdf' ? await (await import('./pdf')).generarPdf(d) : await (await import('./excel')).generarExcel(d);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[formato] }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${d.nombreArchivo}.${formato}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
