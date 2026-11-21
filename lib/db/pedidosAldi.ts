import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import type { LineaAldi } from '@/lib/domain/pedidoAldi';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const LineaSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string(),
  ud: z.string(),
  cuota: z.number().finite().nonnegative(),
  existencia: z.number().finite().nonnegative(),
  objetivo: z.number().finite().nonnegative(),
  /** Consumo esperado del período (unidades base); `null` sin consumo. Ausente en pedidos de la primera versión. */
  consumo: z.number().finite().nonnegative().nullable().optional(),
  criterio: z.enum(['consumo', 'limitadaPorCuota', 'sinConsumo']).optional(),
  calculada: z.number().int().positive(),
  cantidad: z.number().int().positive(),
});

export const PedidoAldiSchema = z.object({
  /** Día en que se hizo el pedido. */
  fecha: Fecha,
  fechaReporteSifa: Fecha.nullable(),
  factor: z.number().finite().positive(),
  dias: z.number().int().positive(),
  lineas: z.array(LineaSchema),
});

export interface PedidoAldi extends z.infer<typeof PedidoAldiSchema> {
  id: string;
}

export interface NuevoPedidoAldi {
  fecha: string;
  fechaReporteSifa: string | null;
  factor: number;
  dias: number;
  lineas: LineaAldi[];
}

const coleccion = (uid: string) => `usuarios/${uid}/pedidosAldi`;

/** Pedidos guardados en vivo (también sin conexión), el más reciente primero. Los documentos inválidos se omiten. */
export function suscribirPedidosAldi(uid: string, alCambiar: (lista: PedidoAldi[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), coleccion(uid)),
    (snap) => {
      const lista: PedidoAldi[] = [];
      for (const d of snap.docs) {
        const r = PedidoAldiSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, ...r.data });
      }
      lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Guarda el pedido. El ID nace en el cliente: funciona sin conexión. */
export function guardarPedidoAldi(uid: string, p: NuevoPedidoAldi): Promise<void> {
  return registrarEscritura(setDoc(doc(firestore(), `${coleccion(uid)}/${crypto.randomUUID()}`), { ...p, creadoEn: serverTimestamp() }));
}

export function borrarPedidoAldi(uid: string, id: string): Promise<void> {
  return registrarEscritura(deleteDoc(doc(firestore(), `${coleccion(uid)}/${id}`)));
}

/** Restaura un pedido borrado (Deshacer) con el mismo id. */
export function restaurarPedidoAldi(uid: string, p: PedidoAldi): Promise<void> {
  const { id, ...datos } = p;
  return registrarEscritura(setDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { ...datos, creadoEn: serverTimestamp() }));
}
