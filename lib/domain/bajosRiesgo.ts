import { estadoStock } from './stock';
import type { AnalisisRiesgo } from './riesgo';

/** Producto con sus cantidades en unidades base (lo que guarda Firestore). */
export interface ProductoBajosRiesgo {
  codigo: string;
  descripcion: string;
  ud: string;
  cuota?: number;
  cuotaMinima?: number;
  existencia?: number;
}

export type PrioridadBajosRiesgo = 'critico' | 'riesgo' | 'bajo';

export interface FilaBajosRiesgo {
  producto: ProductoBajosRiesgo;
  /** La más urgente de las reglas que cumple: A3 crítico, A4 en riesgo, A5 bajo. */
  prioridad: PrioridadBajosRiesgo;
  /** Cumple A5 (existencia menor que la cuota mínima), aunque su prioridad sea otra. */
  bajoMinima: boolean;
  /** Días hábiles que alcanza la existencia; `null` sin consumo. */
  cobertura: number | null;
  /** Días hábiles hasta el próximo ingreso, desde la fecha de la existencia; `null` si no hay análisis de riesgo. */
  diasAlIngreso: number | null;
}

const ORDEN: Record<PrioridadBajosRiesgo, number> = { critico: 0, riesgo: 1, bajo: 2 };

/**
 * Productos en A3 (crítico), A4 (en riesgo) o A5 (bajo cuota mínima), de lo más urgente a lo menos:
 * crítico y riesgo por los días que alcanzan, y bajo por qué tan lejos está de su mínima. Un producto que cumple
 * varias reglas sale una sola vez, con la más urgente. Los agotados (A6) no entran: tienen su propio reporte.
 * `riesgos` puede venir vacío (sin consumos cargados): entonces solo hay bajos.
 */
export function bajosYRiesgo(productos: readonly ProductoBajosRiesgo[], riesgos: ReadonlyMap<string, AnalisisRiesgo>): FilaBajosRiesgo[] {
  const filas: FilaBajosRiesgo[] = [];
  for (const producto of productos) {
    const stock = estadoStock(producto);
    if (stock === 'agotado') continue;
    const analisis = riesgos.get(producto.codigo);
    const bajoMinima = stock === 'bajo';
    const nivel = analisis?.nivel;
    const prioridad: PrioridadBajosRiesgo | null = nivel === 'critico' ? 'critico' : nivel === 'riesgo' ? 'riesgo' : bajoMinima ? 'bajo' : null;
    if (prioridad === null) continue;
    filas.push({ producto, prioridad, bajoMinima, cobertura: analisis?.cobertura ?? null, diasAlIngreso: analisis?.diasAlIngreso ?? null });
  }
  return filas.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return ORDEN[a.prioridad] - ORDEN[b.prioridad];
    if (a.prioridad === 'bajo') {
      const ra = (a.producto.existencia ?? 0) / (a.producto.cuotaMinima || 1);
      const rb = (b.producto.existencia ?? 0) / (b.producto.cuotaMinima || 1);
      return ra - rb || a.producto.codigo.localeCompare(b.producto.codigo);
    }
    return (a.cobertura ?? Infinity) - (b.cobertura ?? Infinity) || a.producto.codigo.localeCompare(b.producto.codigo);
  });
}

export interface ResumenBajosRiesgo {
  total: number;
  criticos: number;
  enRiesgo: number;
  bajos: number;
  /** Cuántos de todos cumplen además A5 (bajo cuota mínima). */
  tambienBajos: number;
}

export function resumenBajosRiesgo(filas: readonly FilaBajosRiesgo[]): ResumenBajosRiesgo {
  const r: ResumenBajosRiesgo = { total: filas.length, criticos: 0, enRiesgo: 0, bajos: 0, tambienBajos: 0 };
  for (const f of filas) {
    if (f.prioridad === 'critico') r.criticos++;
    else if (f.prioridad === 'riesgo') r.enRiesgo++;
    else r.bajos++;
    if (f.bajoMinima && f.prioridad !== 'bajo') r.tambienBajos++;
  }
  return r;
}
