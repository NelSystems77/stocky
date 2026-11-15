import { estadoStock } from './stock';
import type { FechaISO } from './types';

/** Registro de un agotado. `fechaIngreso` es `null` mientras siga agotado. */
export interface RegistroAgotado {
  id: string;
  codigo: string;
  /** Fecha del reporte en el que se vio con existencia 0. */
  fechaAgotado: FechaISO;
  /** Fecha del primer reporte posterior con existencia > 0. */
  fechaIngreso: FechaISO | null;
  origen: 'detectado' | 'manual';
  notas: string;
}

/** Lo mínimo que se necesita de un producto; las cantidades van en unidades base. */
export interface ProductoStock {
  codigo: string;
  cuota?: number;
  cuotaMinima?: number;
  existencia?: number;
  /** Fecha civil del reporte del que salió la existencia. */
  fechaReporte: FechaISO;
}

export const esAbierto = (r: Pick<RegistroAgotado, 'fechaIngreso'>): boolean => r.fechaIngreso === null;

/** Agotados detectados (regla A6) que todavía no tienen un registro abierto: la persona los confirma con un toque. */
export function proponerAgotados(productos: readonly ProductoStock[], registros: readonly RegistroAgotado[]): ProductoStock[] {
  const abiertos = new Set(registros.filter(esAbierto).map((r) => r.codigo));
  return productos.filter((p) => estadoStock(p) === 'agotado' && !abiertos.has(p.codigo));
}

/**
 * Registros abiertos cuyo producto ya tiene existencia: se cierran con la fecha del reporte donde se vio.
 * Si el producto no está en los reportes (o no trae existencia) el registro sigue abierto.
 */
export function registrosACerrar(
  productos: readonly ProductoStock[],
  registros: readonly RegistroAgotado[],
): { id: string; fechaIngreso: FechaISO }[] {
  const porCodigo = new Map(productos.map((p) => [p.codigo, p]));
  const cierres: { id: string; fechaIngreso: FechaISO }[] = [];
  for (const r of registros) {
    if (!esAbierto(r)) continue;
    const p = porCodigo.get(r.codigo);
    // Un reporte anterior al agotamiento no puede cerrarlo.
    if (p && p.existencia !== undefined && p.existencia > 0 && p.fechaReporte >= r.fechaAgotado) {
      cierres.push({ id: r.id, fechaIngreso: p.fechaReporte });
    }
  }
  return cierres;
}

function aUTC(f: FechaISO): number {
  const [y, m, d] = f.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Días calendario que estuvo (o lleva) agotado: hasta el ingreso, o hasta `hoy` si sigue agotado. Nunca negativo. */
export function diasAgotado(r: Pick<RegistroAgotado, 'fechaAgotado' | 'fechaIngreso'>, hoy: FechaISO): number {
  const fin = r.fechaIngreso ?? hoy;
  return Math.max(0, Math.round((aUTC(fin) - aUTC(r.fechaAgotado)) / 86_400_000));
}

/** Registros activos (más antiguos primero) y cerrados (más recientes primero). */
export function separarRegistros(registros: readonly RegistroAgotado[]): { activos: RegistroAgotado[]; cerrados: RegistroAgotado[] } {
  return {
    activos: registros.filter(esAbierto).sort((a, b) => a.fechaAgotado.localeCompare(b.fechaAgotado) || a.codigo.localeCompare(b.codigo)),
    cerrados: registros
      .filter((r) => !esAbierto(r))
      .sort((a, b) => (b.fechaIngreso ?? '').localeCompare(a.fechaIngreso ?? '') || a.codigo.localeCompare(b.codigo)),
  };
}
