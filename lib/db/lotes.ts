import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { z } from 'zod';
import { planGuardadoLotes, type CambiosLotes, type Lote, type LoteGuardado } from '@/lib/domain/lotes';
import type { FechaISO } from '@/lib/domain/types';
import { firestore } from '@/lib/firebase';
import { fechaATimestamp } from './importaciones';
import { registrarEscritura } from './sync';

const LOTE_ESCRITURAS = 400;
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
});

/** Todos los lotes guardados del usuario (también desde la caché sin conexión). Los documentos inválidos se omiten. */
export async function leerLotes(uid: string): Promise<LoteGuardado[]> {
  const snap = await getDocs(collection(firestore(), `usuarios/${uid}/lotes`));
  const lista: LoteGuardado[] = [];
  for (const d of snap.docs) {
    const r = LoteGuardadoSchema.safeParse(d.data());
    if (r.success) lista.push({ id: d.id, ...r.data });
  }
  return lista;
}

export interface DatosCargaLotes {
  uid: string;
  fechaReporte: FechaISO;
  archivo: string;
  lotes: readonly Lote[];
  anteriores: readonly LoteGuardado[];
  cambios: CambiosLotes;
}

/**
 * Guarda una carga de lotes: deja cada lote con su cantidad real, marca como agotado lo que ya no aparece
 * (el historial no se borra) y registra la importación con el resumen de cambios que la persona revisó.
 * Escribe en local de inmediato; NO esperar `confirmada` en la UI.
 */
export function guardarCargaLotes(d: DatosCargaLotes): { id: string; confirmada: Promise<void> } {
  const db = firestore();
  const id = crypto.randomUUID();
  const base = `usuarios/${d.uid}`;
  const { lotes, salidas } = planGuardadoLotes(d.lotes, d.anteriores, d.fechaReporte);

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
        },
        creadoEn: serverTimestamp(),
      }),
    ...lotes.map((l): Op => (b) => b.set(doc(db, `${base}/lotes/${l.id}`), { ...l.datos, importacionId: id }, { merge: true })),
    ...salidas.map((s): Op => (b) => b.set(doc(db, `${base}/lotes/${s.id}`), { ...s.datos, importacionId: id }, { merge: true })),
  ];

  const pendientes: Promise<void>[] = [];
  for (let i = 0; i < ops.length; i += LOTE_ESCRITURAS) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + LOTE_ESCRITURAS)) op(batch);
    pendientes.push(registrarEscritura(batch.commit()));
  }
  return { id, confirmada: Promise.all(pendientes).then(() => undefined) };
}
