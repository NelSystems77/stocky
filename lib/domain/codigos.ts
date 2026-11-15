const PATRON = /^(?:\d-\d{2}-\d{2}-\d{4}|\d{3}-\d{2}-\d{4})$/;

/** Quita espacios y unifica guiones tipográficos. No intenta reinsertar guiones (el formato es ambiguo sin ellos). */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/\s+/g, '').replace(/[‐-―−]/g, '-');
}

/** `X-XX-XX-XXXX` o `XXX-XX-XXXX` (ej. `110-16-0010`). */
export function esCodigoValido(texto: string): boolean {
  return PATRON.test(normalizarCodigo(texto));
}

/** Devuelve el código normalizado o `null` si no cumple el formato. */
export function parsearCodigo(texto: string): string | null {
  const c = normalizarCodigo(texto);
  return PATRON.test(c) ? c : null;
}
