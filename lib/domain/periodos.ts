import { inicioSemana } from './calendario';
import type { FechaISO } from './types';

export type TipoPeriodo = 'semana' | 'mes' | 'personalizado';

export interface Periodo {
  desde: FechaISO;
  hasta: FechaISO;
}

/**
 * Período de un reporte. «Semana» y «mes» son los en curso, hasta hoy (la semana empieza el lunes).
 * En «personalizado» las fechas vienen de la persona; si están invertidas se acomodan.
 */
export function rangoPeriodo(tipo: TipoPeriodo, hoy: FechaISO, desde?: FechaISO, hasta?: FechaISO): Periodo | null {
  if (tipo === 'semana') return { desde: inicioSemana(hoy), hasta: hoy };
  if (tipo === 'mes') return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  if (!desde || !hasta) return null;
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
}

/** `true` si el intervalo [inicio, fin] toca el período. `fin` en `null` = sigue abierto. */
export function seSolapa(inicio: FechaISO, fin: FechaISO | null, p: Periodo): boolean {
  return inicio <= p.hasta && (fin === null || fin >= p.desde);
}
