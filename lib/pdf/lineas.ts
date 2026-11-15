export interface ItemTexto {
  texto: string;
  x: number;
  y: number;
  ancho: number;
}

const TOLERANCIA_Y = 2;
const HUECO_ESPACIO = 1.5;

/**
 * Reconstruye las líneas visuales de UNA página a partir de los fragmentos de texto y su posición.
 * Orden: de arriba hacia abajo y de izquierda a derecha.
 */
export function agruparLineas(items: readonly ItemTexto[]): string[] {
  const ordenados = items
    .filter((i) => i.texto.trim() !== '')
    .toSorted((a, b) => b.y - a.y || a.x - b.x);

  const grupos: ItemTexto[][] = [];
  let yActual = Number.NaN;
  for (const item of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && Math.abs(item.y - yActual) <= TOLERANCIA_Y) {
      ultimo.push(item);
    } else {
      grupos.push([item]);
      yActual = item.y;
    }
  }

  return grupos
    .map((g) => {
      const fila = g.toSorted((a, b) => a.x - b.x || b.ancho - a.ancho);
      const visibles: ItemTexto[] = [];
      for (const it of fila) {
        const previo = visibles[visibles.length - 1];
        if (previo && superpuestos(previo, it)) {
          // Algunos reportes dibujan la 2.ª línea de una descripción larga encima de la 1.ª (no se ve en
          // pantalla). Se descarta el fragmento más angosto y queda el texto visible.
          if (it.ancho > previo.ancho) visibles[visibles.length - 1] = it;
          continue;
        }
        visibles.push(it);
      }
      let linea = '';
      let finPrevio = Number.NEGATIVE_INFINITY;
      for (const it of visibles) {
        const separar = it.x - finPrevio > HUECO_ESPACIO;
        linea += (separar && linea !== '' ? ' ' : '') + it.texto.trim();
        finPrevio = it.x + it.ancho;
      }
      return linea.replace(/\s+/g, ' ').trim();
    })
    .filter((l) => l !== '');
}

/** Dos fragmentos se superponen si comparten más de la mitad del ancho del más angosto. */
function superpuestos(a: ItemTexto, b: ItemTexto): boolean {
  const solape = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x);
  return solape > 0.5 * Math.min(a.ancho, b.ancho);
}
