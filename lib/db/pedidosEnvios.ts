import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import {
  ANTICIPACION_MAX,
  idSeguimiento,
  type ClaseProgramado,
  type Programado,
  type Seguimiento,
} from '@/lib/domain/pedidosEnvios';
import type { FechaISO } from '@/lib/domain/types';
import { firestore } from '@/lib/firebase';
import { RecurrenciaSchema } from './tareas';
import { registrarEscritura } from './sync';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const ProgramacionSchema = z.union([
  RecurrenciaSchema,
  z.object({ tipo: z.literal('ultimoDiaSemana'), dia: z.number().int().min(0).max(6) }),
]);

/** La clase no se guarda: la dice la colección (`tiposPedido` = pedido, `puestos` = envío; PRD §9). */
export const ProgramadoSchema = z.object({
  nombre: z.string().min(1).max(100),
  recurrencias: z.array(ProgramacionSchema).min(1).max(6),
  anticipacion: z.number().int().min(0).max(ANTICIPACION_MAX),
  activo: z.boolean(),
  desde: Fecha,
  notas: z.string().max(500),
});

const SeguimientoSchema = z.object({
  programadoId: z.string(),
  fecha: Fecha,
  estado: z.enum(['en_tramite', 'enviado']),
});

export const COLECCION: Record<ClaseProgramado, string> = { pedido: 'tiposPedido', envio: 'puestos' };

/** Pedidos y envíos en vivo (también sin conexión). Los documentos inválidos se omiten. */
export function suscribirProgramados(uid: string, clase: ClaseProgramado, alCambiar: (p: Programado[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), `usuarios/${uid}/${COLECCION[clase]}`),
    (snap) => {
      const lista: Programado[] = [];
      for (const d of snap.docs) {
        const r = ProgramadoSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, clase, ...r.data } as Programado);
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Seguimientos con fecha desde `desde` (inclusive). */
export function suscribirSeguimientos(uid: string, desde: FechaISO, alCambiar: (s: Seguimiento[]) => void): Unsubscribe {
  const q = query(collection(firestore(), `usuarios/${uid}/seguimientos`), where('fecha', '>=', desde));
  return onSnapshot(
    q,
    (snap) => {
      const lista: Seguimiento[] = [];
      for (const d of snap.docs) {
        const r = SeguimientoSchema.safeParse(d.data());
        if (r.success) lista.push(r.data);
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Crea o actualiza. No esperar la promesa en la UI: escribe en local y sigue. */
export function guardarProgramado(uid: string, p: Programado): Promise<void> {
  const { id, clase, ...datos } = p;
  return registrarEscritura(setDoc(doc(firestore(), `usuarios/${uid}/${COLECCION[clase]}/${id}`), datos));
}

export function sembrarProgramados(uid: string, lista: readonly Programado[]): Promise<void> {
  const db = firestore();
  const batch = writeBatch(db);
  for (const { id, clase, ...datos } of lista) batch.set(doc(db, `usuarios/${uid}/${COLECCION[clase]}/${id}`), datos);
  return registrarEscritura(batch.commit());
}

export function guardarSeguimiento(uid: string, s: Seguimiento): Promise<void> {
  return registrarEscritura(setDoc(doc(firestore(), `usuarios/${uid}/seguimientos/${idSeguimiento(s.programadoId, s.fecha)}`), s));
}

/** Para «Deshacer»: vuelve al estado anterior (o borra el registro si era pendiente). */
export function restaurarSeguimiento(uid: string, programadoId: string, fecha: FechaISO, previo: Seguimiento | null): Promise<void> {
  if (previo) return guardarSeguimiento(uid, previo);
  return registrarEscritura(deleteDoc(doc(firestore(), `usuarios/${uid}/seguimientos/${idSeguimiento(programadoId, fecha)}`)));
}
