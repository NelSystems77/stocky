import { esCodigoValido, normalizarCodigo } from './codigos';
import type { FechaISO } from './types';

export type OrigenVencido = 'manual' | 'reporte';

/**
 * Lote que llegó a su vencimiento (RF-2.5). Se llena a mano y, cuando exista el reporte de lotes y
 * vencimientos, también desde él (`origen: 'reporte'`). La meta es cero vencidos: este registro mide cuándo
 * falló la prevención. El acta se hace en SIFA. Cantidad en unidades base.
 */
export interface RegistroVencido {
  id: string;
  /** Fecha en que se constató o se registró. */
  fecha: FechaISO;
  codigo: string;
  lote: string;
  /** Fecha de vencimiento del lote. */
  fechaVencimiento: FechaISO;
  cantidad: number;
  origen: OrigenVencido;
  notas: string;
}

export interface EntradaVencido {
  fecha: FechaISO;
  codigo: string;
  lote: string;
  fechaVencimiento: FechaISO;
  /** Unidades sueltas, tal como las cuenta la persona. */
  cantidad: number;
  notas: string;
}

export type ResultadoVencido = { ok: true; valor: EntradaVencido } | { ok: false; error: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function validarVencido(entrada: EntradaVencido): ResultadoVencido {
  const codigo = normalizarCodigo(entrada.codigo);
  if (!esCodigoValido(codigo)) return { ok: false, error: 'Elige un producto o escribe un código válido (ej. 110-16-0010).' };
  if (!FECHA.test(entrada.fecha)) return { ok: false, error: 'La fecha de registro no es válida.' };
  if (!FECHA.test(entrada.fechaVencimiento)) return { ok: false, error: 'La fecha de vencimiento no es válida.' };
  if (!Number.isFinite(entrada.cantidad) || entrada.cantidad <= 0) return { ok: false, error: 'La cantidad debe ser mayor que 0.' };
  const lote = entrada.lote.trim().slice(0, 40);
  if (lote === '') return { ok: false, error: 'Escribe el número de lote.' };
  return {
    ok: true,
    valor: {
      fecha: entrada.fecha,
      codigo,
      lote,
      fechaVencimiento: entrada.fechaVencimiento,
      cantidad: Math.round(entrada.cantidad * 1e6) / 1e6,
      notas: entrada.notas.trim().slice(0, 500),
    },
  };
}

/** Más reciente primero; a igual fecha, por código. */
export function ordenarVencidos(registros: readonly RegistroVencido[]): RegistroVencido[] {
  return [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.codigo.localeCompare(b.codigo) || a.lote.localeCompare(b.lote));
}

/** `mes` es `YYYY-MM`, por fecha de registro. */
export function vencidosDelMes(registros: readonly RegistroVencido[], mes: string): RegistroVencido[] {
  return registros.filter((r) => r.fecha.startsWith(`${mes}-`));
}

export interface TotalesVencidos {
  registros: number;
  /** Unidades base. */
  unidades: number;
  productos: number;
}

export function totalesVencidos(registros: readonly RegistroVencido[]): TotalesVencidos {
  const unidades = registros.reduce((s, r) => s + r.cantidad, 0);
  return { registros: registros.length, unidades: Math.round(unidades * 1e6) / 1e6, productos: new Set(registros.map((r) => r.codigo)).size };
}
