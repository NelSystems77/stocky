const PATRON_CORTO = /^\d{3}-\d{2}-\d{4}$/;
const PATRON_LARGO = /^(\d)-(\d{2})-(\d{2})-(\d{4})$/;

/**
 * Forma canónica `XXX-XX-XXXX` (ej. `110-16-0010`). SIFA imprime el mismo código de dos maneras:
 * `110-16-0010` (existencias del 771) y `1-10-16-0010` (reportes de despacho). Se unifican quitando
 * el primer guion. No intenta reinsertar guiones a códigos sin ellos (9 dígitos son ambiguos).
 */
export function normalizarCodigo(texto: string): string {
  const limpio = texto.replace(/\s+/g, '').replace(/[‐-―−]/g, '-');
  const largo = PATRON_LARGO.exec(limpio);
  return largo ? `${largo[1]}${largo[2]}-${largo[3]}-${largo[4]}` : limpio;
}

/** `X-XX-XX-XXXX` o `XXX-XX-XXXX`. */
export function esCodigoValido(texto: string): boolean {
  return PATRON_CORTO.test(normalizarCodigo(texto));
}

/** Devuelve el código canónico o `null` si no cumple el formato. */
export function parsearCodigo(texto: string): string | null {
  const c = normalizarCodigo(texto);
  return PATRON_CORTO.test(c) ? c : null;
}
