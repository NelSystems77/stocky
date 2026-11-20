import { diasHabilesEntre, sumarDias } from './calendario';
import type { LoteGuardado } from './lotes';
import type { FechaISO } from './types';

/** A2: faltan 90 días o menos → media; 30 o menos → alta (PRD §6). */
export const DIAS_A2_MEDIA = 90;
export const DIAS_A2_ALTA = 30;

/** Menos de esto (unidades base) no cuenta como excedente: evita alertas por redondeo. */
const EXCEDENTE_MINIMO = 0.5;

/** Lote tal como se muestra: `cantidad` es la vigente (proyectada si hubo proyección) y `cantidadReal` la de la última carga. */
export interface LoteVista extends LoteGuardado {
  cantidadReal: number;
  /** `true` si `cantidad` es una proyección (pasó tiempo desde la última carga) y no lo que dijo el reporte. */
  proyectado: boolean;
}

const porVence = (a: { vence: FechaISO; id: string }, b: { vence: FechaISO; id: string }) => a.vence.localeCompare(b.vence) || a.id.localeCompare(b.id);

/** Lotes que cuentan para alertas y proyección: con existencia y sin gestionar. */
const vigente = (l: Pick<LoteGuardado, 'estado' | 'cantidad'>) => (l.estado === 'activo' || l.estado === 'vencido') && l.cantidad > 0;

/** Días hábiles desde mañana hasta `fecha` (inclusive), contados desde `desde`; 0 si `fecha` no es posterior. */
function habilesHasta(desde: FechaISO, fecha: FechaISO, feriados: readonly FechaISO[]): number {
  return fecha <= desde ? 0 : diasHabilesEntre(sumarDias(desde, 1), fecha, feriados);
}

export interface ResultadoFEFO {
  /** Lo que sobra de cada lote al final (unidades base). */
  restante: Map<string, number>;
  /** Cobertura acumulada: días hábiles que alcanzan este lote y los que vencen antes. `null` sin consumo. */
  coberturaAcumulada: Map<string, number | null>;
}

/**
 * Consume el producto en orden de vencimiento (primero lo que vence antes), a `consumoDiario` por día hábil, contando
 * desde `desde` y durante `horizonte` días hábiles (`null` = sin límite). Un lote solo se consume mientras no haya
 * vencido; si vence con existencia, el sobrante queda (es lo que A1 llama excedente).
 */
export function simularFEFO(
  lotes: readonly Pick<LoteGuardado, 'id' | 'cantidad' | 'vence'>[],
  consumoDiario: number | null,
  desde: FechaISO,
  horizonte: number | null,
  feriados: readonly FechaISO[] = [],
): ResultadoFEFO {
  const restante = new Map<string, number>();
  const coberturaAcumulada = new Map<string, number | null>();
  const c = consumoDiario !== null && consumoDiario > 0 ? consumoDiario : null;
  let tcur = 0;
  let acumulado = 0;
  for (const l of [...lotes].sort(porVence)) {
    acumulado += l.cantidad;
    coberturaAcumulada.set(l.id, c === null ? null : acumulado / c);
    if (c === null) {
      restante.set(l.id, l.cantidad);
      continue;
    }
    const limite = Math.min(habilesHasta(desde, l.vence, feriados), horizonte ?? Number.POSITIVE_INFINITY);
    const consumido = Math.min(l.cantidad, Math.max(0, limite - tcur) * c);
    restante.set(l.id, Math.round((l.cantidad - consumido) * 1e6) / 1e6);
    tcur = Math.max(tcur, Math.min(limite, tcur + l.cantidad / c));
  }
  return { restante, coberturaAcumulada };
}

export type NivelVencimiento = 'vencido' | 'alta' | 'media';

export interface AlertaLote {
  lote: LoteVista;
  /** Días de calendario hasta el vencimiento; negativo si ya venció. */
  diasParaVencer: number;
  /** A1: no se consumirá antes de vencer. `excedente` en unidades base. */
  a1: { excedente: number; coberturaDias: number | null; diasHabilesParaVencer: number } | null;
  /** A2: faltan 90 días o menos (alta a 30 o menos). */
  a2: 'media' | 'alta' | null;
  nivel: NivelVencimiento | null;
  /** El producto no tiene consumo: no se pudo evaluar A1. */
  sinConsumo: boolean;
}

const RANGO: Record<NivelVencimiento | 'nada', number> = { vencido: 0, alta: 1, media: 2, nada: 3 };

function diasEntre(a: FechaISO, b: FechaISO): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Alertas de vencimiento de los lotes con existencia (reglas A1 y A2 del PRD §6; los gestionados no alertan):
 * - **Vencido:** la fecha ya llegó y todavía hay existencia (meta: cero).
 * - **A1 (alta):** consumiendo en orden de vencimiento, el lote no se agota antes de vencer. Sin consumo no se evalúa.
 * - **A2:** faltan `diasAlta` días o menos → alta; `diasMedia` o menos → media.
 * Orden: vencidos, altas y medias, y dentro de cada nivel lo que vence antes.
 */
export function analizarVencimientos(p: {
  lotes: readonly LoteVista[];
  /** Consumo diario (unidades base por día hábil) por código; `null` o ausente = sin consumo. */
  consumos: ReadonlyMap<string, number | null>;
  hoy: FechaISO;
  feriados?: readonly FechaISO[];
  diasMedia?: number;
  diasAlta?: number;
}): AlertaLote[] {
  const feriados = p.feriados ?? [];
  const diasMedia = p.diasMedia ?? DIAS_A2_MEDIA;
  const diasAlta = p.diasAlta ?? DIAS_A2_ALTA;

  const porProducto = new Map<string, LoteVista[]>();
  for (const l of p.lotes.filter(vigente)) porProducto.set(l.codigo, [...(porProducto.get(l.codigo) ?? []), l]);

  const alertas: AlertaLote[] = [];
  for (const [codigo, lotes] of porProducto) {
    const consumo = p.consumos.get(codigo) ?? null;
    const sim = simularFEFO(lotes, consumo, p.hoy, null, feriados);
    for (const l of lotes) {
      const dias = diasEntre(p.hoy, l.vence);
      const excedente = sim.restante.get(l.id) ?? 0;
      const a1 = consumo !== null && consumo > 0 && l.vence > p.hoy && excedente > EXCEDENTE_MINIMO
        ? { excedente, coberturaDias: sim.coberturaAcumulada.get(l.id) ?? null, diasHabilesParaVencer: habilesHasta(p.hoy, l.vence, feriados) }
        : null;
      const a2 = dias <= diasAlta ? 'alta' : dias <= diasMedia ? 'media' : null;
      const nivel: NivelVencimiento | null = dias <= 0 ? 'vencido' : a1 || a2 === 'alta' ? 'alta' : a2 === 'media' ? 'media' : null;
      alertas.push({ lote: l, diasParaVencer: dias, a1, a2: dias <= 0 ? null : a2, nivel, sinConsumo: consumo === null || !(consumo > 0) });
    }
  }
  return alertas.toSorted(
    (a, b) =>
      RANGO[a.nivel ?? 'nada'] - RANGO[b.nivel ?? 'nada'] ||
      a.diasParaVencer - b.diasParaVencer ||
      a.lote.codigo.localeCompare(b.lote.codigo) ||
      a.lote.id.localeCompare(b.lote.id),
  );
}

export interface ResumenVencimientos {
  vencidos: number;
  alta: number;
  media: number;
  /** Lotes con A1 (no se consumirán a tiempo). */
  a1: number;
  /** Lotes sin consumo del producto (no se evaluó A1). */
  sinConsumo: number;
}

export function resumirVencimientos(alertas: readonly AlertaLote[]): ResumenVencimientos {
  return {
    vencidos: alertas.filter((a) => a.nivel === 'vencido').length,
    alta: alertas.filter((a) => a.nivel === 'alta').length,
    media: alertas.filter((a) => a.nivel === 'media').length,
    a1: alertas.filter((a) => a.a1 !== null).length,
    sinConsumo: alertas.filter((a) => a.sinConsumo).length,
  };
}

/** Lo que pide atención ya (chip de Hoy): vencidos y de alerta alta. */
export const contarUrgentes = (r: ResumenVencimientos): number => r.vencidos + r.alta;

export interface ExistenciaReal {
  /** Unidades base según el reporte de existencias. */
  existencia: number;
  /** Fecha de ese reporte. */
  fecha: FechaISO;
}

export interface Proyeccion {
  /** Todos los lotes recibidos, con la cantidad vigente. */
  lotes: LoteVista[];
  /** Productos donde la existencia real superó a la proyectada (¿ingreso sin registrar?): no se ajusta, se avisa. */
  excesoReal: Set<string>;
  /** Productos cuya proyección se ajustó a la existencia real, con la diferencia descontada (unidades base). */
  ajustados: Map<string, number>;
}

/**
 * Proyección por lote entre dos cargas (RF-2.6): desde el reporte de lotes, resta el consumo diario promedio
 * consumiendo primero lo que vence antes. Si hay un reporte de existencias **posterior** a la carga, la proyección se
 * ajusta a lo real en esa fecha (la diferencia se descuenta de los lotes que vencen antes) y sigue desde ahí hasta hoy.
 * Un nuevo reporte de lotes reemplaza todo por lo real (porque `ultimaVez` y `cantidad` se renuevan).
 * Sin consumo no se proyecta (la cantidad queda como la del reporte). Si la existencia real es mayor que la
 * proyectada no se inventa en qué lote está: se avisa en `excesoReal`.
 */
export function proyectarLotes(p: {
  lotes: readonly LoteGuardado[];
  consumos: ReadonlyMap<string, number | null>;
  existencias: ReadonlyMap<string, ExistenciaReal>;
  hoy: FechaISO;
  feriados?: readonly FechaISO[];
}): Proyeccion {
  const feriados = p.feriados ?? [];
  const vista = new Map<string, LoteVista>(p.lotes.map((l) => [l.id, { ...l, cantidadReal: l.cantidad, proyectado: false }]));
  const excesoReal = new Set<string>();
  const ajustados = new Map<string, number>();

  const porProducto = new Map<string, LoteGuardado[]>();
  for (const l of p.lotes.filter(vigente)) porProducto.set(l.codigo, [...(porProducto.get(l.codigo) ?? []), l]);

  for (const [codigo, lotes] of porProducto) {
    const desde = lotes.reduce((m, l) => (l.ultimaVez > m ? l.ultimaVez : m), '0000-00-00');
    if (desde >= p.hoy) continue;
    const consumo = p.consumos.get(codigo) ?? null;
    const real = p.existencias.get(codigo);
    const corte = real && real.fecha > desde && real.fecha <= p.hoy ? real.fecha : null;
    if ((consumo === null || !(consumo > 0)) && corte === null) continue;

    let actual = lotes.map((l) => ({ id: l.id, vence: l.vence, cantidad: l.cantidad })).sort(porVence);
    const consumir = (desdeTramo: FechaISO, hastaTramo: FechaISO) => {
      if (consumo === null || !(consumo > 0)) return;
      const dias = habilesHasta(desdeTramo, hastaTramo, feriados);
      const { restante } = simularFEFO(actual, consumo, desdeTramo, dias, feriados);
      actual = actual.map((l) => ({ ...l, cantidad: restante.get(l.id) ?? l.cantidad }));
    };

    consumir(desde, corte ?? p.hoy);
    if (corte !== null && real) {
      const proyectado = actual.reduce((s, l) => s + l.cantidad, 0);
      const diferencia = proyectado - real.existencia;
      if (diferencia > EXCEDENTE_MINIMO) {
        let falta = diferencia;
        actual = actual.map((l) => {
          const quita = Math.min(l.cantidad, falta);
          falta -= quita;
          return { ...l, cantidad: Math.round((l.cantidad - quita) * 1e6) / 1e6 };
        });
        ajustados.set(codigo, diferencia);
      } else if (diferencia < -EXCEDENTE_MINIMO) {
        excesoReal.add(codigo);
      }
      consumir(corte, p.hoy);
    }
    for (const l of actual) {
      const v = vista.get(l.id);
      if (v) vista.set(l.id, { ...v, cantidad: l.cantidad, proyectado: true });
    }
  }

  return { lotes: [...vista.values()], excesoReal, ajustados };
}
