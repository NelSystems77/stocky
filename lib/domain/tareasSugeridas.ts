import type { Unidad } from '@/lib/auth/AuthProvider';
import type { FechaISO } from './types';
import type { Tarea } from './tareas';

/**
 * Tareas precargadas del PRD (RF-7.2) para el 771. IDs fijos para que sembrarlas dos veces no duplique.
 * Las horas no vienen en el PRD (salvo la carga de reportes, jueves 7:00): quedan sin hora y editables.
 * Para el 772 no se precarga nada: el PRD no define sus tareas.
 */
export function tareasSugeridas(unidad: Unidad | null, hoy: FechaISO): Tarea[] {
  if (unidad !== '771') return [];
  const base = { hora: null, prioridad: 'media', activa: true, desde: hoy } as const;
  return [
    { ...base, id: 'sug-temperatura-am', titulo: 'Temperatura AM', notas: 'Solo check.', recurrencia: { tipo: 'diaria' } },
    { ...base, id: 'sug-temperatura-pm', titulo: 'Temperatura PM', notas: 'Solo check.', recurrencia: { tipo: 'diaria' } },
    {
      ...base,
      id: 'sug-cargar-reportes',
      titulo: 'Cargar reportes (lotes, vencimientos y consumos)',
      notas: '',
      hora: '07:00',
      recurrencia: { tipo: 'diasSemana', dias: [4] },
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
