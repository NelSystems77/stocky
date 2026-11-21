import { esCodigoValido, normalizarCodigo } from './codigos';
import type { FechaISO } from './types';
import { aUnidadesBase, deUnidadesBase, normalizarUD, TABLA_UD_INICIAL, type TablaUD } from './unidades';

export type TipoTraslado = 'envio' | 'recepcion';
export type EstadoTraslado = 'pendiente' | 'recibido' | 'enviado';

export const ETIQUETA_TIPO_TRASLADO: Record<TipoTraslado, string> = { envio: 'Envío', recepcion: 'Recepción' };
export const ETIQUETA_ESTADO_TRASLADO: Record<EstadoTraslado, string> = {
  pendiente: 'Pendiente',
  recibido: 'Recibido',
  enviado: 'Enviado',
};

export interface ItemTraslado {
  codigo: string;
  /** Unidades base: lo que dice la orden (lo que se esperaba recibir o lo que se envía). */
  cantidad: number;
  /** Solo recepciones: lo que realmente llegó (unidades base). Sin este dato se toma como llegado completo. */
  recibida?: number;
}

/**
 * Traslado de medicamentos entre unidades. La orden SAP empieza con 50000.
 * Recepción: pendiente por llegar → recibido. Envío: pendiente → enviado.
 * `enSAP` y `enSIFA` son el checklist de trámite (solo 771).
 */
export interface RegistroTraslado {
  id: string;
  /** Fecha en que se registró. */
  fecha: FechaISO;
  ordenSAP: string;
  tipo: TipoTraslado;
  /** Unidad de origen (recepción) o destino (envío): hospital, área de salud u otra. */
  unidad: string;
  items: ItemTraslado[];
  estado: EstadoTraslado;
  /** Fecha en que se recibió o se envió; `null` mientras esté pendiente. */
  fechaCierre: FechaISO | null;
  enSAP: boolean;
  enSIFA: boolean;
  notas: string;
}

export interface EntradaTraslado {
  fecha: FechaISO;
  ordenSAP: string;
  tipo: TipoTraslado;
  unidad: string;
  /** Cantidades en la UD de cada producto, como las dice la persona. */
  items: { codigo: string; cantidad: number; ud: string }[];
  notas: string;
}

export interface TrasladoValido {
  fecha: FechaISO;
  ordenSAP: string;
  tipo: TipoTraslado;
  unidad: string;
  items: ItemTraslado[];
  notas: string;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ORDEN_SAP = /^50000\d*$/;
const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

/** Solo dígitos y debe empezar con 50000 (ej. `5000012345`). Quita espacios. */
export function normalizarOrdenSAP(texto: string): string {
  return texto.replace(/\s+/g, '');
}

export function esOrdenSAPValida(texto: string): boolean {
  const o = normalizarOrdenSAP(texto);
  return o.length >= 6 && ORDEN_SAP.test(o);
}

/** Estados permitidos según el tipo: una recepción no se «envía» ni un envío se «recibe». */
export function estadosValidos(tipo: TipoTraslado): EstadoTraslado[] {
  return tipo === 'recepcion' ? ['pendiente', 'recibido'] : ['pendiente', 'enviado'];
}

export function validarTraslado(entrada: EntradaTraslado, tabla: TablaUD = TABLA_UD_INICIAL): Resultado<TrasladoValido> {
  const ordenSAP = normalizarOrdenSAP(entrada.ordenSAP);
  if (!esOrdenSAPValida(ordenSAP)) return { ok: false, error: 'La orden SAP debe empezar con 50000 y tener solo números.' };
  if (!FECHA.test(entrada.fecha)) return { ok: false, error: 'La fecha no es válida.' };
  if (entrada.tipo !== 'envio' && entrada.tipo !== 'recepcion') return { ok: false, error: 'Elige si es un envío o una recepción.' };
  const unidad = entrada.unidad.trim().slice(0, 80);
  if (unidad === '') return { ok: false, error: entrada.tipo === 'envio' ? 'Indica la unidad de destino.' : 'Indica la unidad de origen.' };
  if (entrada.items.length === 0) return { ok: false, error: 'Agrega al menos un producto.' };

  // Un mismo producto repetido se suma en una sola línea.
  const porCodigo = new Map<string, number>();
  for (const it of entrada.items) {
    const codigo = normalizarCodigo(it.codigo);
    if (!esCodigoValido(codigo)) return { ok: false, error: `El código «${it.codigo}» no es válido.` };
    if (!Number.isFinite(it.cantidad) || it.cantidad <= 0) return { ok: false, error: `La cantidad de ${codigo} debe ser mayor que 0.` };
    porCodigo.set(codigo, redondear((porCodigo.get(codigo) ?? 0) + aUnidadesBase(it.cantidad, it.ud, tabla)));
  }
  const items = [...porCodigo.entries()].map(([codigo, cantidad]) => ({ codigo, cantidad }));
  return { ok: true, valor: { fecha: entrada.fecha, ordenSAP, tipo: entrada.tipo, unidad, items, notas: entrada.notas.trim().slice(0, 500) } };
}

/** Cierra el traslado: recepción → `recibido`, envío → `enviado`, con la fecha dada. */
export function cerrarTraslado(t: Pick<RegistroTraslado, 'tipo'>, fecha: FechaISO): { estado: EstadoTraslado; fechaCierre: FechaISO } {
  return { estado: t.tipo === 'recepcion' ? 'recibido' : 'enviado', fechaCierre: fecha };
}

export const esPendiente = (t: Pick<RegistroTraslado, 'estado'>): boolean => t.estado === 'pendiente';

/** Trámite completo: registrado en SAP y aplicado en SIFA. */
export const tramiteCompleto = (t: Pick<RegistroTraslado, 'enSAP' | 'enSIFA'>): boolean => t.enSAP && t.enSIFA;

function aUTC(f: FechaISO): number {
  const [y, m, d] = f.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Días calendario desde el registro hasta `hoy` (o hasta el cierre). Nunca negativo. */
export function diasDesdeRegistro(t: Pick<RegistroTraslado, 'fecha' | 'fechaCierre'>, hoy: FechaISO): number {
  return Math.max(0, Math.round((aUTC(t.fechaCierre ?? hoy) - aUTC(t.fecha)) / 86_400_000));
}

/** Pendientes por llegar o enviar (regla A7), los más antiguos primero. */
export function trasladosPendientes(registros: readonly RegistroTraslado[]): RegistroTraslado[] {
  return registros.filter(esPendiente).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ordenSAP.localeCompare(b.ordenSAP));
}

/** Cerrados (recibidos o enviados) con trámite SAP/SIFA incompleto: algo que todavía hay que hacer. */
export function tramitesPendientes(registros: readonly RegistroTraslado[]): RegistroTraslado[] {
  return registros
    .filter((t) => !esPendiente(t) && !tramiteCompleto(t))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ordenSAP.localeCompare(b.ordenSAP));
}

/** Más reciente primero. */
export function ordenarTraslados(registros: readonly RegistroTraslado[]): RegistroTraslado[] {
  return [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.ordenSAP.localeCompare(b.ordenSAP));
}

/** `mes` es `YYYY-MM`, por fecha de registro. */
export function trasladosDelMes(registros: readonly RegistroTraslado[], mes: string): RegistroTraslado[] {
  return registros.filter((t) => t.fecha.startsWith(`${mes}-`));
}

export interface TotalesTraslados {
  total: number;
  enviados: number;
  recibidos: number;
  pendientes: number;
  /** Cerrados con SAP o SIFA sin marcar. */
  tramitePendiente: number;
  /** Unidades base de todos los productos de los traslados enviados / de lo que realmente se recibió. */
  unidadesEnviadas: number;
  unidadesRecibidas: number;
  /** Recepciones en las que llegó algo distinto de lo que decía la orden. */
  conDiferencia: number;
}

/** Totales para el resumen mensual (RF-9.x): enviados, recibidos y pendientes con su orden SAP en el detalle. */
export function totalesTraslados(registros: readonly RegistroTraslado[]): TotalesTraslados {
  const t: TotalesTraslados = { total: registros.length, enviados: 0, recibidos: 0, pendientes: 0, tramitePendiente: 0, unidadesEnviadas: 0, unidadesRecibidas: 0, conDiferencia: 0 };
  for (const r of registros) {
    // De una recepción cuenta lo que realmente llegó; sin ese dato, lo que decía la orden.
    const unidades = r.items.reduce((s, i) => s + (r.estado === 'recibido' ? (i.recibida ?? i.cantidad) : i.cantidad), 0);
    if (tieneDiferencia(r)) t.conDiferencia += 1;
    if (r.estado === 'enviado') {
      t.enviados += 1;
      t.unidadesEnviadas = redondear(t.unidadesEnviadas + unidades);
    } else if (r.estado === 'recibido') {
      t.recibidos += 1;
      t.unidadesRecibidas = redondear(t.unidadesRecibidas + unidades);
    } else t.pendientes += 1;
    if (!esPendiente(r) && !tramiteCompleto(r)) t.tramitePendiente += 1;
  }
  return t;
}

/**
 * Un traslado ya guardado como lo escribió la persona, para editarlo: cada cantidad vuelve a la UD del producto
 * (`udDe` da la UD según el último reporte; sin ella queda en unidades sueltas). Es la inversa de `validarTraslado`.
 */
export function entradaDesdeTraslado(
  t: Pick<RegistroTraslado, 'fecha' | 'ordenSAP' | 'tipo' | 'unidad' | 'items' | 'notas'>,
  udDe: (codigo: string) => string | undefined,
  tabla: TablaUD = TABLA_UD_INICIAL,
): EntradaTraslado {
  return {
    fecha: t.fecha,
    ordenSAP: t.ordenSAP,
    tipo: t.tipo,
    unidad: t.unidad,
    items: t.items.map((i) => {
      const ud = normalizarUD(udDe(i.codigo) ?? 'UN');
      return { codigo: i.codigo, ud, cantidad: deUnidadesBase(i.cantidad, ud, tabla) };
    }),
    notas: t.notas,
  };
}

/**
 * Campos que se escriben al editar un traslado. El trámite SAP/SIFA no se toca. Si cambió el tipo y el estado ya no
 * corresponde (una recepción no está «enviada»), vuelve a pendiente; si no, conserva su estado y su fecha de cierre.
 */
export function camposEditadosTraslado(
  actual: Pick<RegistroTraslado, 'estado' | 'fechaCierre' | 'items'>,
  nuevo: TrasladoValido,
): TrasladoValido & { estado: EstadoTraslado; fechaCierre: FechaISO | null } {
  const conserva = estadosValidos(nuevo.tipo).includes(actual.estado);
  // Lo que ya se anotó como recibido de cada producto se conserva mientras la recepción siga cerrada.
  const recibidas = new Map(actual.items.flatMap((i) => (i.recibida === undefined ? [] : [[i.codigo, i.recibida] as const])));
  const items = nuevo.items.map((i) => {
    const r = conserva && actual.estado === 'recibido' ? recibidas.get(i.codigo) : undefined;
    return r === undefined ? i : { ...i, recibida: r };
  });
  return { ...nuevo, items, estado: conserva ? actual.estado : 'pendiente', fechaCierre: conserva ? actual.fechaCierre : null };
}

/** Lo que llegó − lo que decía la orden (unidades base; negativo si falta). `null` si aún no se anotó lo recibido. */
export function diferenciaItem(i: ItemTraslado): number | null {
  return i.recibida === undefined ? null : redondear(i.recibida - i.cantidad);
}

/** Recepción cerrada en la que algún producto llegó distinto de lo que decía la orden. */
export function tieneDiferencia(t: Pick<RegistroTraslado, 'estado' | 'items'>): boolean {
  return t.estado === 'recibido' && t.items.some((i) => (diferenciaItem(i) ?? 0) !== 0);
}

/**
 * Anota lo que llegó de cada producto al cerrar una recepción. `recibidas` va por código en unidades base; un producto
 * que no aparece se toma como llegado completo. Los negativos no valen.
 */
export function aplicarRecepcion(items: readonly ItemTraslado[], recibidas: ReadonlyMap<string, number>): Resultado<ItemTraslado[]> {
  const resultado: ItemTraslado[] = [];
  for (const i of items) {
    const r = recibidas.get(i.codigo) ?? i.cantidad;
    if (!Number.isFinite(r) || r < 0) return { ok: false, error: `La cantidad recibida de ${i.codigo} no puede ser negativa.` };
    resultado.push({ codigo: i.codigo, cantidad: i.cantidad, recibida: redondear(r) });
  }
  return { ok: true, valor: resultado };
}

/** Quita lo anotado como recibido (al deshacer la recepción). */
export function quitarRecepcion(items: readonly ItemTraslado[]): ItemTraslado[] {
  return items.map(({ codigo, cantidad }) => ({ codigo, cantidad }));
}
