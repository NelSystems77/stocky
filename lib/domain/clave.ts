/** Sin caracteres que se confundan al leerlos o dictarlos (0/O, 1/l/I). */
const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz';
const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITOS = '23456789';
const GRUPOS = [MINUSCULAS, MAYUSCULAS, DIGITOS] as const;

/** Devuelve un entero uniforme en [0, max). Inyectable para poder probar. */
export type Aleatorio = (max: number) => number;

export const aleatorioSeguro: Aleatorio = (max) => {
  // Rechazo de sesgo: se descartan valores que repartirían desigual el módulo.
  const limite = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while ((buf[0] ?? 0) >= limite);
  return (buf[0] ?? 0) % max;
};

/**
 * Contraseña inicial legible: al menos una minúscula, una mayúscula y un dígito, sin caracteres ambiguos.
 * Por defecto 12 caracteres (la Function exige mínimo 8).
 */
export function generarClave(longitud = 12, aleatorio: Aleatorio = aleatorioSeguro): string {
  const largo = Math.max(longitud, GRUPOS.length);
  const todos = GRUPOS.join('');
  const chars = GRUPOS.map((g) => g[aleatorio(g.length)] ?? '');
  while (chars.length < largo) chars.push(todos[aleatorio(todos.length)] ?? '');
  // Fisher-Yates para no dejar los tres obligatorios siempre al inicio.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [chars[i], chars[j]] = [chars[j] ?? '', chars[i] ?? ''];
  }
  return chars.join('');
}
