import { sumarDias } from './calendario';
import type { FechaISO } from './types';

/** Alerta A8 (PRD §6): más de 8 días sin cargar consumos. */
export const DIAS_A8 = 8;

export type EstadoConsumos =
  /** Nunca se cargó el reporte «Productos en despacho». */
  | { tipo: 'sinCarga' }
  | { tipo: 'alDia'; dias: number }
  /** Más de `DIAS_A8` días desde la última carga: alerta A8. */
  | { tipo: 'desactualizado'; dias: number };

/** Días calendario desde la fecha del último reporte de consumos hasta hoy. Nunca negativo. */
export function diasDesde(ultimaCarga: FechaISO, hoy: FechaISO): number {
  const aUTC = (f: FechaISO) => Date.parse(`${f}T00:00:00Z`);
  return Math.max(0, Math.round((aUTC(hoy) - aUTC(ultimaCarga)) / 86_400_000));
}

/**
 * Estado de los consumos según la fecha del reporte «Productos en despacho» más reciente (`null` = nunca se cargó).
 * Exactamente 8 días todavía está al día: la alerta salta con más de 8.
 */
export function estadoConsumos(ultimaCarga: FechaISO | null, hoy: FechaISO): EstadoConsumos {
  if (ultimaCarga === null) return { tipo: 'sinCarga' };
  const dias = diasDesde(ultimaCarga, hoy);
  return dias > DIAS_A8 ? { tipo: 'desactualizado', dias } : { tipo: 'alDia', dias };
}

/** Último día en que la carga todavía está al día. */
export function ultimoDiaAlDia(ultimaCarga: FechaISO): FechaISO {
  return sumarDias(ultimaCarga, DIAS_A8);
}
