import { diasHabilesAlIngreso, diasHabilesEntre } from './calendario';
import { cobertura, consumoDiarioPromedio } from './consumo';
import type { CargaConsumo, FechaISO } from './types';

/** Días de margen sobre el próximo ingreso para considerar un producto «en riesgo» (regla A4). Editable en Ajustes. */
export const MARGEN_RIESGO_INICIAL = 7;

export const MARGEN_RIESGO_MAXIMO = 30;

/** Margen válido: entero de 0 a 30 días; cualquier otra cosa vuelve al valor inicial. */
export function normalizarMargen(valor: unknown): number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= MARGEN_RIESGO_MAXIMO ? valor : MARGEN_RIESGO_INICIAL;
}

export type NivelRiesgo = 'agotado' | 'critico' | 'riesgo' | 'ok' | 'sinConsumo';

export interface ConsumoImportado {
  /** Fecha del reporte que trajo el consumo. */
  periodo: FechaISO;
  /** Consumo del mes en curso hasta `periodo`, en unidades base. */
  cantidad: number;
}

/**
 * Cada carga trae el consumo acumulado del **mes en curso** hasta la fecha del reporte (decisión del 15-nov-2026),
 * así que sus días hábiles van del día 1 del mes hasta esa fecha. Salen de la más antigua a la más reciente.
 */
export function cargasDeConsumo(consumos: readonly ConsumoImportado[], feriados: readonly FechaISO[] = []): CargaConsumo[] {
  return [...consumos]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((c) => ({ cantidad: c.cantidad, diasHabiles: diasHabilesEntre(`${c.periodo.slice(0, 7)}-01`, c.periodo, feriados) }));
}

/**
 * Nivel de riesgo (reglas A3 y A4 del PRD §6), con la cobertura medida en días hábiles:
 * - Crítico (A3): la cobertura no llega al próximo ingreso.
 * - Riesgo (A4): llega al ingreso pero con menos de `margen` días de sobra.
 * Sin consumo no se calcula riesgo (`sinConsumo`); con existencia 0 el estado es «agotado» (regla A6).
 */
export function nivelRiesgo(existencia: number, coberturaDias: number | null, diasAlIngreso: number, margen: number = MARGEN_RIESGO_INICIAL): NivelRiesgo {
  if (existencia <= 0) return 'agotado';
  if (coberturaDias === null) return 'sinConsumo';
  if (coberturaDias < diasAlIngreso) return 'critico';
  if (coberturaDias < diasAlIngreso + margen) return 'riesgo';
  return 'ok';
}

export interface AnalisisRiesgo {
  /** Unidades base por día hábil, media móvil de las últimas 4 cargas. `null` sin consumo. */
  consumoDiario: number | null;
  /** Días hábiles que alcanza la existencia. `null` sin consumo. */
  cobertura: number | null;
  /** Días hábiles desde la fecha de la existencia hasta el próximo ingreso. */
  diasAlIngreso: number;
  nivel: NivelRiesgo;
}

/**
 * Riesgo de un producto medido al día del reporte de existencias (`fechaExistencia`): la cobertura se compara
 * con los días hábiles que faltaban entonces para el segundo sábado, no con los de hoy.
 */
export function analizarRiesgo(p: {
  existencia: number;
  consumos: readonly ConsumoImportado[];
  fechaExistencia: FechaISO;
  feriados?: readonly FechaISO[];
  margen?: number;
}): AnalisisRiesgo {
  const feriados = p.feriados ?? [];
  const consumoDiario = consumoDiarioPromedio(cargasDeConsumo(p.consumos, feriados));
  const cob = cobertura(p.existencia, consumoDiario);
  const diasAlIngreso = diasHabilesAlIngreso(p.fechaExistencia, feriados);
  return { consumoDiario, cobertura: cob, diasAlIngreso, nivel: nivelRiesgo(p.existencia, cob, diasAlIngreso, p.margen) };
}
