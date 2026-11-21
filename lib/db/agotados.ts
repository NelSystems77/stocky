import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import type { AgotadoManualValido, RegistroAgotado } from '@/lib/domain/agotados';
import type { FechaISO } from '@/lib/domain/types';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AgotadoSchema = z.object({
  codigo: z.string().min(1),
  fechaAgotado: Fecha,
  fechaIngreso: Fecha.nullable(),
  origen: z.enum(['detectado', 'manual']),
  notas: z.string().max(500),
});

const coleccion = (uid: string) => `usuarios/${uid}/agotados`;

/** Registros de agotados en vivo (también sin conexión). Los documentos inválidos se omiten. */
export function suscribirAgotados(uid: string, alCambiar: (lista: RegistroAgotado[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), coleccion(uid)),
    (snap) => {
      const lista: RegistroAgotado[] = [];
      for (const d of snap.docs) {
        const r = AgotadoSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, ...r.data });
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Confirma agotados detectados: un registro abierto por producto, con la fecha del reporte. */
export function confirmarAgotados(uid: string, items: readonly { codigo: string; fechaAgotado: FechaISO }[]): Promise<void> {
  const db = firestore();
  const batch = writeBatch(db);
  for (const it of items) {
    batch.set(doc(db, `${coleccion(uid)}/${crypto.randomUUID()}`), {
      codigo: it.codigo,
      fechaAgotado: it.fechaAgotado,
      fechaIngreso: null,
      origen: 'detectado',
      notas: '',
      creadoEn: serverTimestamp(),
    });
  }
  return registrarEscritura(batch.commit());
}

/** Cierra registros porque el producto volvió a tener existencia. */
export function cerrarAgotados(uid: string, cierres: readonly { id: string; fechaIngreso: FechaISO }[]): Promise<void> {
  const db = firestore();
  const batch = writeBatch(db);
  for (const c of cierres) batch.update(doc(db, `${coleccion(uid)}/${c.id}`), { fechaIngreso: c.fechaIngreso });
  return registrarEscritura(batch.commit());
}

export function guardarNotas(uid: string, id: string, notas: string): Promise<void> {
  return registrarEscritura(updateDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { notas: notas.slice(0, 500) }));
}

/** Alta manual de un agotado: queda abierto (sin fecha de ingreso) hasta que un reporte posterior traiga existencia. */
export function crearAgotadoManual(uid: string, v: AgotadoManualValido): Promise<void> {
  return registrarEscritura(
    setDoc(doc(firestore(), `${coleccion(uid)}/${crypto.randomUUID()}`), {
      codigo: v.codigo,
      fechaAgotado: v.fechaAgotado,
      fechaIngreso: null,
      origen: 'manual',
      notas: v.notas,
      creadoEn: serverTimestamp(),
    }),
  );
}
