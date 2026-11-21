import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type { RegistroAgotado } from './dominio/agotados.js';
import { hoyCostaRica, sumarDias } from './dominio/calendario.js';
import {
  armarContexto,
  construirPeticionGemini,
  consultarGemini,
  LIMITE_DIARIO_CHANGO,
  limitarHistorial,
  limpiarPregunta,
  MENSAJE_LIMITE_USUARIO,
  MENSAJE_SIN_CUOTA,
  type DatosChango,
  type LoteChango,
  type Fetcher,
  type ProductoChango,
  type TurnoChango,
} from './dominio/chango.js';
import type { RegistroDanado } from './dominio/danados.js';
import { normalizarFeriados } from './dominio/feriados.js';
import { normalizarUmbralesVencimiento } from './dominio/vencimientos.js';
import type { RegistroPreconteo } from './dominio/preconteo.js';
import { analizarRiesgo, normalizarMargen, type ConsumoImportado } from './dominio/riesgo.js';
import { vistaHoy, type Cumplimiento, type Tarea } from './dominio/tareas.js';
import type { RegistroTraslado } from './dominio/traslados.js';
import type { RegistroVencido } from './dominio/vencidos.js';
import { CumplimientoSchema, TareaSchema } from './tick.js';
import { consumosRecientes, evaluarCuenta } from './vencimientos.js';

export const PeticionChango = z.object({
  pregunta: z.string().min(1).max(4000),
  historial: z
    .array(z.object({ rol: z.enum(['usuario', 'chango']), texto: z.string().max(4000) }))
    .max(30)
    .optional(),
});

export type RespuestaChango =
  | { estado: 'ok'; respuesta: string; modelo: string; fechaDatos: string | null }
  | { estado: 'sin-cuota' | 'limite' | 'error'; respuesta: string };

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ProductoDoc = z.object({
  codigo: z.string(),
  ud: z.string(),
  descripcion: z.string(),
  cuota: z.number().finite().optional(),
  cuotaMinima: z.number().finite().optional(),
  existencia: z.number().finite().optional(),
  actualizadoEn: z.instanceof(Timestamp),
});
const AgotadoDoc = z.object({ codigo: z.string(), fechaAgotado: Fecha, fechaIngreso: Fecha.nullable(), origen: z.enum(['detectado', 'manual']), notas: z.string() });
const DanadoDoc = z.object({
  fecha: Fecha,
  codigo: z.string(),
  lote: z.string(),
  cantidad: z.number().finite().positive(),
  motivo: z.enum(['quebrado', 'derramado', 'otro']),
  notas: z.string(),
  fotoRuta: z.string().nullable(),
});
const PreconteoDoc = z.object({ fecha: Fecha, codigo: z.string(), cantidad: z.number().finite().positive(), presentacion: z.number().int().positive(), recibida: z.number().finite().nonnegative().nullable(), notas: z.string() });
const TrasladoDoc = z.object({
  fecha: Fecha,
  ordenSAP: z.string(),
  tipo: z.enum(['envio', 'recepcion']),
  unidad: z.string(),
  items: z.array(z.object({ codigo: z.string(), cantidad: z.number().finite().positive() })),
  estado: z.enum(['pendiente', 'recibido', 'enviado']),
  fechaCierre: Fecha.nullable(),
  enSAP: z.boolean(),
  enSIFA: z.boolean(),
  notas: z.string(),
});
const VencidoDoc = z.object({ fecha: Fecha, codigo: z.string(), lote: z.string(), fechaVencimiento: Fecha, cantidad: z.number().finite().positive(), origen: z.enum(['manual', 'reporte']), notas: z.string() });

function leer<T extends z.ZodType>(docs: { id: string; data: () => DocumentData }[], esquema: T): (z.infer<T> & { id: string })[] {
  const lista: (z.infer<T> & { id: string })[] = [];
  for (const d of docs) {
    const r = esquema.safeParse(d.data());
    if (r.success) lista.push({ id: d.id, ...(r.data as object) } as z.infer<T> & { id: string });
  }
  return lista;
}

/**
 * Arma lo que Chango puede saber. Lee SOLO las colecciones de `uid` (quien pregunta) y solo de los módulos
 * que su cuenta tiene habilitados. Nunca datos de pacientes: Stocky no los guarda.
 */
export async function cargarDatos(db: Firestore, uid: string, unidad: string, modulos: ReadonlySet<string>, hoy: string): Promise<DatosChango> {
  const base = db.doc(`usuarios/${uid}`);
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const puede = (m: string) => unidad === '771' || modulos.has(m);

  const [userDoc, snapExist, snapAgot, snapTareas, snapCumpl, consumos] = await Promise.all([
    base.get(),
    base.collection('existencias').get(),
    base.collection('agotados').get(),
    base.collection('tareas').get(),
    base.collection('cumplimientos').where('fechaOrigen', '>=', sumarDias(hoy, -60)).get(),
    consumosRecientes(db, uid),
  ]);
  const ajustes = (userDoc.get('ajustes') ?? {}) as { feriados?: unknown; umbrales?: { margenRiesgo?: unknown; vencimiento?: unknown } };
  const feriados = normalizarFeriados(ajustes.feriados);
  const margen = normalizarMargen(ajustes.umbrales?.margenRiesgo);
  const umbrales = normalizarUmbralesVencimiento(ajustes.umbrales?.vencimiento);

  const productos: ProductoChango[] = [];
  for (const d of snapExist.docs) {
    const r = ProductoDoc.safeParse(d.data());
    if (!r.success) continue;
    const { actualizadoEn, ...p } = r.data;
    const fechaReporte = hoyCostaRica(actualizadoEn.toDate());
    productos.push({
      ...p,
      fechaReporte,
      ...(p.existencia === undefined ? {} : { riesgo: riesgoDe(p.existencia, consumos.get(p.codigo) ?? [], fechaReporte, feriados, margen) }),
    });
  }

  const tareas = leer(snapTareas.docs, TareaSchema) as unknown as Tarea[];
  const cumplimientos = leer(snapCumpl.docs, CumplimientoSchema) as unknown as Cumplimiento[];
  const vista = vistaHoy(tareas, cumplimientos, hoy, feriados);

  // Lotes y vencimientos: mismo cálculo que la pantalla (proyección + A1/A2).
  const cuenta = await evaluarCuenta(db, uid, { hoy, feriados, margen, umbrales });
  const lotesChango: LoteChango[] = (cuenta?.alertas ?? []).map((a) => ({
    codigo: a.lote.codigo,
    descripcion: a.lote.descripcion,
    ud: a.lote.ud,
    lote: a.lote.lote,
    vence: a.lote.vence,
    cantidad: a.lote.cantidad,
    proyectado: a.lote.proyectado,
    dias: a.diasParaVencer,
    nivel: a.nivel,
    ...(a.a1 ? { excedente: a.a1.excedente } : {}),
  }));

  const vacio = { docs: [] as { id: string; data: () => DocumentData }[] };
  const [snapTras, snapPre, snapDan, snapVen] = await Promise.all([
    puede('traslados') ? base.collection('traslados').orderBy('fecha', 'desc').limit(200).get() : vacio,
    puede('preconteo') ? base.collection('preconteos').orderBy('fecha', 'desc').limit(200).get() : vacio,
    puede('danados') ? base.collection('danados').where('fecha', '>=', inicioMes).get() : vacio,
    base.collection('vencidos').where('fecha', '>=', inicioMes).get(),
  ]);

  return {
    hoy,
    unidad,
    productos,
    agotados: leer(snapAgot.docs, AgotadoDoc) as unknown as RegistroAgotado[],
    tareasHoy: vista.hoy.map((o) => ({ titulo: o.titulo, hora: o.hora, fecha: o.fechaVence })),
    tareasAtrasadas: vista.atrasadas.map((o) => ({ titulo: o.titulo, hora: o.hora, fecha: o.fechaVence })),
    traslados: leer(snapTras.docs, TrasladoDoc) as unknown as RegistroTraslado[],
    preconteos: leer(snapPre.docs, PreconteoDoc) as unknown as RegistroPreconteo[],
    danados: leer(snapDan.docs, DanadoDoc) as unknown as RegistroDanado[],
    vencidos: leer(snapVen.docs, VencidoDoc) as unknown as RegistroVencido[],
    ...(cuenta
      ? { vencimientos: { resumen: cuenta.resumen, umbrales, ultimaCarga: cuenta.ultimaCarga, lotes: lotesChango, ingresosSinSumar: cuenta.ingresosSinSumar } }
      : {}),
  };
}

function riesgoDe(existencia: number, consumos: ConsumoImportado[], fechaExistencia: string, feriados: readonly string[], margen: number) {
  const a = analizarRiesgo({ existencia, consumos, fechaExistencia, feriados, margen });
  return { nivel: a.nivel, cobertura: a.cobertura, diasAlIngreso: a.diasAlIngreso };
}

/** Cuenta una pregunta del día; `false` si la persona ya llegó al tope diario (protege la cuota gratuita compartida). */
export async function contarUso(db: Firestore, uid: string, hoy: string): Promise<boolean> {
  const ref = db.doc(`usuarios/${uid}/changoUso/${hoy}`);
  return db.runTransaction(async (t) => {
    const n = ((await t.get(ref)).get('n') as number | undefined) ?? 0;
    if (n >= LIMITE_DIARIO_CHANGO) return false;
    t.set(ref, { n: n + 1, expiraEn: Timestamp.fromMillis(Date.now() + 3 * 86_400_000) });
    return true;
  });
}

export interface Dependencias {
  db: Firestore;
  fetcher: Fetcher;
  clave: string;
  /** Modelos en orden de preferencia; si falta, la cascada por defecto. */
  modelos?: readonly string[];
  ahora?: Date;
}

/** Una pregunta a Chango: cuota diaria → contexto de la persona → Gemini (cascada) → se guarda el intercambio. */
export async function preguntarAChango(
  dep: Dependencias,
  quien: { uid: string; unidad: string; modulos: ReadonlySet<string> },
  entrada: z.infer<typeof PeticionChango>,
): Promise<RespuestaChango> {
  const ahora = dep.ahora ?? new Date();
  const hoy = hoyCostaRica(ahora);
  const pregunta = limpiarPregunta(entrada.pregunta);
  if (pregunta === '') throw new HttpsError('invalid-argument', 'Escribe una pregunta.');

  if (!(await contarUso(dep.db, quien.uid, hoy))) return { estado: 'limite', respuesta: MENSAJE_LIMITE_USUARIO };

  const datos = await cargarDatos(dep.db, quien.uid, quien.unidad, quien.modulos, hoy);
  const historial: TurnoChango[] = limitarHistorial(entrada.historial);
  const r = await consultarGemini(dep.fetcher, dep.clave, construirPeticionGemini(armarContexto(datos, pregunta), historial, pregunta), dep.modelos?.length ? dep.modelos : undefined, (i) =>
    logger.info('chango: intento con Gemini', i),
  );

  if (r.estado === 'sin-cuota') return { estado: 'sin-cuota', respuesta: MENSAJE_SIN_CUOTA };
  if (r.estado === 'error') return { estado: 'error', respuesta: 'Chango no pudo responder ahora. Inténtalo de nuevo en unos minutos.' };

  await dep.db.collection(`usuarios/${quien.uid}/changoIA`).add({
    pregunta,
    respuesta: r.texto,
    modelo: r.modelo,
    fecha: FieldValue.serverTimestamp(),
    expiraEn: Timestamp.fromMillis(ahora.getTime() + 90 * 86_400_000),
  });
  const fechas = datos.productos.map((p) => p.fechaReporte).sort();
  return { estado: 'ok', respuesta: r.texto, modelo: r.modelo, fechaDatos: fechas.at(-1) ?? null };
}
