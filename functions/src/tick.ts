import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { hoyCostaRica, sumarDias, ZONA } from './dominio/calendario.js';
import {
  AJUSTES_NOTIFICACIONES_INICIALES,
  franjaDe,
  planificarAvisos,
  type AjustesNotificaciones,
} from './dominio/notificaciones.js';
import type { Cumplimiento, Tarea } from './dominio/tareas.js';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TareaSchema = z.object({
  titulo: z.string(),
  recurrencia: z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('unica'), fecha: Fecha }),
    z.object({ tipo: z.literal('diaria') }),
    z.object({ tipo: z.literal('diasSemana'), dias: z.array(z.number().int().min(0).max(6)) }),
    z.object({ tipo: z.literal('quincenal'), dia: z.number().int().min(0).max(6), ancla: Fecha }),
    z.object({ tipo: z.literal('mensual'), diaMes: z.number().int().min(1).max(31) }),
    z.object({ tipo: z.literal('segundoSabado') }),
  ]),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  prioridad: z.enum(['alta', 'media', 'baja']),
  notas: z.string(),
  activa: z.boolean(),
  desde: Fecha,
});
const CumplimientoSchema = z.object({
  tareaId: z.string(),
  fechaOrigen: Fecha,
  estado: z.enum(['hecha', 'pospuesta', 'descartada']),
  fechaProgramada: Fecha.optional(),
  motivo: z.string().optional(),
});

export interface Envio {
  tokens: string[];
  titulo: string;
  cuerpo: string;
}
/** Envía un aviso y devuelve los tokens que ya no sirven (para borrarlos). */
export type Enviar = (envio: Envio) => Promise<string[]>;

/** Hora `HH:mm` en Costa Rica. */
function horaCostaRica(ahora: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora);
}

const YA_EXISTE = 6; // código gRPC ALREADY_EXISTS

/**
 * Una pasada del programador (cada 5 min): decide y envía los avisos que tocan en esta franja.
 * Cada aviso se reserva con un documento `avisosEnviados/{clave}` creado de forma atómica,
 * así que si la función corre dos veces en la misma franja no hay avisos repetidos.
 */
export async function ejecutarTick(db: Firestore, enviar: Enviar, ahora: Date = new Date()): Promise<{ enviados: number }> {
  const hoy = hoyCostaRica(ahora);
  const franja = franjaDe(horaCostaRica(ahora));
  let enviados = 0;

  const usuarios = await db.collection('usuarios').where('activo', '==', true).get();
  for (const u of usuarios.docs) {
    const datos = u.data();
    const tokens: string[] = Array.isArray(datos['tokensFCM']) ? datos['tokensFCM'].filter((t): t is string => typeof t === 'string') : [];
    if (tokens.length === 0) continue;

    const ajustesGuardados = (datos['ajustes'] ?? {}) as { notificaciones?: Partial<AjustesNotificaciones>; feriados?: unknown };
    const ajustes = { ...AJUSTES_NOTIFICACIONES_INICIALES, ...ajustesGuardados.notificaciones };
    const feriados = Array.isArray(ajustesGuardados.feriados) ? ajustesGuardados.feriados.filter((f): f is string => typeof f === 'string') : [];

    const [snapTareas, snapCumpl] = await Promise.all([
      u.ref.collection('tareas').get(),
      u.ref.collection('cumplimientos').where('fechaOrigen', '>=', sumarDias(hoy, -60)).get(),
    ]);
    const tareas: Tarea[] = [];
    for (const d of snapTareas.docs) {
      const r = TareaSchema.safeParse(d.data());
      if (r.success) tareas.push({ id: d.id, ...r.data } as Tarea);
    }
    const cumplimientos: Cumplimiento[] = [];
    for (const d of snapCumpl.docs) {
      const r = CumplimientoSchema.safeParse(d.data());
      if (r.success) cumplimientos.push(r.data);
    }

    for (const aviso of planificarAvisos({ tareas, cumplimientos, hoy, franja, ajustes, feriados })) {
      const marca = u.ref.collection('avisosEnviados').doc(aviso.clave);
      try {
        await marca.create({ enviadoEn: FieldValue.serverTimestamp() });
      } catch (e) {
        if ((e as { code?: number }).code === YA_EXISTE) continue;
        throw e;
      }
      try {
        const invalidos = await enviar({ tokens, titulo: aviso.titulo, cuerpo: aviso.cuerpo });
        enviados++;
        if (invalidos.length > 0) await u.ref.update({ tokensFCM: FieldValue.arrayRemove(...invalidos) });
      } catch (e) {
        await marca.delete(); // que el próximo intento pueda reenviarlo
        throw e;
      }
    }
  }
  return { enviados };
}
