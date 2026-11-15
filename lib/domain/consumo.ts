import type { CargaConsumo } from './types';

const VENTANA = 4;

/** Consumo diario = consumo del período ÷ días hábiles. `null` si el período no tiene días hábiles. */
export function consumoDiario(cantidad: number, diasHabiles: number): number | null {
  if (!Number.isFinite(cantidad) || !(diasHabiles > 0)) return null;
  return cantidad / diasHabiles;
}

/**
 * Media móvil del consumo diario de las últimas 4 cargas (las cargas vienen de más antigua a más reciente).
 * `null` si ninguna carga es utilizable.
 */
export function consumoDiarioPromedio(cargas: readonly CargaConsumo[]): number | null {
  const diarios = cargas
    .slice(-VENTANA)
    .map((c) => consumoDiario(c.cantidad, c.diasHabiles))
    .filter((v): v is number => v !== null);
  if (diarios.length === 0) return null;
  return diarios.reduce((a, b) => a + b, 0) / diarios.length;
}

/** Cobertura (días hábiles) = existencia en unidades ÷ consumo diario. `null` sin consumo: nunca se divide entre cero. */
export function cobertura(existencia: number, consumoDiarioProm: number | null): number | null {
  if (consumoDiarioProm === null || !(consumoDiarioProm > 0)) return null;
  return existencia / consumoDiarioProm;
}
