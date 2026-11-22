import { hoyCostaRica } from './calendario';
import type { FechaISO } from './types';

/** Días que Chango conserva el historial (la Function pone `expiraEn` y una política TTL de Firestore lo borra). */
export const DIAS_HISTORIAL_CHANGO = 90;
/** Cuántas consultas recientes se leen para mostrar el historial. */
export const MAX_HISTORIAL_CHANGO = 100;

export interface EntradaHistorial {
  id: string;
  pregunta: string;
  respuesta: string;
  modelo: string;
  fecha: Date;
}

export interface GrupoHistorial {
  /** Día (America/Costa_Rica) de las consultas del grupo. */
  dia: FechaISO;
  entradas: EntradaHistorial[];
}

/** Más reciente primero. No modifica la lista recibida. */
export function ordenarHistorial(entradas: readonly EntradaHistorial[]): EntradaHistorial[] {
  return [...entradas].sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || a.id.localeCompare(b.id));
}

/** Agrupa por día de Costa Rica (no por UTC): una consulta de las 20:00 sigue siendo de ese día. Días y consultas, de la más reciente a la más antigua. */
export function agruparHistorialPorDia(entradas: readonly EntradaHistorial[]): GrupoHistorial[] {
  const grupos: GrupoHistorial[] = [];
  for (const e of ordenarHistorial(entradas)) {
    const dia = hoyCostaRica(e.fecha);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.entradas.push(e);
    else grupos.push({ dia, entradas: [e] });
  }
  return grupos;
}
