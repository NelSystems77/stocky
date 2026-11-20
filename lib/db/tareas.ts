import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';
import type { Cumplimiento, Tarea } from '@/lib/domain/tareas';
import { idCumplimiento, PRIORIDADES } from '@/lib/domain/tareas';
import type { FechaISO } from '@/lib/domain/types';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const RecurrenciaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('unica'), fecha: Fecha }),
  z.object({ tipo: z.literal('diaria') }),
  z.object({ tipo: z.literal('diasSemana'), dias: z.array(z.number().int().min(0).max(6)) }),
  z.object({ tipo: z.literal('quincenal'), dia: z.number().int().min(0).max(6), ancla: Fecha }),
  z.object({ tipo: z.literal('mensual'), diaMes: z.number().int().min(1).max(31) }),
  z.object({ tipo: z.literal('segundoSabado') }),
  z.object({ tipo: z.literal('tercerJueves') }),
  z.object({ tipo: z.literal('tercerJuevesMas15') }),
]);

export const TareaSchema = z.object({
  titulo: z.string().min(1).max(200),
  recurrencia: RecurrenciaSchema,
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  prioridad: z.enum(PRIORIDADES),
  notas: z.string().max(1000),
  activa: z.boolean(),
  desde: Fecha,
});

const CumplimientoSchema = z.object({
  tareaId: z.string(),
  fechaOrigen: Fecha,
  estado: z.enum(['hecha', 'pospuesta', 'descartada']),
  fechaProgramada: Fecha.optional(),
  motivo: z.string().max(300).optional(),
});

/** Tareas del usuario en vivo (también sin conexión). Los documentos inválidos se omiten. */
export function suscribirTareas(uid: string, alCambiar: (t: Tarea[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), `usuarios/${uid}/tareas`),
    (snap) => {
      const lista: Tarea[] = [];
      for (const d of snap.docs) {
        const r = TareaSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, ...r.data } as Tarea);
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Cumplimientos con fecha de origen desde `desde` (inclusive). */
export function suscribirCumplimientos(
  uid: string,
  desde: FechaISO,
  alCambiar: (c: Cumplimiento[]) => void,
): Unsubscribe {
  const q = query(collection(firestore(), `usuarios/${uid}/cumplimientos`), where('fechaOrigen', '>=', desde));
  return onSnapshot(
    q,
    (snap) => {
      const lista: Cumplimiento[] = [];
      for (const d of snap.docs) {
        const r = CumplimientoSchema.safeParse(d.data());
        if (r.success) lista.push(r.data);
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Quita los `undefined` (Firestore no los acepta). */
function limpiar<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Crea o actualiza una plantilla. No esperar la promesa en la UI: escribe en local y sigue. */
export function guardarTarea(uid: string, t: Tarea): Promise<void> {
  const { id, ...datos } = t;
  return registrarEscritura(setDoc(doc(firestore(), `usuarios/${uid}/tareas/${id}`), datos));
}

export function sembrarTareas(uid: string, tareas: readonly Tarea[]): Promise<void> {
  const db = firestore();
  const batch = writeBatch(db);
  for (const { id, ...datos } of tareas) batch.set(doc(db, `usuarios/${uid}/tareas/${id}`), datos);
  return registrarEscritura(batch.commit());
}

export function guardarCumplimiento(uid: string, c: Cumplimiento): Promise<void> {
  return registrarEscritura(
    setDoc(doc(firestore(), `usuarios/${uid}/cumplimientos/${idCumplimiento(c.tareaId, c.fechaOrigen)}`), limpiar(c)),
  );
}

/** Para «Deshacer»: vuelve al estado anterior (o borra el registro si no había). */
export function restaurarCumplimiento(
  uid: string,
  tareaId: string,
  fechaOrigen: FechaISO,
  previo: Cumplimiento | null,
): Promise<void> {
  if (previo) return guardarCumplimiento(uid, previo);
  return registrarEscritura(deleteDoc(doc(firestore(), `usuarios/${uid}/cumplimientos/${idCumplimiento(tareaId, fechaOrigen)}`)));
}
