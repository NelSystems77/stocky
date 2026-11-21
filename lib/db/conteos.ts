import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import type { FotoSifa, LineaConteo } from '@/lib/domain/conteo';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const FotoSchema = z.record(z.string(), z.object({ descripcion: z.string(), ud: z.string(), sifa: z.number().finite() }));

export const ConteoSchema = z.object({
  /** Día en que se hizo el conteo. */
  fecha: Fecha,
  /** Fecha del reporte de SIFA del que sale la foto (o `null` si no se conoce). */
  fechaReporteSifa: Fecha.nullable(),
  alcance: z.enum(['todos', 'lista']),
  /** Existencia de SIFA congelada al iniciar. */
  foto: FotoSchema,
});

export const LineaSchema = z.object({
  codigo: z.string().min(1),
  contado: z.number().finite().nonnegative(),
  observacion: z.string().max(500),
  fueraDeSifa: z.object({ descripcion: z.string().max(200), ud: z.string().max(20) }).optional(),
});

export interface Conteo extends z.infer<typeof ConteoSchema> {
  id: string;
}

export interface NuevoConteo {
  fecha: string;
  fechaReporteSifa: string | null;
  alcance: 'todos' | 'lista';
  foto: FotoSifa;
}

const coleccion = (uid: string) => `usuarios/${uid}/conteos`;
const lineas = (uid: string, id: string) => `${coleccion(uid)}/${id}/lineas`;

/** Conteos del usuario en vivo (también sin conexión). Los documentos inválidos se omiten. */
export function suscribirConteos(uid: string, alCambiar: (lista: Conteo[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), coleccion(uid)),
    (snap) => {
      const lista: Conteo[] = [];
      for (const d of snap.docs) {
        const r = ConteoSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, ...r.data });
      }
      lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Lo contado de un conteo, en vivo. */
export function suscribirLineas(uid: string, id: string, alCambiar: (lista: LineaConteo[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), lineas(uid, id)),
    (snap) => {
      const lista: LineaConteo[] = [];
      for (const d of snap.docs) {
        const r = LineaSchema.safeParse(d.data());
        if (r.success) lista.push(r.data);
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Inicia un conteo con su foto de SIFA. El ID nace en el cliente: funciona sin conexión. Devuelve el id de inmediato. */
export function crearConteo(uid: string, n: NuevoConteo): { id: string; guardado: Promise<void> } {
  const id = crypto.randomUUID();
  const guardado = registrarEscritura(setDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { ...n, creadoEn: serverTimestamp() }));
  return { id, guardado };
}

/** Anota (o corrige) lo contado de un producto. */
export function guardarLinea(uid: string, id: string, l: LineaConteo): Promise<void> {
  const datos = { codigo: l.codigo, contado: l.contado, observacion: l.observacion.slice(0, 500), ...(l.fueraDeSifa ? { fueraDeSifa: l.fueraDeSifa } : {}), actualizadoEn: serverTimestamp() };
  return registrarEscritura(setDoc(doc(firestore(), `${lineas(uid, id)}/${l.codigo}`), datos));
}

/** Quita lo contado de un producto: vuelve a «sin contar». */
export function quitarLinea(uid: string, id: string, codigo: string): Promise<void> {
  return registrarEscritura(deleteDoc(doc(firestore(), `${lineas(uid, id)}/${codigo}`)));
}

/** Borra el conteo y todo lo contado. `codigos` son las líneas que tiene (para poder borrarlas sin leer el servidor). */
export function borrarConteo(uid: string, id: string, codigos: readonly string[]): Promise<void> {
  const db = firestore();
  const tandas: Promise<void>[] = [];
  for (let i = 0; i < codigos.length; i += 400) {
    const batch = writeBatch(db);
    for (const c of codigos.slice(i, i + 400)) batch.delete(doc(db, `${lineas(uid, id)}/${c}`));
    tandas.push(registrarEscritura(batch.commit()));
  }
  tandas.push(registrarEscritura(deleteDoc(doc(db, `${coleccion(uid)}/${id}`))));
  return Promise.all(tandas).then(() => undefined);
}

/** Restaura un conteo borrado (Deshacer) con el mismo id, su foto y lo contado. */
export function restaurarConteo(uid: string, c: Conteo, contado: readonly LineaConteo[]): Promise<void> {
  const db = firestore();
  const { id, ...datos } = c;
  const tandas: Promise<void>[] = [registrarEscritura(setDoc(doc(db, `${coleccion(uid)}/${id}`), { ...datos, creadoEn: serverTimestamp() }))];
  for (let i = 0; i < contado.length; i += 400) {
    const batch = writeBatch(db);
    for (const l of contado.slice(i, i + 400)) {
      batch.set(doc(db, `${lineas(uid, id)}/${l.codigo}`), { ...l, actualizadoEn: serverTimestamp() });
    }
    tandas.push(registrarEscritura(batch.commit()));
  }
  return Promise.all(tandas).then(() => undefined);
}
