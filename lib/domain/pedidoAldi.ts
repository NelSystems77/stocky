import { diasHabilesEntre, sumarDias } from './calendario';
import type { FechaISO } from './types';
import { deUnidadesBase, TABLA_UD_INICIAL, type TablaUD } from './unidades';

/**
 * Pedido al ALDI (almacén que abastece al 771): propuesta para reponer las existencias. Todo en **unidades base**
 * salvo `cantidad`, que va en la UD del producto (CN, FC…) y siempre en números enteros.
 *
 * La **cuota es el tope**: lo máximo que se permite tener en existencia. El pedido repone según el **consumo**:
 *
 *   consumo del período = consumo diario × días hábiles del período
 *   objetivo = el menor entre la cuota y (consumo del período × factor)
 *   a pedir  = objetivo − existencia, redondeado hacia arriba a la UD entera; si no es positivo, no se pide
 *
 * El factor es el margen de seguridad sobre el consumo (1.25, 1.5, 2…). Sin consumo cargado se repone hasta la cuota y
 * se avisa; con consumo en cero no se pide. Una línea «limitada por la cuota» (el consumo × factor pide más de lo
 * permitido) es señal de que la cuota puede estar desactualizada.
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
  /** Días calendario que cubre el pedido. */
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

/** Días hábiles (lunes a viernes y segundo sábado, sin feriados) de los próximos `dias` días, desde mañana. */
export function diasHabilesDelPeriodo(hoy: FechaISO, dias: number, feriados: readonly FechaISO[] = []): number {
  return diasHabilesEntre(sumarDias(hoy, 1), sumarDias(hoy, dias), feriados);
}

export interface ProductoAldi {
  codigo: string;
  descripcion: string;
  ud: string;
  /** Unidades base: el tope permitido. */
  cuota?: number;
  existencia?: number;
  /** Unidades base por día hábil (media móvil de las últimas 4 cargas). `null` o sin dato = sin consumo cargado. */
  consumoDiario?: number | null;
}

/** En qué se basó el objetivo de una línea. */
export type CriterioAldi =
  /** Consumo del período × factor (queda por debajo de la cuota). */
  | 'consumo'
  /** Consumo × factor pasa de la cuota: se pide hasta la cuota (posible cuota desactualizada). */
  | 'limitadaPorCuota'
  /** Sin consumo cargado: se repone hasta la cuota. */
  | 'sinConsumo';

export interface LineaAldi {
  codigo: string;
  descripcion: string;
  ud: string;
  /** Unidades base. */
  cuota: number;
  existencia: number;
  /** Consumo esperado del período (unidades base); `null` sin consumo cargado. Ausente en pedidos de la primera versión. */
  consumo?: number | null;
  /** Nivel al que se quiere reponer (unidades base): lo menor entre la cuota y consumo × factor. */
  objetivo: number;
  /** En qué se basó el objetivo. Ausente en pedidos guardados con la primera versión de la fórmula. */
  criterio?: CriterioAldi;
  /** Lo que sugiere el cálculo, en la UD del producto (entero). */
  calculada: number;
  /** Lo que se pide, en la UD del producto (entero): lo calculado, o lo que la persona ajustó a mano. */
  cantidad: number;
}

const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

/** Cantidad a pedir en la UD del producto (entero, hacia arriba); `0` si la existencia ya llega al objetivo. */
export function cantidadAPedir(existencia: number, objetivo: number, ud: string, tabla: TablaUD = TABLA_UD_INICIAL): number {
  const falta = objetivo - existencia;
  if (falta <= 0) return 0;
  return Math.ceil(deUnidadesBase(falta, ud, tabla));
}

/** Por qué un producto no entró al pedido. */
export type MotivoOmitido = 'sinCuota' | 'sinExistencia' | 'sinMovimiento' | 'yaCubierto';

export const ETIQUETA_OMITIDO: Record<MotivoOmitido, string> = {
  sinCuota: 'Sin cuota',
  sinExistencia: 'Sin existencia en el reporte',
  sinMovimiento: 'Sin movimiento (consumo 0)',
  yaCubierto: 'Ya cubierto',
};

/** Un producto que no entró al pedido, para que la persona pueda comprobar que debe quedar fuera. */
export interface OmitidoAldi {
  codigo: string;
  descripcion: string;
  ud: string;
  motivo: MotivoOmitido;
  /** Unidades base; ausentes si el reporte no las trae. */
  cuota?: number;
  existencia?: number;
}

export interface PedidoCalculado {
  lineas: LineaAldi[];
  /** Todo lo que no entró y por qué (las cuentas de abajo son este mismo detalle, contado). */
  omitidos: OmitidoAldi[];
  /** Productos omitidos porque no tienen cuota (no hay tope ni política que reponer). */
  sinCuota: number;
  /** Productos con cuota pero sin existencia en el reporte: no se pide a ciegas. */
  sinExistencia: number;
  /** Productos con consumo en cero: no se mueven, no se pide. */
  sinMovimiento: number;
  /** Productos cuya existencia ya llega al objetivo (no entran). */
  yaCubiertos: number;
}

/**
 * Arma la propuesta de pedido, ordenada por código. `diasHabiles` son los del período (ver `diasHabilesDelPeriodo`).
 * Las líneas en 0 no aparecen.
 */
export function calcularPedidoAldi(
  productos: readonly ProductoAldi[],
  p: ParametrosAldi & { diasHabiles: number },
  tabla: TablaUD = TABLA_UD_INICIAL,
): PedidoCalculado {
  const r: PedidoCalculado = { lineas: [], omitidos: [], sinCuota: 0, sinExistencia: 0, sinMovimiento: 0, yaCubiertos: 0 };
  const omitir = (x: ProductoAldi, motivo: MotivoOmitido) =>
    r.omitidos.push({ codigo: x.codigo, descripcion: x.descripcion, ud: x.ud, motivo, ...(x.cuota === undefined ? {} : { cuota: x.cuota }), ...(x.existencia === undefined ? {} : { existencia: x.existencia }) });
  for (const x of productos) {
    if (x.cuota === undefined || x.cuota <= 0) {
      r.sinCuota++;
      omitir(x, 'sinCuota');
      continue;
    }
    if (x.existencia === undefined) {
      r.sinExistencia++;
      omitir(x, 'sinExistencia');
      continue;
    }
    const diario = x.consumoDiario ?? null;
    let objetivo: number;
    let consumo: number | null = null;
    let criterio: CriterioAldi;
    if (diario === null) {
      objetivo = x.cuota;
      criterio = 'sinConsumo';
    } else {
      consumo = redondear(diario * p.diasHabiles);
      if (consumo <= 0) {
        r.sinMovimiento++;
        omitir(x, 'sinMovimiento');
        continue;
      }
      const demanda = consumo * p.factor;
      objetivo = Math.min(x.cuota, demanda);
      criterio = demanda > x.cuota ? 'limitadaPorCuota' : 'consumo';
    }
    objetivo = redondear(objetivo);
    const calculada = cantidadAPedir(x.existencia, objetivo, x.ud, tabla);
    if (calculada === 0) {
      r.yaCubiertos++;
      omitir(x, 'yaCubierto');
      continue;
    }
    r.lineas.push({ codigo: x.codigo, descripcion: x.descripcion, ud: x.ud, cuota: x.cuota, existencia: x.existencia, consumo, objetivo, criterio, calculada, cantidad: calculada });
  }
  r.lineas.sort((a, b) => a.codigo.localeCompare(b.codigo));
  r.omitidos.sort((a, b) => a.codigo.localeCompare(b.codigo));
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
  /** Líneas donde el consumo × factor pasa de la cuota (posible cuota desactualizada). */
  limitadasPorCuota: number;
  /** Líneas sin consumo cargado (se repuso hasta la cuota). */
  sinConsumo: number;
}

export function resumenPedidoAldi(lineas: readonly LineaAldi[]): ResumenAldi {
  return {
    productos: lineas.length,
    ajustadas: lineas.filter((l) => l.cantidad !== l.calculada).length,
    limitadasPorCuota: lineas.filter((l) => l.criterio === 'limitadaPorCuota').length,
    sinConsumo: lineas.filter((l) => l.criterio === 'sinConsumo').length,
  };
}
