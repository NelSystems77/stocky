/** Minúsculas, sin tildes ni guiones/espacios: `110-16-0010` y `110160010` se buscan igual. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[-\s]+/g, '');
}

/** Todas las palabras de la consulta deben aparecer en el código o en la descripción. */
export function coincide(consulta: string, codigo: string, descripcion: string): boolean {
  const palabras = consulta
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/-/g, ''))
    .filter(Boolean);
  if (palabras.length === 0) return true;
  const pajar = normalizarBusqueda(`${codigo}${descripcion}`);
  return palabras.every((p) => pajar.includes(p));
}
