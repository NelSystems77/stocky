import {
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';
import {
  detalleDeCambios,
  planGuardadoLotes,
  type CambiosLotes,
  type DetalleCambio,
  type Lote,
  type LoteGuardado,
} from '@/lib/domain/lotes';
import type { FechaISO } from '@/lib/domain/types';
import { firestore } from '@/lib/firebase';
import { fechaATimestamp } from './importaciones';
import { registrarEscritura } from './sync';

const LOTE_ESCRITURAS = 400;
/** Importaciones recientes que se revisan para encontrar las cargas de lotes (hay otros tipos de reporte). */
const REVISAR_IMPORTACIONES = 40;
const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LoteGuardadoSchema = z.object({
  codigo: z.string(),
  ud: z.string(),
  descripcion: z.string(),
  lote: z.string(),
  vence: Fecha,
  /** Unidades base. */
  cantidad: z.number().finite(),
  valor: z.number().finite(),
  estado: z.enum(['activo', 'gestionado', 'vencido', 'agotado']),
  cantidadIngresada: z.number().finite(),
  fechaIngreso: Fecha,
  ultimaVez: Fecha,
  gestion: z.object({ motivo: z.string(), fecha: Fecha }).optional(),
});

function aLotes(docs: readonly { id: string; data: () => unknown }[]): LoteGuardado[] {
  const lista: LoteGuardado[] = [];
  for (const d of docs) {
    const r = LoteGuardadoSchema.safeParse(d.data());
    if (r.success) lista.push({ id: d.id, ...r.data });
  }
  return lista;
}

/** Todos los lotes guardados del usuario (también desde la caché sin conexión). Los documentos inválidos se omiten. */
export async function leerLotes(uid: string): Promise<LoteGuardado[]> {
  return aLotes((await getDocs(collection(firestore(), `usuarios/${uid}/lotes`))).docs);
}

/** Lotes en vivo (también sin conexión). */
export function suscribirLotes(uid: string, alCambiar: (lista: LoteGuardado[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), `usuarios/${uid}/lotes`),
    (snap) => alCambiar(aLotes(snap.docs)),
    () => alCambiar([]),
  );
}

export interface DatosCargaLotes {
  uid: string;
  fechaReporte: FechaISO;
  archivo: string;
  lotes: readonly Lote[];
  anteriores: readonly LoteGuardado[];
  cambios: CambiosLotes;
  /** `false` en la primera carga: no se guarda el detalle de cambios (todo sería «nuevo»). */
  hayAnterior: boolean;
}

/**
 * Guarda una carga de lotes: deja cada lote con su cantidad real, marca como agotado lo que ya no aparece (el historial
 * no se borra), registra en Vencidos los lotes cuya fecha ya llegó (RF-2.5) y guarda la importación con el resumen y el
 * **detalle de cada cambio** que la persona revisó (`importaciones/{id}/cambios`).
 * Escribe en local de inmediato; NO esperar `confirmada` en la UI.
 */
export function guardarCargaLotes(d: DatosCargaLotes): { id: string; confirmada: Promise<void> } {
  const db = firestore();
  const id = crypto.randomUUID();
  const base = `usuarios/${d.uid}`;
  const { lotes, salidas, vencidos } = planGuardadoLotes(d.lotes, d.anteriores, d.fechaReporte);
  const detalle = detalleDeCambios(d.cambios, d.hayAnterior);

  type Op = (batch: ReturnType<typeof writeBatch>) => void;
  const ops: Op[] = [
    (b) =>
      b.set(doc(db, `${base}/importaciones/${id}`), {
        tipoReporte: 'lotesVencimientos',
        fechaReporte: fechaATimestamp(d.fechaReporte),
        archivo: d.archivo,
        filas: d.lotes.length,
        codigosNuevos: 0,
        cambios: {
          nuevos: d.cambios.nuevos.length,
          salieron: d.cambios.salieron.length,
          bajaron: d.cambios.bajaron.length,
          subieron: d.cambios.subieron.length,
          vencimiento: d.cambios.vencimiento.length,
          sinCambio: d.cambios.sinCambio,
          vencidosRegistrados: vencidos.length,
        },
        creadoEn: serverTimestamp(),
      }),
    ...lotes.map((l): Op => (b) => b.set(doc(db, `${base}/lotes/${l.id}`), { ...l.datos, importacionId: id }, { merge: true })),
    ...salidas.map((s): Op => (b) => b.set(doc(db, `${base}/lotes/${s.id}`), { ...s.datos, importacionId: id }, { merge: true })),
    ...vencidos.map((v): Op => (b) => b.set(doc(db, `${base}/vencidos/${v.id}`), { ...v.datos, creadoEn: serverTimestamp() })),
    ...detalle.map((c, i): Op => (b) => b.set(doc(db, `${base}/importaciones/${id}/cambios/${String(i).padStart(5, '0')}`), c)),
  ];

  const pendientes: Promise<void>[] = [];
  for (let i = 0; i < ops.length; i += LOTE_ESCRITURAS) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + LOTE_ESCRITURAS)) op(batch);
    pendientes.push(registrarEscritura(batch.commit()));
  }
  return { id, confirmada: Promise.all(pendientes).then(() => undefined) };
}

/** Gestiona un lote (RF-2.4): trasladado, consumido o dado de baja en SIFA. Deja de alertar. Escribe en local y sigue. */
export function gestionarLote(uid: string, id: string, motivo: string, fecha: FechaISO): Promise<void> {
  return registrarEscritura(
    updateDoc(doc(firestore(), `usuarios/${uid}/lotes/${id}`), { estado: 'gestionado', gestion: { motivo: motivo.trim().slice(0, 200), fecha } }),
  );
}

/** Deshace la gestión: vuelve a `vencido` si la fecha ya llegó, o a `activo`. */
export function reabrirLote(uid: string, lote: Pick<LoteGuardado, 'id' | 'vence'>, hoy: FechaISO): Promise<void> {
  return registrarEscritura(
    updateDoc(doc(firestore(), `usuarios/${uid}/lotes/${lote.id}`), { estado: lote.vence <= hoy ? 'vencido' : 'activo', gestion: deleteField() }),
  );
}

const CargaSchema = z.object({
  tipoReporte: z.string(),
  archivo: z.string(),
  filas: z.number().int(),
  cambios: z
    .object({
      nuevos: z.number().int(),
      salieron: z.number().int(),
      bajaron: z.number().int(),
      subieron: z.number().int(),
      vencimiento: z.number().int(),
      sinCambio: z.number().int(),
      vencidosRegistrados: z.number().int().optional(),
    })
    .optional(),
});

export interface CargaLotes {
  id: string;
  /** Fecha del reporte (`YYYY-MM-DD`). */
  fecha: FechaISO;
  archivo: string;
  lotes: number;
  cambios: {
    nuevos: number;
    salieron: number;
    bajaron: number;
    subieron: number;
    vencimiento: number;
    sinCambio: number;
    vencidosRegistrados: number;
  } | null;
}

/** Cargas de lotes anteriores, la más reciente primero. */
export function suscribirCargasLotes(uid: string, alCambiar: (lista: CargaLotes[]) => void): Unsubscribe {
  const q = query(collection(firestore(), `usuarios/${uid}/importaciones`), orderBy('fechaReporte', 'desc'), limit(REVISAR_IMPORTACIONES));
  return onSnapshot(
    q,
    (snap) => {
      const lista: CargaLotes[] = [];
      for (const d of snap.docs) {
        const r = CargaSchema.safeParse(d.data());
        if (!r.success || r.data.tipoReporte !== 'lotesVencimientos') continue;
        const ts = d.get('fechaReporte') as { toDate: () => Date } | undefined;
        lista.push({
          id: d.id,
          fecha: ts ? new Date(ts.toDate().getTime() - 6 * 3_600_000).toISOString().slice(0, 10) : '',
          archivo: r.data.archivo,
          lotes: r.data.filas,
          cambios: r.data.cambios ? { ...r.data.cambios, vencidosRegistrados: r.data.cambios.vencidosRegistrados ?? 0 } : null,
        });
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

const DetalleSchema = z.object({
  tipo: z.enum(['nuevo', 'salio', 'bajo', 'subio', 'vencimiento']),
  codigo: z.string(),
  descripcion: z.string(),
  ud: z.string(),
  lote: z.string(),
  vence: Fecha,
  venceAntes: Fecha.optional(),
  antes: z.number().optional(),
  despues: z.number().optional(),
});

/** Detalle de cada cambio de una carga (en el orden en que se guardó: críticos primero). */
export async function leerDetalleCarga(uid: string, importacionId: string): Promise<DetalleCambio[]> {
  const snap = await getDocs(query(collection(firestore(), `usuarios/${uid}/importaciones/${importacionId}/cambios`), orderBy('__name__')));
  const lista: DetalleCambio[] = [];
  for (const d of snap.docs) {
    const r = DetalleSchema.safeParse(d.data());
    if (r.success) lista.push(r.data as DetalleCambio);
  }
  return lista;
}
