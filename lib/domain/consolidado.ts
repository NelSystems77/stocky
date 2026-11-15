import type { FilaReporte } from '@/lib/pdf/tipos';
import { aUnidadesBase, TABLA_UD_INICIAL, type TablaUD } from './unidades';

/** Producto con todas las cantidades en unidades base (la UD solo se conserva para mostrar). */
export interface ProductoConsolidado {
  codigo: string;
  ud: string;
  descripcion: string;
  cuota?: number;
  cuotaMinima?: number;
  existencia?: number;
  consumo?: number;
}

/** Convierte las cantidades leídas (en la UD del reporte) a unidades base. Omite los campos que el reporte no trae. */
export function consolidarFilas(filas: readonly FilaReporte[], tabla: TablaUD = TABLA_UD_INICIAL): ProductoConsolidado[] {
  return filas.map((f) => {
    const p: ProductoConsolidado = { codigo: f.codigo, ud: f.ud, descripcion: f.descripcion };
    if (f.cuota !== undefined) p.cuota = aUnidadesBase(f.cuota, f.ud, tabla);
    if (f.cuotaMinima !== undefined) p.cuotaMinima = aUnidadesBase(f.cuotaMinima, f.ud, tabla);
    if (f.existencia !== undefined) p.existencia = aUnidadesBase(f.existencia, f.ud, tabla);
    if (f.consumo !== undefined) p.consumo = aUnidadesBase(f.consumo, f.ud, tabla);
    return p;
  });
}

/**
 * Separa los códigos que el catálogo aún no conoce. Con el catálogo vacío (primera carga) nada se
 * marca como nuevo: todo el reporte lo siembra.
 */
export function separarNuevos(
  codigos: readonly string[],
  catalogo: ReadonlySet<string>,
): { nuevos: string[]; sembrar: boolean } {
  const faltan = codigos.filter((c) => !catalogo.has(c));
  return { nuevos: catalogo.size === 0 ? [] : faltan, sembrar: catalogo.size === 0 };
}

export type MotivoBloqueo = { motivo: string } | null;

/**
 * Un reporte solo puede guardarse en los datos de la unidad a la que pertenece. Así los reportes de un EBAIS
 * (otro despacho) no se mezclan con el inventario del 771/772. El superadmin queda exento.
 */
export function validarDespacho(
  despachoReporte: { codigo: string | null; nombre: string | null },
  unidadUsuario: string | null,
  esSuperadmin: boolean,
): MotivoBloqueo {
  if (esSuperadmin || despachoReporte.codigo === null || unidadUsuario === null) return null;
  if (despachoReporte.codigo === unidadUsuario) return null;
  const quien = [despachoReporte.codigo, despachoReporte.nombre].filter(Boolean).join(' ');
  return { motivo: `Este reporte es del despacho ${quien}, no del ${unidadUsuario}. No se guarda en tus datos.` };
}
