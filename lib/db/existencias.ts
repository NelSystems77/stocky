import { collection, onSnapshot, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import { firestore } from '@/lib/firebase';

const Cant = z.number().finite().optional();

export const ExistenciaSchema = z.object({
  codigo: z.string(),
  ud: z.string(),
  descripcion: z.string(),
  /** Unidades base. */
  cuota: Cant,
  cuotaMinima: Cant,
  existencia: Cant,
  actualizadoEn: z.instanceof(Timestamp),
});
export type Existencia = z.infer<typeof ExistenciaSchema>;

/** Existencias del usuario en vivo (también desde la caché sin conexión). Los documentos inválidos se omiten. */
export function suscribirExistencias(uid: string, alCambiar: (lista: Existencia[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), `usuarios/${uid}/existencias`),
    (snap) => {
      const lista: Existencia[] = [];
      for (const d of snap.docs) {
        const r = ExistenciaSchema.safeParse(d.data());
        if (r.success) lista.push(r.data);
      }
      lista.sort((a, b) => a.codigo.localeCompare(b.codigo));
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}
