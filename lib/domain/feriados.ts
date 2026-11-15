import type { FechaISO } from './types';

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

/** `true` si es una fecha civil real `YYYY-MM-DD` (rechaza `2026-02-30`, `2026-13-01`, etc.). */
export function esFechaValida(valor: unknown): valor is FechaISO {
  if (typeof valor !== 'string' || !FORMATO.test(valor)) return false;
  const [y, m, d] = valor.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Lista limpia de feriados: solo fechas reales, sin repetidas y en orden. Tolera datos sucios de Firestore. */
export function normalizarFeriados(lista: unknown): FechaISO[] {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter(esFechaValida))].sort();
}

/** Agrega un feriado. Devuelve la lista igual si la fecha no es válida o ya estaba. */
export function agregarFeriado(lista: readonly FechaISO[], fecha: string): FechaISO[] {
  return normalizarFeriados(esFechaValida(fecha) ? [...lista, fecha] : lista);
}

export function quitarFeriado(lista: readonly FechaISO[], fecha: FechaISO): FechaISO[] {
  return normalizarFeriados(lista.filter((f) => f !== fecha));
}

/** Agrupa por año (`2026` → fechas) para mostrar la lista ordenada. */
export function feriadosPorAnio(lista: readonly FechaISO[]): { anio: string; fechas: FechaISO[] }[] {
  const grupos = new Map<string, FechaISO[]>();
  for (const f of normalizarFeriados(lista)) {
    const anio = f.slice(0, 4);
    grupos.set(anio, [...(grupos.get(anio) ?? []), f]);
  }
  return [...grupos].map(([anio, fechas]) => ({ anio, fechas }));
}
