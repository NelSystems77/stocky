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
  | { tipo: 'segundoSabado' }
  /** Tercer jueves del mes: carga del reporte de lotes y vencimientos (RF-1.8). Si no es laborable, pasa al siguiente día laborable. */
  | { tipo: 'tercerJueves' }
  /** 15 días después del tercer jueves (o el siguiente día laborable): carga de existencias para ajustar la proyección (RF-2.6). */
  | { tipo: 'tercerJuevesMas15' };

export interface CargaConsumo {
  /** Consumo del período en unidades base. */
  cantidad: number;
  /** Días hábiles del período cubierto por la carga. */
  diasHabiles: number;
}
