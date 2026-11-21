import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import type { FechaISO } from '@/lib/domain/types';
import { camposEditadosTraslado, cerrarTraslado, type ItemTraslado, type RegistroTraslado, type TrasladoValido } from '@/lib/domain/traslados';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const TrasladoSchema = z.object({
  fecha: Fecha,
  ordenSAP: z.string().regex(/^50000\d*$/),
  tipo: z.enum(['envio', 'recepcion']),
  unidad: z.string().min(1).max(80),
  items: z.array(z.object({ codigo: z.string().min(1), cantidad: z.number().finite().positive(), recibida: z.number().finite().nonnegative().optional() })).min(1),
  estado: z.enum(['pendiente', 'recibido', 'enviado']),
  fechaCierre: Fecha.nullable(),
  enSAP: z.boolean(),
  enSIFA: z.boolean(),
  notas: z.string().max(500),
});

const coleccion = (uid: string) => `usuarios/${uid}/traslados`;
const ref = (uid: string, id: string) => doc(firestore(), `${coleccion(uid)}/${id}`);

/** Traslados en vivo (también sin conexión). Los documentos inválidos se omiten. */
export function suscribirTraslados(uid: string, alCambiar: (lista: RegistroTraslado[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), coleccion(uid)),
    (snap) => {
      const lista: RegistroTraslado[] = [];
      for (const d of snap.docs) {
        const r = TrasladoSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, ...r.data });
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Registra un traslado pendiente, con el trámite SAP/SIFA sin marcar. El ID nace en el cliente. */
export function crearTraslado(uid: string, t: TrasladoValido): Promise<void> {
  const id = crypto.randomUUID();
  return registrarEscritura(
    setDoc(ref(uid, id), { ...t, estado: 'pendiente', fechaCierre: null, enSAP: false, enSIFA: false, creadoEn: serverTimestamp() }),
  );
}

/** Corrige un traslado ya guardado. No toca el trámite SAP/SIFA; si el tipo cambió, el estado se ajusta (ver `camposEditadosTraslado`). */
export function actualizarTraslado(uid: string, actual: RegistroTraslado, t: TrasladoValido): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid, actual.id), camposEditadosTraslado(actual, t)));
}

/** Restaura un registro borrado (Deshacer) con el mismo id. */
export function restaurarTraslado(uid: string, r: RegistroTraslado): Promise<void> {
  const { id, ...datos } = r;
  return registrarEscritura(setDoc(ref(uid, id), { ...datos, creadoEn: serverTimestamp() }));
}

export function borrarTraslado(uid: string, id: string): Promise<void> {
  return registrarEscritura(deleteDoc(ref(uid, id)));
}

/** Marca el traslado como recibido (recepción) o enviado (envío) en la fecha dada. */
export function cerrarTrasladoDb(uid: string, t: Pick<RegistroTraslado, 'id' | 'tipo'>, fecha: FechaISO): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid, t.id), cerrarTraslado(t, fecha)));
}

/** Cierra una recepción anotando lo que realmente llegó de cada producto (`items` ya trae `recibida`). */
export function recibirTraslado(uid: string, id: string, items: readonly ItemTraslado[], fecha: FechaISO): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid, id), { estado: 'recibido', fechaCierre: fecha, items }));
}

/** Devuelve el traslado a pendiente (Deshacer). Con `items`, también restaura los productos (sin lo anotado como recibido). */
export function reabrirTraslado(uid: string, id: string, items?: readonly ItemTraslado[]): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid, id), { estado: 'pendiente', fechaCierre: null, ...(items ? { items } : {}) }));
}

/** Checklist de trámite: registrado en SAP / aplicado en SIFA. */
export function marcarTramite(uid: string, id: string, campo: 'enSAP' | 'enSIFA', valor: boolean): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid, id), { [campo]: valor }));
}
