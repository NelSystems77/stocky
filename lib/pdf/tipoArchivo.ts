import { esReporteLotes } from './lotes';
import { detectarTipoReporte } from './parser';
import type { TipoReporte } from './tipos';

/** Los reportes de SIFA que Stocky sabe leer. */
export type TipoArchivo = TipoReporte | 'lotesVencimientos';

export const TIPOS_ARCHIVO: readonly TipoArchivo[] = ['existenciasDespacho', 'productosEnDespacho', 'lotesVencimientos'];

export const ETIQUETA_ARCHIVO: Record<TipoArchivo, string> = {
  existenciasDespacho: 'Existencias de despacho',
  productosEnDespacho: 'Productos en despacho (consumos)',
  lotesVencimientos: 'Lotes y vencimientos',
};

/** Lo que la persona elige en Importar: un tipo concreto o que Stocky lo detecte por el encabezado del PDF. */
export type EleccionArchivo = TipoArchivo | 'auto';

/** Tipo de reporte según el encabezado del PDF; `null` si no se reconoce. */
export function detectarTipoArchivo(lineas: readonly string[]): TipoArchivo | null {
  if (esReporteLotes(lineas)) return 'lotesVencimientos';
  return detectarTipoReporte(lineas.join('\n'));
}

export type ResolucionArchivo = { ok: true; tipo: TipoArchivo } | { ok: false; error: string };

/**
 * Decide con qué lector se procesa el archivo. En automático manda lo detectado; si la persona eligió un tipo, el PDF
 * tiene que ser de ese tipo (así no se guarda un reporte como si fuera otro). Un PDF no reconocido nunca pasa.
 */
export function resolverTipoArchivo(eleccion: EleccionArchivo, detectado: TipoArchivo | null): ResolucionArchivo {
  if (detectado === null) {
    return {
      ok: false,
      error: 'No reconozco este reporte. Sube el PDF de existencias de despacho, de productos en despacho o de lotes y vencimientos.',
    };
  }
  if (eleccion !== 'auto' && eleccion !== detectado) {
    return {
      ok: false,
      error: `Elegiste «${ETIQUETA_ARCHIVO[eleccion]}», pero este PDF es de «${ETIQUETA_ARCHIVO[detectado]}». No se guardó nada: elige el tipo correcto o déjalo en «Detectar solo».`,
    };
  }
  return { ok: true, tipo: detectado };
}
