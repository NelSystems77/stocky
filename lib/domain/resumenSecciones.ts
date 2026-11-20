/**
 * Secciones del resumen mensual de labores (PRD §7, RF-7.6). El usuario elige cuáles incluir.
 * «Envíos a puestos» y «Pedidos tramitados» dependen de los módulos `envios` y `pedidos`:
 * el 771 los ve siempre; el 772 solo si el 771 se los habilita.
 */
export const SECCIONES_RESUMEN = ['tareas', 'preconteo', 'traslados', 'danados', 'vencidos', 'agotados', 'envios', 'pedidos'] as const;
export type SeccionResumen = (typeof SECCIONES_RESUMEN)[number];

export const ETIQUETA_SECCION: Record<SeccionResumen, string> = {
  tareas: 'Tareas',
  preconteo: 'Preconteo',
  traslados: 'Traslados',
  danados: 'Dañados',
  vencidos: 'Vencidos',
  agotados: 'Agotados',
  envios: 'Envíos a puestos',
  pedidos: 'Pedidos tramitados',
};

/** Módulo (de `modulosHabilitados`) que debe tener el usuario para ver cada sección; `null` = siempre. */
export const MODULO_DE_SECCION: Record<SeccionResumen, string | null> = {
  tareas: null,
  preconteo: 'preconteo',
  traslados: 'traslados',
  danados: 'danados',
  vencidos: null,
  agotados: null,
  envios: 'envios',
  pedidos: 'pedidos',
};

/**
 * Lee la selección guardada. Sin dato (primera vez) o con un valor que no es una lista: todas marcadas.
 * Descarta secciones desconocidas y repetidas, y las deja en el orden del resumen.
 * Una lista vacía válida se respeta (la persona desmarcó todo): el resumen no se puede generar.
 */
export function normalizarSeleccion(valor: unknown): SeccionResumen[] {
  if (!Array.isArray(valor)) return [...SECCIONES_RESUMEN];
  const pedidas = new Set(valor);
  return SECCIONES_RESUMEN.filter((s) => pedidas.has(s));
}

/** Secciones disponibles para el usuario según sus módulos. El 771 y el superadmin ven todas. */
export function seccionesDisponibles(modulos: readonly string[] | 'todos'): SeccionResumen[] {
  if (modulos === 'todos') return [...SECCIONES_RESUMEN];
  return SECCIONES_RESUMEN.filter((s) => {
    const m = MODULO_DE_SECCION[s];
    return m === null || modulos.includes(m);
  });
}

/** Selección efectiva: lo elegido, restringido a lo disponible y en el orden del resumen. */
export function seleccionEfectiva(elegidas: readonly SeccionResumen[], disponibles: readonly SeccionResumen[]): SeccionResumen[] {
  return SECCIONES_RESUMEN.filter((s) => elegidas.includes(s) && disponibles.includes(s));
}
