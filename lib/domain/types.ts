/** Fecha civil en formato `YYYY-MM-DD` (zona America/Costa_Rica, sin hora). */
export type FechaISO = string;

/** Días de la semana: 0 = domingo … 6 = sábado (igual que `Date#getUTCDay`). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Recurrencia =
  | { tipo: 'unica'; fecha: FechaISO }
  | { tipo: 'diaria' }
  | { tipo: 'diasSemana'; dias: DiaSemana[] }
  | { tipo: 'quincenal'; dia: DiaSemana; ancla: FechaISO }
  | { tipo: 'mensual'; diaMes: number }
  | { tipo: 'segundoSabado' };

export interface CargaConsumo {
  /** Consumo del período en unidades base. */
  cantidad: number;
  /** Días hábiles del período cubierto por la carga. */
  diasHabiles: number;
}
