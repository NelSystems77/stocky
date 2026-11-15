import { sumarDias } from './calendario';
import { ocurreEn } from './recurrencia';
import type { FechaISO, Recurrencia } from './types';

export const PRIORIDADES = ['alta', 'media', 'baja'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

/** Plantilla de tarea (única o recurrente). Lo hecho/pospuesto/descartado vive en `Cumplimiento`. */
export interface Tarea {
  id: string;
  titulo: string;
  recurrencia: Recurrencia;
  /** `HH:mm` o `null` si no tiene hora. */
  hora: string | null;
  prioridad: Prioridad;
  notas: string;
  /** Pausada = `false`: no genera ocurrencias ni avisos. */
  activa: boolean;
  /** Primera fecha en que puede ocurrir (las recurrentes no generan pendientes anteriores a su creación). */
  desde: FechaISO;
}

export type EstadoCumplimiento = 'hecha' | 'pospuesta' | 'descartada';

/** Lo que se hizo con UNA ocurrencia (identificada por tarea + fecha de origen). */
export interface Cumplimiento {
  tareaId: string;
  fechaOrigen: FechaISO;
  estado: EstadoCumplimiento;
  /** Nueva fecha cuando está pospuesta (y se conserva si luego se marca hecha). */
  fechaProgramada?: FechaISO;
  motivo?: string;
}

export type EstadoOcurrencia = 'pendiente' | EstadoCumplimiento;

export interface Ocurrencia {
  tareaId: string;
  fechaOrigen: FechaISO;
  /** Fecha en que toca hacerla: la origen o, si se pospuso, la nueva. */
  fechaVence: FechaISO;
  estado: EstadoOcurrencia;
  titulo: string;
  hora: string | null;
  prioridad: Prioridad;
  notas: string;
}

/** Cuántos días hacia atrás se buscan pendientes sin hacer. Más viejo que esto deja de mostrarse. */
export const VENTANA_ATRAS = 30;

export const idCumplimiento = (tareaId: string, fechaOrigen: FechaISO): string => `${tareaId}_${fechaOrigen}`;

const RANGO_PRIORIDAD: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

export const estaAbierta = (o: Pick<Ocurrencia, 'estado'>): boolean => o.estado === 'pendiente' || o.estado === 'pospuesta';

function origenes(t: Tarea, desde: FechaISO, hasta: FechaISO, feriados: readonly FechaISO[]): FechaISO[] {
  if (t.recurrencia.tipo === 'unica') {
    const f = t.recurrencia.fecha;
    return f >= desde && f <= hasta ? [f] : [];
  }
  const inicio = t.desde > desde ? t.desde : desde;
  const fechas: FechaISO[] = [];
  for (let f = inicio; f <= hasta; f = sumarDias(f, 1)) {
    if (ocurreEn(t.recurrencia, f, feriados)) fechas.push(f);
  }
  return fechas;
}

/**
 * Todas las ocurrencias cuya fecha de vencimiento cae en [desde, hasta], con su estado.
 * Una ocurrencia pospuesta aparece en la fecha nueva, no en la original.
 * Orden: fecha, hora (sin hora al final), prioridad y título.
 */
export function ocurrencias(
  tareas: readonly Tarea[],
  cumplimientos: readonly Cumplimiento[],
  desde: FechaISO,
  hasta: FechaISO,
  feriados: readonly FechaISO[] = [],
): Ocurrencia[] {
  const registro = new Map(cumplimientos.map((c) => [idCumplimiento(c.tareaId, c.fechaOrigen), c]));
  const lista: Ocurrencia[] = [];

  for (const t of tareas) {
    if (!t.activa) continue;
    // Se mira más atrás de `desde` para encontrar ocurrencias pospuestas hacia el rango.
    for (const origen of origenes(t, sumarDias(desde, -VENTANA_ATRAS), hasta, feriados)) {
      const c = registro.get(idCumplimiento(t.id, origen));
      const fechaVence = c?.fechaProgramada ?? origen;
      if (fechaVence < desde || fechaVence > hasta) continue;
      lista.push({
        tareaId: t.id,
        fechaOrigen: origen,
        fechaVence,
        estado: c?.estado ?? 'pendiente',
        titulo: t.titulo,
        hora: t.hora,
        prioridad: t.prioridad,
        notas: t.notas,
      });
    }
  }

  return lista.toSorted(
    (a, b) =>
      a.fechaVence.localeCompare(b.fechaVence) ||
      (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') ||
      RANGO_PRIORIDAD[a.prioridad] - RANGO_PRIORIDAD[b.prioridad] ||
      a.titulo.localeCompare(b.titulo),
  );
}

export interface VistaHoy {
  /** Para hoy y aún sin cerrar. */
  hoy: Ocurrencia[];
  /** Vencidas y sin cerrar («pendientes de días anteriores»). */
  atrasadas: Ocurrencia[];
  hechasHoy: Ocurrencia[];
}

export function vistaHoy(
  tareas: readonly Tarea[],
  cumplimientos: readonly Cumplimiento[],
  hoy: FechaISO,
  feriados: readonly FechaISO[] = [],
): VistaHoy {
  const todas = ocurrencias(tareas, cumplimientos, sumarDias(hoy, -VENTANA_ATRAS), hoy, feriados);
  return {
    hoy: todas.filter((o) => o.fechaVence === hoy && estaAbierta(o)),
    atrasadas: todas.filter((o) => o.fechaVence < hoy && estaAbierta(o)),
    hechasHoy: todas.filter((o) => o.fechaVence === hoy && o.estado === 'hecha'),
  };
}
