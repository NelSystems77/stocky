import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import type { EntradaVencido, RegistroVencido } from '@/lib/domain/vencidos';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const VencidoSchema = z.object({
  fecha: Fecha,
  codigo: z.string().min(1),
  lote: z.string().min(1).max(40),
  fechaVencimiento: Fecha,
  cantidad: z.number().finite().positive(),
  origen: z.enum(['manual', 'reporte']),
  notas: z.string().max(500),
});

const coleccion = (uid: string) => `usuarios/${uid}/vencidos`;

/** Vencidos en vivo (también sin conexión). Los documentos inválidos se omiten. */
export function suscribirVencidos(uid: string, alCambiar: (lista: RegistroVencido[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), coleccion(uid)),
    (snap) => {
      const lista: RegistroVencido[] = [];
      for (const d of snap.docs) {
        const r = VencidoSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, ...r.data });
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Registro manual de un vencido. El ID nace en el cliente para que funcione sin conexión. */
export function crearVencido(uid: string, e: EntradaVencido): Promise<void> {
  const id = crypto.randomUUID();
  return registrarEscritura(setDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { ...e, origen: 'manual', creadoEn: serverTimestamp() }));
}

/** Restaura un registro borrado (Deshacer) con el mismo id. */
export function restaurarVencido(uid: string, r: RegistroVencido): Promise<void> {
  const { id, ...datos } = r;
  return registrarEscritura(setDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { ...datos, creadoEn: serverTimestamp() }));
}

export function borrarVencido(uid: string, id: string): Promise<void> {
  return registrarEscritura(deleteDoc(doc(firestore(), `${coleccion(uid)}/${id}`)));
}
