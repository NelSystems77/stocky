import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { hoyCostaRica } from './dominio/calendario.js';
import { ultimaCargaLotes, type LoteGuardado } from './dominio/lotes.js';
import { analizarRiesgo, type ConsumoImportado } from './dominio/riesgo.js';
import {
  evaluarVencimientos,
  ingresosSinSumar,
  type EvaluacionVencimientos,
  type ExistenciaReal,
  type UmbralesVencimiento,
} from './dominio/vencimientos.js';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const LoteDoc = z.object({
  codigo: z.string(),
  ud: z.string(),
  descripcion: z.string(),
  lote: z.string(),
  vence: Fecha,
  cantidad: z.number().finite(),
  valor: z.number().finite(),
  estado: z.enum(['activo', 'gestionado', 'vencido', 'agotado']),
  cantidadIngresada: z.number().finite(),
  fechaIngreso: Fecha,
  ultimaVez: Fecha,
  gestion: z.object({ motivo: z.string(), fecha: Fecha }).optional(),
});

const ExistenciaDoc = z.object({ codigo: z.string(), existencia: z.number().finite().optional(), actualizadoEn: z.instanceof(Timestamp) });

/** Consumos de las últimas 4 cargas de «Productos en despacho», por código (igual que el cliente). */
export async function consumosRecientes(db: Firestore, uid: string): Promise<Map<string, ConsumoImportado[]>> {
  const base = db.doc(`usuarios/${uid}`);
  const imp = await base.collection('importaciones').orderBy('fechaReporte', 'desc').limit(16).get();
  const ids = imp.docs.filter((d) => d.get('tipoReporte') === 'productosEnDespacho').slice(0, 4).map((d) => d.id);
  const mapa = new Map<string, ConsumoImportado[]>();
  if (ids.length === 0) return mapa;
  const snap = await base.collection('consumos').where('importacionId', 'in', ids).get();
  for (const d of snap.docs) {
    const r = z.object({ codigo: z.string(), periodo: Fecha, cantidad: z.number().finite() }).safeParse(d.data());
    if (r.success) mapa.set(r.data.codigo, [...(mapa.get(r.data.codigo) ?? []), { periodo: r.data.periodo, cantidad: r.data.cantidad }]);
  }
  return mapa;
}

export interface CuentaVencimientos extends EvaluacionVencimientos {
  ultimaCarga: string | null;
  ingresosSinSumar: string[];
}

/**
 * Lotes de una cuenta con su proyección y alertas A1/A2, con el mismo código que usa la pantalla
 * (`evaluarVencimientos`). `null` si la cuenta no tiene lotes cargados.
 */
export async function evaluarCuenta(
  db: Firestore,
  uid: string,
  p: { hoy: string; feriados: readonly string[]; margen: number; umbrales: UmbralesVencimiento },
): Promise<CuentaVencimientos | null> {
  const base = db.doc(`usuarios/${uid}`);
  const [snapLotes, snapExist, consumosPorCodigo] = await Promise.all([base.collection('lotes').get(), base.collection('existencias').get(), consumosRecientes(db, uid)]);

  const lotes: LoteGuardado[] = [];
  for (const d of snapLotes.docs) {
    const r = LoteDoc.safeParse(d.data());
    if (r.success) lotes.push({ id: d.id, ...r.data });
  }
  if (lotes.length === 0) return null;

  const consumos = new Map<string, number | null>();
  const existencias = new Map<string, ExistenciaReal>();
  for (const d of snapExist.docs) {
    const r = ExistenciaDoc.safeParse(d.data());
    if (!r.success || r.data.existencia === undefined) continue;
    const fecha = hoyCostaRica(r.data.actualizadoEn.toDate());
    existencias.set(r.data.codigo, { existencia: r.data.existencia, fecha });
    consumos.set(
      r.data.codigo,
      analizarRiesgo({ existencia: r.data.existencia, consumos: consumosPorCodigo.get(r.data.codigo) ?? [], fechaExistencia: fecha, feriados: p.feriados, margen: p.margen }).consumoDiario,
    );
  }

  const evaluacion = evaluarVencimientos({ lotes, consumos, existencias, hoy: p.hoy, feriados: p.feriados, umbrales: p.umbrales });
  const ultimaCarga = ultimaCargaLotes(lotes);
  return { ...evaluacion, ultimaCarga, ingresosSinSumar: ingresosSinSumar(ultimaCarga, p.hoy) };
}
