import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import type { EntregaValida, RegistroPreconteo } from '@/lib/domain/preconteo';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

export const PreconteoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  codigo: z.string().min(1),
  cantidad: z.number().finite().positive(),
  presentacion: z.number().int().positive(),
  recibida: z.number().finite().nonnegative().nullable(),
  notas: z.string().max(500),
});

const coleccion = (uid: string) => `usuarios/${uid}/preconteos`;

/** Entregas de preconteo en vivo (también sin conexión). Los documentos inválidos se omiten. */
export function suscribirPreconteos(uid: string, alCambiar: (lista: RegistroPreconteo[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), coleccion(uid)),
    (snap) => {
      const lista: RegistroPreconteo[] = [];
      for (const d of snap.docs) {
        const r = PreconteoSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, ...r.data });
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Registra una entrega (pendiente de recibir). El ID nace en el cliente para que funcione sin conexión. */
export function crearPreconteo(uid: string, e: EntregaValida): Promise<void> {
  const id = crypto.randomUUID();
  return registrarEscritura(setDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { ...e, recibida: null, creadoEn: serverTimestamp() }));
}

/** Restaura un registro borrado (Deshacer) con el mismo id. */
export function restaurarPreconteo(uid: string, r: RegistroPreconteo): Promise<void> {
  const { id, ...datos } = r;
  return registrarEscritura(setDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { ...datos, creadoEn: serverTimestamp() }));
}

export function borrarPreconteo(uid: string, id: string): Promise<void> {
  return registrarEscritura(deleteDoc(doc(firestore(), `${coleccion(uid)}/${id}`)));
}

/** Anota lo que volvió precontado (unidades base). `null` la devuelve a pendiente (Deshacer). */
export function registrarRecepcion(uid: string, id: string, recibida: number | null): Promise<void> {
  return registrarEscritura(updateDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { recibida }));
}

export function guardarNotasPreconteo(uid: string, id: string, notas: string): Promise<void> {
  return registrarEscritura(updateDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { notas: notas.slice(0, 500) }));
}
