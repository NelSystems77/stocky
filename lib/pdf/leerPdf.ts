import type * as PdfjsTipos from 'pdfjs-dist';
import { agruparLineas, type ItemTexto } from './lineas';

type Pdfjs = Pick<typeof PdfjsTipos, 'getDocument'>;

/** Extrae las líneas de texto de todas las páginas, en orden. El PDF no sale del dispositivo. */
export async function extraerLineas(pdfjs: Pdfjs, datos: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: datos }).promise;
  const lineas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    const items: ItemTexto[] = [];
    for (const it of contenido.items) {
      if (!('str' in it)) continue;
      items.push({ texto: it.str, x: it.transform[4] ?? 0, y: it.transform[5] ?? 0, ancho: it.width });
    }
    lineas.push(...agruparLineas(items));
  }
  return lineas;
}

/** Lectura en el navegador: carga pdf.js bajo demanda para no pesar en el arranque. */
export async function leerPdfEnNavegador(archivo: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  return extraerLineas(pdfjs, new Uint8Array(await archivo.arrayBuffer()));
}
