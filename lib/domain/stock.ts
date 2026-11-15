export type EstadoStock = 'agotado' | 'bajo' | 'ok' | 'sinCuota' | 'sinDatos';

interface DatosStock {
  /** Todo en unidades base. */
  cuota?: number;
  cuotaMinima?: number;
  existencia?: number;
}

/**
 * Estado simple por producto (reglas A5 y A6 del PRD):
 * - A6 agotado: cuota > 0 y existencia 0.
 * - A5 bajo: existencia menor que la cuota mínima.
 * Un producto sin cuota ni cuota mínima no tiene política de stock, así que no se alerta.
 */
export function estadoStock({ cuota, cuotaMinima, existencia }: DatosStock): EstadoStock {
  if (existencia === undefined) return 'sinDatos';
  const hayCuota = (cuota ?? 0) > 0;
  const hayMinima = (cuotaMinima ?? 0) > 0;
  if (hayCuota && existencia === 0) return 'agotado';
  if (hayMinima && existencia < (cuotaMinima ?? 0)) return 'bajo';
  return hayCuota || hayMinima ? 'ok' : 'sinCuota';
}
