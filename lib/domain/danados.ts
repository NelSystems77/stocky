import { esCodigoValido, normalizarCodigo } from './codigos';
import type { FechaISO } from './types';

export const MOTIVOS_DANADO = ['quebrado', 'derramado', 'otro'] as const;
export type MotivoDanado = (typeof MOTIVOS_DANADO)[number];

export const ETIQUETA_MOTIVO: Record<MotivoDanado, string> = {
  quebrado: 'Quebrado',
  derramado: 'Derramado',
  otro: 'Otro',
};

/** Un dañado registrado. La cantidad va en unidades base. El acta se hace en SIFA (Stocky solo lo recuerda). */
export interface RegistroDanado {
  id: string;
  fecha: FechaISO;
  codigo: string;
  lote: string;
  cantidad: number;
  motivo: MotivoDanado;
  notas: string;
  /** Ruta de la foto en Storage; `null` si no tiene. */
  fotoRuta: string | null;
}

export interface EntradaDanado {
  fecha: FechaISO;
  codigo: string;
  lote: string;
  /** Unidades sueltas, tal como las cuenta la persona. */
  cantidad: number;
  motivo: MotivoDanado;
  notas: string;
}

export type ResultadoDanado = { ok: true; valor: EntradaDanado } | { ok: false; error: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Limpia y valida lo escrito en el formulario. Devuelve el primer error en español. */
export function validarDanado(entrada: EntradaDanado): ResultadoDanado {
  const codigo = normalizarCodigo(entrada.codigo);
  if (!esCodigoValido(codigo)) return { ok: false, error: 'Elige un producto o escribe un código válido (ej. 110-16-0010).' };
  if (!FECHA.test(entrada.fecha)) return { ok: false, error: 'La fecha no es válida.' };
  if (!Number.isFinite(entrada.cantidad) || entrada.cantidad <= 0) return { ok: false, error: 'La cantidad debe ser mayor que 0.' };
  if (!MOTIVOS_DANADO.includes(entrada.motivo)) return { ok: false, error: 'Elige el motivo.' };
  return {
    ok: true,
    valor: {
      fecha: entrada.fecha,
      codigo,
      lote: entrada.lote.trim().slice(0, 40),
      cantidad: Math.round(entrada.cantidad * 1e6) / 1e6,
      motivo: entrada.motivo,
      notas: entrada.notas.trim().slice(0, 500),
    },
  };
}

/** Más reciente primero; a igual fecha, por código para que el orden sea estable. */
export function ordenarDanados(registros: readonly RegistroDanado[]): RegistroDanado[] {
  return [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.codigo.localeCompare(b.codigo));
}

/** `mes` es `YYYY-MM`. */
export function danadosDelMes(registros: readonly RegistroDanado[], mes: string): RegistroDanado[] {
  return registros.filter((r) => r.fecha.startsWith(`${mes}-`));
}

export interface TotalesDanados {
  registros: number;
  /** Unidades base. */
  unidades: number;
  porMotivo: Record<MotivoDanado, number>;
  porProducto: { codigo: string; unidades: number; registros: number }[];
}

/** Totales para el resumen mensual de labores (PRD RF-10.2). Productos de mayor a menor cantidad. */
export function totalesDanados(registros: readonly RegistroDanado[]): TotalesDanados {
  const porMotivo: Record<MotivoDanado, number> = { quebrado: 0, derramado: 0, otro: 0 };
  const productos = new Map<string, { unidades: number; registros: number }>();
  let unidades = 0;
  for (const r of registros) {
    unidades += r.cantidad;
    porMotivo[r.motivo] += r.cantidad;
    const p = productos.get(r.codigo) ?? { unidades: 0, registros: 0 };
    p.unidades += r.cantidad;
    p.registros += 1;
    productos.set(r.codigo, p);
  }
  const porProducto = [...productos.entries()]
    .map(([codigo, p]) => ({ codigo, ...p }))
    .sort((a, b) => b.unidades - a.unidades || a.codigo.localeCompare(b.codigo));
  return { registros: registros.length, unidades: Math.round(unidades * 1e6) / 1e6, porMotivo, porProducto };
}
