/** Factor de conversión a unidades base por UD. Tabla editable por el usuario; `CN` = cientos. */
export type TablaUD = Record<string, number>;

export const TABLA_UD_INICIAL: TablaUD = { CN: 100 };

export function normalizarUD(ud: string): string {
  return ud.trim().toUpperCase();
}

/** FC, TR, tubo, ampolla, frasco y cualquier UD desconocida valen 1. */
export function factorUD(ud: string, tabla: TablaUD = TABLA_UD_INICIAL): number {
  const f = tabla[normalizarUD(ud)];
  return f !== undefined && Number.isFinite(f) && f > 0 ? f : 1;
}

/** `1.5 CN` → `150` unidades base. Redondea a 6 decimales para evitar ruido de coma flotante. */
export function aUnidadesBase(cantidad: number, ud: string, tabla: TablaUD = TABLA_UD_INICIAL): number {
  return Math.round(cantidad * factorUD(ud, tabla) * 1e6) / 1e6;
}

/** Inversa de `aUnidadesBase`: unidades base → cantidad en la UD del producto (`20000` → `200 CN`). */
export function deUnidadesBase(cantidadBase: number, ud: string, tabla: TablaUD = TABLA_UD_INICIAL): number {
  return Math.round((cantidadBase / factorUD(ud, tabla)) * 1e6) / 1e6;
}
