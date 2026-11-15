import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';
import type { ProductoConsolidado } from '@/lib/domain/consolidado';
import type { FechaISO } from '@/lib/domain/types';
import type { TipoReporte } from '@/lib/pdf/tipos';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

const LOTE = 400;

export const ImportacionSchema = z.object({
  tipoReporte: z.enum(['existenciasDespacho', 'productosEnDespacho']),
  fechaReporte: z.instanceof(Timestamp),
  archivo: z.string(),
  filas: z.number().int(),
  codigosNuevos: z.number().int(),
});
export type Importacion = z.infer<typeof ImportacionSchema> & { id: string };

/** Mediodía en Costa Rica (UTC−6): la fecha civil queda igual en cualquier zona del dispositivo. */
export function fechaATimestamp(fecha: FechaISO): Timestamp {
  return Timestamp.fromDate(new Date(`${fecha}T12:00:00-06:00`));
}

export interface DatosImportacion {
  uid: string;
  tipo: TipoReporte;
  fechaReporte: FechaISO;
  archivo: string;
  productos: readonly ProductoConsolidado[];
  codigosNuevos: number;
}

/**
 * Guarda la importación y actualiza las existencias del usuario (ruta `usuarios/{uid}/…`).
 * Se escribe en local de inmediato; la promesa devuelta se cumple cuando el servidor lo confirma,
 * y NO debe esperarse en la UI (sin conexión queda pendiente hasta reconectar).
 */
export function guardarImportacion(d: DatosImportacion): { id: string; confirmada: Promise<void> } {
  const db = firestore();
  const id = crypto.randomUUID();
  const base = `usuarios/${d.uid}`;
  const fecha = fechaATimestamp(d.fechaReporte);
  const pendientes: Promise<void>[] = [];

  for (let i = 0; i < d.productos.length; i += LOTE) {
    const batch = writeBatch(db);
    if (i === 0) {
      batch.set(doc(db, `${base}/importaciones/${id}`), {
        tipoReporte: d.tipo,
        fechaReporte: fecha,
        archivo: d.archivo,
        filas: d.productos.length,
        codigosNuevos: d.codigosNuevos,
        creadoEn: serverTimestamp(),
      });
    }
    for (const p of d.productos.slice(i, i + LOTE)) {
      const { consumo, ...existencia } = p;
      batch.set(
        doc(db, `${base}/existencias/${p.codigo}`),
        { ...existencia, importacionId: id, actualizadoEn: fecha },
        { merge: true },
      );
      if (d.tipo === 'productosEnDespacho' && consumo !== undefined) {
        batch.set(doc(db, `${base}/consumos/${id}_${p.codigo}`), {
          codigo: p.codigo,
          importacionId: id,
          periodo: d.fechaReporte,
          cantidad: consumo,
        });
      }
    }
    pendientes.push(registrarEscritura(batch.commit()));
  }
  return { id, confirmada: Promise.all(pendientes).then(() => undefined) };
}

/** Última importación del usuario (para Hoy). */
export function suscribirUltimaImportacion(
  uid: string,
  alCambiar: (imp: Importacion | null) => void,
): Unsubscribe {
  const q = query(collection(firestore(), `usuarios/${uid}/importaciones`), orderBy('fechaReporte', 'desc'), limit(1));
  return onSnapshot(
    q,
    (snap) => {
      const d = snap.docs[0];
      if (!d) return alCambiar(null);
      const r = ImportacionSchema.safeParse(d.data());
      alCambiar(r.success ? { ...r.data, id: d.id } : null);
    },
    () => alCambiar(null),
  );
}
