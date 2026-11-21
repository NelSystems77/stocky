import { deUnidadesBase, TABLA_UD_INICIAL, type TablaUD } from './unidades';

/**
 * Pedido al ALDI (almacén que abastece al 771): propuesta para reponer las existencias. Todo en **unidades base**
 * salvo `cantidad`, que va en la UD del producto (CN, FC…) y siempre en números enteros.
 *
 * objetivo = cuota × factor × (días ÷ 30)   (la cuota de SIFA es mensual)
 * a pedir  = objetivo − existencia, redondeado hacia arriba a la UD entera; si no es positivo, no se pide.
 */

/** Factores habituales; cualquier número mayor que 0 hasta `FACTOR_MAXIMO` también vale. */
export const FACTORES_ALDI = [1.25, 1.5, 2] as const;
export const FACTOR_MAXIMO = 10;

/** Períodos habituales en días; cualquier entero de 1 a `DIAS_MAXIMOS` también vale. */
export const DIAS_MES = 30;
export const PERIODOS_ALDI = [
  { dias: DIAS_MES, etiqueta: 'Mensual' },
  { dias: 15, etiqueta: '15 días' },
] as const;
export const DIAS_MAXIMOS = 90;

export interface ParametrosAldi {
  factor: number;
  /** Días que cubre el pedido. */
  dias: number;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

export function validarParametrosAldi(p: ParametrosAldi): Resultado<ParametrosAldi> {
  if (!Number.isFinite(p.factor) || p.factor <= 0 || p.factor > FACTOR_MAXIMO) {
    return { ok: false, error: `El factor debe ser mayor que 0 y no pasar de ${FACTOR_MAXIMO} (ej. 1.25, 1.5 o 2).` };
  }
  if (!Number.isInteger(p.dias) || p.dias < 1 || p.dias > DIAS_MAXIMOS) {
    return { ok: false, error: `El período debe ser un número entero de días, de 1 a ${DIAS_MAXIMOS}.` };
  }
  return { ok: true, valor: { factor: Math.round(p.factor * 1e6) / 1e6, dias: p.dias } };
}

/** Texto del período: «mensual», «15 días»… */
export function etiquetaPeriodo(dias: number): string {
  return dias === DIAS_MES ? 'mensual' : `${dias} ${dias === 1 ? 'día' : 'días'}`;
}

export interface ProductoAldi {
  codigo: string;
  descripcion: string;
  ud: string;
  /** Unidades base. */
  cuota?: number;
  existencia?: number;
}

export interface LineaAldi {
  codigo: string;
  descripcion: string;
  ud: string;
  /** Unidades base. */
  cuota: number;
  existencia: number;
  /** Nivel al que se quiere reponer: cuota × factor × días/30 (unidades base). */
  objetivo: number;
  /** Lo que sugiere el cálculo, en la UD del producto (entero). */
  calculada: number;
  /** Lo que se pide, en la UD del producto (entero): lo calculado, o lo que la persona ajustó a mano. */
  cantidad: number;
}

/** Cantidad a pedir en la UD del producto (entero, hacia arriba); `0` si la existencia ya llega al objetivo. */
export function cantidadAPedir(existencia: number, cuota: number, p: ParametrosAldi, ud: string, tabla: TablaUD = TABLA_UD_INICIAL): number {
  const objetivo = (cuota * p.factor * p.dias) / DIAS_MES;
  const falta = objetivo - existencia;
  if (falta <= 0) return 0;
  return Math.ceil(deUnidadesBase(falta, ud, tabla));
}

export interface PedidoCalculado {
  lineas: LineaAldi[];
  /** Productos omitidos porque no tienen cuota (no hay política de stock que reponer). */
  sinCuota: number;
  /** Productos con cuota pero sin existencia en el reporte: no se pide a ciegas. */
  sinExistencia: number;
  /** Productos cuya existencia ya llega al objetivo (no entran). */
  yaCubiertos: number;
}

/** Arma la propuesta de pedido con la existencia de SIFA, ordenada por código. Las líneas en 0 no aparecen. */
export function calcularPedidoAldi(productos: readonly ProductoAldi[], p: ParametrosAldi, tabla: TablaUD = TABLA_UD_INICIAL): PedidoCalculado {
  const r: PedidoCalculado = { lineas: [], sinCuota: 0, sinExistencia: 0, yaCubiertos: 0 };
  for (const x of productos) {
    if (x.cuota === undefined || x.cuota <= 0) {
      r.sinCuota++;
      continue;
    }
    if (x.existencia === undefined) {
      r.sinExistencia++;
      continue;
    }
    const calculada = cantidadAPedir(x.existencia, x.cuota, p, x.ud, tabla);
    if (calculada === 0) {
      r.yaCubiertos++;
      continue;
    }
    r.lineas.push({
      codigo: x.codigo,
      descripcion: x.descripcion,
      ud: x.ud,
      cuota: x.cuota,
      existencia: x.existencia,
      objetivo: Math.round(((x.cuota * p.factor * p.dias) / DIAS_MES) * 1e6) / 1e6,
      calculada,
      cantidad: calculada,
    });
  }
  r.lineas.sort((a, b) => a.codigo.localeCompare(b.codigo));
  return r;
}

/** Cantidad que la persona escribió a mano: entero de 0 en adelante. `null` si no es válida (se ignora). */
export function leerCantidadAjustada(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/** Aplica los ajustes a mano (código → texto) a las líneas calculadas. Una cantidad en 0 saca la línea del pedido. */
export function aplicarAjustes(lineas: readonly LineaAldi[], ajustes: Readonly<Record<string, string>>): LineaAldi[] {
  const salida: LineaAldi[] = [];
  for (const l of lineas) {
    const n = ajustes[l.codigo] === undefined ? null : leerCantidadAjustada(ajustes[l.codigo] ?? '');
    const cantidad = n ?? l.calculada;
    if (cantidad > 0) salida.push({ ...l, cantidad });
  }
  return salida;
}

export interface ResumenAldi {
  productos: number;
  /** Líneas cuya cantidad la persona cambió respecto de lo calculado. */
  ajustadas: number;
}

export function resumenPedidoAldi(lineas: readonly LineaAldi[]): ResumenAldi {
  return { productos: lineas.length, ajustadas: lineas.filter((l) => l.cantidad !== l.calculada).length };
}
