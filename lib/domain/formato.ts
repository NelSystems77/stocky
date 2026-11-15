import { deUnidadesBase, factorUD, TABLA_UD_INICIAL, type TablaUD } from './unidades';

const nf = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 3 });

export function formatearNumero(n: number): string {
  return nf.format(n);
}

/** Cantidad en unidades base → texto en la UD del producto: `47400` + `CN` → `474 CN`. */
export function formatearEnUD(cantidadBase: number, ud: string, tabla: TablaUD = TABLA_UD_INICIAL): string {
  return `${formatearNumero(deUnidadesBase(cantidadBase, ud, tabla))} ${ud}`;
}

/** `true` si la UD no equivale a 1 unidad (conviene mostrar también las unidades sueltas). */
export function tieneFactor(ud: string, tabla: TablaUD = TABLA_UD_INICIAL): boolean {
  return factorUD(ud, tabla) !== 1;
}
