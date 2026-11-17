/** Fragmento de una línea: texto normal o en negrita (`**así**`). */
export interface Trozo {
  texto: string;
  negrita: boolean;
}

export type Bloque = { tipo: 'parrafo'; trozos: Trozo[] } | { tipo: 'lista'; items: Trozo[][] };

/** Separa `**negrita**` del resto. Sin HTML: el texto se pinta como nodos de React, nunca como marcado. */
export function trocear(linea: string): Trozo[] {
  const trozos: Trozo[] = [];
  const partes = linea.split('**');
  partes.forEach((parte, i) => {
    if (parte === '') return;
    // Los fragmentos impares van entre `**`; si la última marca no cierra, se deja como texto normal.
    const dentro = i % 2 === 1 && i < partes.length - 1;
    trozos.push({ texto: dentro ? parte : i % 2 === 1 ? `**${parte}` : parte, negrita: dentro });
  });
  return trozos;
}

/** Párrafos y listas con viñetas (`- ` o `* `) de la respuesta de Chango. Lo demás se muestra tal cual. */
export function parsearRespuesta(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let lista: Trozo[][] | null = null;
  for (const cruda of texto.replace(/\r/g, '').split('\n')) {
    const linea = cruda.trim();
    const viñeta = /^[-*•]\s+(.*)$/.exec(linea);
    if (viñeta) {
      if (!lista) {
        lista = [];
        bloques.push({ tipo: 'lista', items: lista });
      }
      lista.push(trocear(viñeta[1] ?? ''));
      continue;
    }
    lista = null;
    if (linea !== '') bloques.push({ tipo: 'parrafo', trozos: trocear(linea.replace(/^#{1,6}\s+/, '')) });
  }
  return bloques;
}
