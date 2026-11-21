import { esCodigoValido, normalizarCodigo } from './codigos';
import type { FechaISO } from './types';
import { aUnidadesBase, deUnidadesBase, normalizarUD, TABLA_UD_INICIAL, type TablaUD } from './unidades';

/** Presentaciones habituales del preconteo; cualquier otro número entero también vale. */
export const PRESENTACIONES_PRECONTEO = [30, 60, 90] as const;

/**
 * Una entrega de producto a las damas voluntarias para precontar.
 * Cantidades en unidades base. `recibida` es `null` mientras no vuelva el producto precontado.
 */
export interface RegistroPreconteo {
  id: string;
  fecha: FechaISO;
  codigo: string;
  /** Lo que se entregó. */
  cantidad: number;
  /** Unidades por bolsa/paquete con que se pide precontar (30, 60, 90 u otra). */
  presentacion: number;
  /** Lo que volvió precontado; `null` = pendiente de recibir. */
  recibida: number | null;
  notas: string;
}

export interface EntradaPreconteo {
  fecha: FechaISO;
  codigo: string;
  /** En la UD del producto (cientos para `CN`), tal como la dice la persona. */
  cantidad: number;
  ud: string;
  presentacion: number;
  notas: string;
}

export interface EntregaValida {
  fecha: FechaISO;
  codigo: string;
  /** Unidades base. */
  cantidad: number;
  presentacion: number;
  notas: string;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

export function validarPreconteo(entrada: EntradaPreconteo, tabla: TablaUD = TABLA_UD_INICIAL): Resultado<EntregaValida> {
  const codigo = normalizarCodigo(entrada.codigo);
  if (!esCodigoValido(codigo)) return { ok: false, error: 'Elige un producto o escribe un código válido (ej. 110-16-0010).' };
  if (!FECHA.test(entrada.fecha)) return { ok: false, error: 'La fecha no es válida.' };
  if (!Number.isFinite(entrada.cantidad) || entrada.cantidad <= 0) return { ok: false, error: 'La cantidad debe ser mayor que 0.' };
  if (!Number.isInteger(entrada.presentacion) || entrada.presentacion <= 0) {
    return { ok: false, error: 'La presentación debe ser un número entero mayor que 0 (ej. 30, 60 o 90).' };
  }
  return {
    ok: true,
    valor: {
      fecha: entrada.fecha,
      codigo,
      cantidad: aUnidadesBase(entrada.cantidad, entrada.ud, tabla),
      presentacion: entrada.presentacion,
      notas: entrada.notas.trim().slice(0, 500),
    },
  };
}

/** Recepción: cuánto volvió precontado, en la UD del producto. Devuelve unidades base. */
export function validarRecepcion(cantidad: number, ud: string, tabla: TablaUD = TABLA_UD_INICIAL): Resultado<number> {
  if (!Number.isFinite(cantidad) || cantidad < 0) return { ok: false, error: 'La cantidad recibida no puede ser negativa.' };
  return { ok: true, valor: aUnidadesBase(cantidad, ud, tabla) };
}

export type EstadoPreconteo = 'pendiente' | 'completo' | 'conDiferencia';

export function estadoPreconteo(r: Pick<RegistroPreconteo, 'cantidad' | 'recibida'>): EstadoPreconteo {
  if (r.recibida === null) return 'pendiente';
  return redondear(r.recibida - r.cantidad) === 0 ? 'completo' : 'conDiferencia';
}

/** Recibido − entregado en unidades base: negativo si falta producto. `null` si aún no se recibe. */
export function diferenciaPreconteo(r: Pick<RegistroPreconteo, 'cantidad' | 'recibida'>): number | null {
  return r.recibida === null ? null : redondear(r.recibida - r.cantidad);
}

/** Más reciente primero; a igual fecha, por código. */
export function ordenarPreconteos(registros: readonly RegistroPreconteo[]): RegistroPreconteo[] {
  return [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.codigo.localeCompare(b.codigo));
}

/** `mes` es `YYYY-MM`. */
export function preconteosDelMes(registros: readonly RegistroPreconteo[], mes: string): RegistroPreconteo[] {
  return registros.filter((r) => r.fecha.startsWith(`${mes}-`));
}

/** Entregas sin recibir, de la más antigua a la más reciente (las que más urge reclamar primero). */
export function preconteosPendientes(registros: readonly RegistroPreconteo[]): RegistroPreconteo[] {
  return registros.filter((r) => r.recibida === null).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.codigo.localeCompare(b.codigo));
}

export interface ResumenEntregasPendientes {
  total: number;
  /** Días calendario que lleva la entrega sin recibir más antigua; `0` si no hay ninguna. */
  masAntiguaDias: number;
}

/** Entregas sin recibir y qué tan vieja es la más antigua (para el chip de Hoy). Nunca negativo. */
export function resumenEntregasPendientes(registros: readonly RegistroPreconteo[], hoy: FechaISO): ResumenEntregasPendientes {
  const pendientes = preconteosPendientes(registros);
  const primera = pendientes[0];
  if (!primera) return { total: 0, masAntiguaDias: 0 };
  const aUTC = (f: FechaISO) => Date.parse(`${f}T00:00:00Z`);
  return { total: pendientes.length, masAntiguaDias: Math.max(0, Math.round((aUTC(hoy) - aUTC(primera.fecha)) / 86_400_000)) };
}

export interface TotalPreconteo {
  codigo: string;
  presentacion: number;
  entregado: number;
  /** Solo lo ya recibido. */
  recibido: number;
  entregas: number;
  pendientes: number;
}

export interface TotalesPreconteo {
  entregas: number;
  pendientes: number;
  conDiferencia: number;
  /** Por producto y presentación (RF-8.3), de mayor a menor entregado. */
  porProducto: TotalPreconteo[];
}

export function totalesPreconteo(registros: readonly RegistroPreconteo[]): TotalesPreconteo {
  const filas = new Map<string, TotalPreconteo>();
  let pendientes = 0;
  let conDiferencia = 0;
  for (const r of registros) {
    const llave = `${r.codigo}|${r.presentacion}`;
    const f = filas.get(llave) ?? { codigo: r.codigo, presentacion: r.presentacion, entregado: 0, recibido: 0, entregas: 0, pendientes: 0 };
    f.entregado = redondear(f.entregado + r.cantidad);
    f.entregas += 1;
    if (r.recibida === null) {
      f.pendientes += 1;
      pendientes += 1;
    } else {
      f.recibido = redondear(f.recibido + r.recibida);
      if (estadoPreconteo(r) === 'conDiferencia') conDiferencia += 1;
    }
    filas.set(llave, f);
  }
  const porProducto = [...filas.values()].sort(
    (a, b) => b.entregado - a.entregado || a.codigo.localeCompare(b.codigo) || a.presentacion - b.presentacion,
  );
  return { entregas: registros.length, pendientes, conDiferencia, porProducto };
}

/**
 * Una entrega ya guardada como la escribió la persona, para editarla: la cantidad vuelve a la UD del producto
 * (`ud` según el último reporte; sin ella queda en unidades sueltas). Es la inversa de `validarPreconteo`.
 */
export function entradaDesdePreconteo(
  r: Pick<RegistroPreconteo, 'fecha' | 'codigo' | 'cantidad' | 'presentacion' | 'notas'>,
  ud: string | undefined,
  tabla: TablaUD = TABLA_UD_INICIAL,
): EntradaPreconteo {
  const unidad = normalizarUD(ud ?? 'UN');
  return { fecha: r.fecha, codigo: r.codigo, cantidad: deUnidadesBase(r.cantidad, unidad, tabla), ud: unidad, presentacion: r.presentacion, notas: r.notas };
}
