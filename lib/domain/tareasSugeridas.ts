import type { Unidad } from '@/lib/auth/AuthProvider';
import type { FechaISO } from './types';
import type { Tarea } from './tareas';

export const ID_CARGAR_LOTES = 'sug-cargar-reportes';
export const ID_CARGAR_EXISTENCIAS = 'sug-cargar-existencias-15';

/**
 * Tareas precargadas del PRD (RF-7.2) para el 771. IDs fijos para que sembrarlas dos veces no duplique.
 * Las horas no vienen en el PRD (salvo la carga de reportes, 7:00): quedan sin hora y editables.
 * Para el 772 no se precarga nada: el PRD no define sus tareas.
 *
 * Reportes (RF-1.8): el de existencias con lotes y vencimientos se carga el **tercer jueves del mes**, y **15 días
 * después** (o el siguiente día laborable) el de existencias, que ajusta la proyección por lote (RF-2.6).
 */
export function tareasSugeridas(unidad: Unidad | null, hoy: FechaISO): Tarea[] {
  if (unidad !== '771') return [];
  const base = { hora: null, prioridad: 'media', activa: true, desde: hoy } as const;
  return [
    { ...base, id: 'sug-temperatura-am', titulo: 'Temperatura AM', notas: 'Solo check.', recurrencia: { tipo: 'diaria' } },
    { ...base, id: 'sug-temperatura-pm', titulo: 'Temperatura PM', notas: 'Solo check.', recurrencia: { tipo: 'diaria' } },
    {
      ...base,
      id: ID_CARGAR_LOTES,
      titulo: 'Cargar reporte de lotes y vencimientos',
      notas: 'Existencias con lotes y fechas de vencimiento. Revisa los cambios antes de guardar.',
      hora: '07:00',
      recurrencia: { tipo: 'tercerJueves' },
    },
    {
      ...base,
      id: ID_CARGAR_EXISTENCIAS,
      titulo: 'Cargar reporte de existencias',
      notas: 'Ajusta la proyección de lotes a la existencia real.',
      hora: '07:00',
      recurrencia: { tipo: 'tercerJuevesMas15' },
    },
    { ...base, id: 'sug-preconteo', titulo: 'Preconteo', notas: '', recurrencia: { tipo: 'diasSemana', dias: [1, 3, 4, 5] } },
    {
      ...base,
      id: 'sug-revisar-traslados',
      titulo: 'Revisar traslados pendientes',
      notas: 'Los martes: recolección de encomiendas.',
      recurrencia: { tipo: 'diaria' },
    },
  ];
}

/** La tarea semanal de «jueves» con que se sembró antes (todos los jueves a las 7:00). */
const SEMANAL_ANTERIOR = {
  titulo: 'Cargar reportes (lotes, vencimientos y consumos)',
  hora: '07:00',
  recurrencia: { tipo: 'diasSemana', dias: [4] },
} as const;

/**
 * Pasa a quien ya tenía las tareas sembradas al calendario de reportes del PRD (RF-1.8) sin pisar lo que editó:
 * - la tarea semanal de jueves, **solo si sigue tal cual se sembró**, cambia a «tercer jueves» (conserva su pausa);
 * - la de «15 días después» se agrega si falta (y solo si la persona ya tenía la de lotes).
 * Devuelve lo que hay que guardar; vacío si no hay nada que migrar.
 */
export function migrarTareasSugeridas(existentes: readonly Tarea[], unidad: Unidad | null, hoy: FechaISO): Tarea[] {
  if (unidad !== '771') return [];
  const vieja = existentes.find((t) => t.id === ID_CARGAR_LOTES);
  if (!vieja) return [];
  const aGuardar: Tarea[] = [];
  const sinTocar =
    vieja.titulo === SEMANAL_ANTERIOR.titulo &&
    vieja.hora === SEMANAL_ANTERIOR.hora &&
    JSON.stringify(vieja.recurrencia) === JSON.stringify(SEMANAL_ANTERIOR.recurrencia);
  if (sinTocar) {
    const nueva = tareasSugeridas(unidad, hoy).find((t) => t.id === ID_CARGAR_LOTES);
    if (nueva) aGuardar.push({ ...nueva, activa: vieja.activa, desde: vieja.desde });
    if (!existentes.some((t) => t.id === ID_CARGAR_EXISTENCIAS)) {
      const quince = tareasSugeridas(unidad, hoy).find((t) => t.id === ID_CARGAR_EXISTENCIAS);
      if (quince) aGuardar.push({ ...quince, activa: vieja.activa });
    }
  }
  return aGuardar;
}
