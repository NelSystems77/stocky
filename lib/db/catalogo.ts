import { collection, doc, getDocs, getDocsFromCache, serverTimestamp, writeBatch } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { factorUD, type TablaUD } from '@/lib/domain/unidades';
import { registrarEscritura } from './sync';

const LOTE = 400;

export interface CodigoNuevo {
  codigo: string;
  descripcion: string;
  ud: string;
}

const ESPERA_SERVIDOR_MS = 6000;

/**
 * Códigos que ya existen en el catálogo compartido. Pregunta al servidor, pero no espera más de 6 s:
 * si no responde (mala señal) usa la copia local. Lanza error solo si no hay ninguna de las dos.
 */
export async function leerCodigosCatalogo(): Promise<Set<string>> {
  const ref = collection(firestore(), 'catalogo');
  const espera = new Promise<'tarde'>((res) => setTimeout(() => res('tarde'), ESPERA_SERVIDOR_MS));
  const snap = await Promise.race([getDocs(ref), espera]).catch(() => 'tarde' as const);
  if (snap !== 'tarde') return new Set(snap.docs.map((d) => d.id));

  const local = await getDocsFromCache(ref);
  if (local.empty) throw new Error('Catálogo no disponible');
  return new Set(local.docs.map((d) => d.id));
}

/**
 * Crea (nunca edita) los códigos que faltan. Va en lotes aparte de los datos del usuario: si otra persona
 * creó el mismo código a la vez, solo falla este paso y el reporte importado no se pierde.
 * La promesa se cumple cuando el servidor confirma; no hay que esperarla para seguir usando la app.
 */
export async function crearCodigosCatalogo(
  items: readonly CodigoNuevo[],
  marcarNuevo: boolean,
  tabla: TablaUD,
): Promise<void> {
  const db = firestore();
  const lotes: Promise<void>[] = [];
  for (let i = 0; i < items.length; i += LOTE) {
    const batch = writeBatch(db);
    for (const it of items.slice(i, i + LOTE)) {
      batch.set(doc(db, 'catalogo', it.codigo), {
        descripcion: it.descripcion,
        ud: it.ud,
        factorUnidad: factorUD(it.ud, tabla),
        nuevo: marcarNuevo,
        creadoEn: serverTimestamp(),
      });
    }
    lotes.push(registrarEscritura(batch.commit()));
  }
  await Promise.all(lotes);
}
