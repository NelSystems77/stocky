import type { FilaLote } from '@/lib/pdf/lotes';
import { aUnidadesBase, TABLA_UD_INICIAL, type TablaUD } from './unidades';
import type { FechaISO } from './types';

/** Estado de un lote guardado. `agotado` = ya no aparece en el último reporte. */
export type EstadoLote = 'activo' | 'gestionado' | 'vencido' | 'agotado';

/** Lote leído de un reporte, con la cantidad en unidades base. */
export interface Lote {
  codigo: string;
  ud: string;
  descripcion: string;
  lote: string;
  vence: FechaISO;
  /** Unidades base. */
  cantidad: number;
  /** Colones. */
  valor: number;
}

/** Lote ya guardado (colección `lotes`). */
export interface LoteGuardado extends Lote {
  id: string;
  estado: EstadoLote;
  /** Lo que entró en total (se suma cada ingreso, RF-1.9) y cuándo se vio por primera vez. */
  cantidadIngresada: number;
  fechaIngreso: FechaISO;
  /** Fecha del último reporte donde apareció. */
  ultimaVez: FechaISO;
}

/** ID estable del lote: un mismo número de lote puede venir con dos vencimientos (se guardan como lotes distintos). */
export function idLote(codigo: string, lote: string, vence: FechaISO): string {
  return `${codigo}_${lote}_${vence}`.replace(/[\s/]+/g, '-');
}

/** Los medicamentos son el grupo 1 (`110-…`, `111-…`). Condones, etiquetas, bolsas, etc. son otros grupos. */
export function esMedicamento(codigo: string): boolean {
  return codigo.startsWith('1');
}

const IGUAL = 1e-6;
const igual = (a: number, b: number) => Math.abs(a - b) < IGUAL;

/**
 * Convierte las filas del reporte a lotes en unidades base. Si el mismo lote (código, lote y vencimiento)
 * viene en dos filas, se suman cantidad y valor.
 */
export function lotesDesdeFilas(filas: readonly FilaLote[], tabla: TablaUD = TABLA_UD_INICIAL): Lote[] {
  const mapa = new Map<string, Lote>();
  for (const f of filas) {
    const id = idLote(f.codigo, f.lote, f.vence);
    const previo = mapa.get(id);
    const cantidad = aUnidadesBase(f.existencia, f.ud, tabla);
    if (previo) {
      previo.cantidad = Math.round((previo.cantidad + cantidad) * 1e6) / 1e6;
      previo.valor = Math.round((previo.valor + f.valor) * 100) / 100;
    } else {
      mapa.set(id, { codigo: f.codigo, ud: f.ud, descripcion: f.descripcion, lote: f.lote, vence: f.vence, cantidad, valor: f.valor });
    }
  }
  return [...mapa.values()].toSorted((a, b) => a.codigo.localeCompare(b.codigo) || a.vence.localeCompare(b.vence) || a.lote.localeCompare(b.lote));
}

export interface CambioCantidad {
  lote: Lote;
  antes: number;
  despues: number;
}
export interface CambioVencimiento {
  codigo: string;
  descripcion: string;
  ud: string;
  lote: string;
  venceAntes: FechaISO;
  venceDespues: FechaISO;
  cantidadAntes: number;
  cantidadDespues: number;
}

export interface CambiosLotes {
  /** Lotes que no estaban en la carga anterior (ingresos o lotes que reaparecen). */
  nuevos: Lote[];
  /** Lotes con existencia en la carga anterior que ya no aparecen. */
  salieron: LoteGuardado[];
  /** Mismo lote y vencimiento con otra cantidad: bajó (consumo) o subió (ingreso o corrección). */
  bajaron: CambioCantidad[];
  subieron: CambioCantidad[];
  /** Mismo número de lote con otra fecha de vencimiento: el cambio que más conviene verificar. */
  vencimiento: CambioVencimiento[];
  sinCambio: number;
}

function agrupar<T>(lista: readonly T[], clave: (x: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const x of lista) mapa.set(clave(x), [...(mapa.get(clave(x)) ?? []), x]);
  return mapa;
}

const porProducto = (a: { codigo: string; lote: string }, b: { codigo: string; lote: string }) => a.codigo.localeCompare(b.codigo) || a.lote.localeCompare(b.lote);

/**
 * Compara la carga nueva contra lo que había guardado. Solo cuentan los lotes con existencia (los `agotado` de cargas
 * anteriores no se consideran «anteriores»: si reaparecen, salen como nuevos).
 * Un lote que cambia de vencimiento se detecta cuando, para el mismo código y número de lote, queda exactamente
 * uno sin pareja a cada lado; si hay más de uno, se tratan como salidas y entradas (no se adivina).
 */
export function compararLotes(anteriores: readonly LoteGuardado[], nuevos: readonly Lote[]): CambiosLotes {
  const previos = anteriores.filter((l) => l.estado !== 'agotado' && l.cantidad > 0);
  const previosPorId = new Map(previos.map((l) => [l.id, l]));
  const nuevosPorId = new Map(nuevos.map((l) => [idLote(l.codigo, l.lote, l.vence), l]));

  const bajaron: CambioCantidad[] = [];
  const subieron: CambioCantidad[] = [];
  let sinCambio = 0;
  const sinParejaNuevos: Lote[] = [];

  for (const [id, n] of nuevosPorId) {
    const p = previosPorId.get(id);
    if (!p) {
      sinParejaNuevos.push(n);
    } else if (igual(p.cantidad, n.cantidad)) {
      sinCambio++;
    } else if (n.cantidad < p.cantidad) {
      bajaron.push({ lote: n, antes: p.cantidad, despues: n.cantidad });
    } else {
      subieron.push({ lote: n, antes: p.cantidad, despues: n.cantidad });
    }
  }
  const sinParejaPrevios = previos.filter((p) => !nuevosPorId.has(p.id));

  const clave = (x: { codigo: string; lote: string }) => `${x.codigo}|${x.lote}`;
  const gruposPrev = agrupar(sinParejaPrevios, clave);
  const gruposNuevos = agrupar(sinParejaNuevos, clave);
  const vencimiento: CambioVencimiento[] = [];
  const emparejadosPrev = new Set<string>();
  const emparejadosNuevos = new Set<string>();
  for (const [k, ps] of gruposPrev) {
    const ns = gruposNuevos.get(k);
    if (ps.length === 1 && ns?.length === 1) {
      const p = ps[0]!;
      const n = ns[0]!;
      vencimiento.push({
        codigo: n.codigo,
        descripcion: n.descripcion,
        ud: n.ud,
        lote: n.lote,
        venceAntes: p.vence,
        venceDespues: n.vence,
        cantidadAntes: p.cantidad,
        cantidadDespues: n.cantidad,
      });
      emparejadosPrev.add(p.id);
      emparejadosNuevos.add(idLote(n.codigo, n.lote, n.vence));
    }
  }

  return {
    nuevos: sinParejaNuevos.filter((n) => !emparejadosNuevos.has(idLote(n.codigo, n.lote, n.vence))).toSorted(porProducto),
    salieron: sinParejaPrevios.filter((p) => !emparejadosPrev.has(p.id)).toSorted(porProducto),
    bajaron: bajaron.toSorted((a, b) => porProducto(a.lote, b.lote)),
    subieron: subieron.toSorted((a, b) => porProducto(a.lote, b.lote)),
    vencimiento: vencimiento.toSorted(porProducto),
    sinCambio,
  };
}

export const hayCambios = (c: CambiosLotes): boolean =>
  c.nuevos.length + c.salieron.length + c.bajaron.length + c.subieron.length + c.vencimiento.length > 0;

/** Lotes con la fecha de vencimiento ya pasada (o de hoy) y existencia: lo que la meta «cero vencidos» no quiere ver. */
export function vencidosConExistencia(lotes: readonly Lote[], fechaReporte: FechaISO): Lote[] {
  return lotes.filter((l) => l.cantidad > 0 && l.vence <= fechaReporte).toSorted((a, b) => a.vence.localeCompare(b.vence) || porProducto(a, b));
}

export interface DiferenciaExistencia {
  codigo: string;
  descripcion: string;
  ud: string;
  /** Suma de los lotes del reporte (unidades base). */
  lotes: number;
  /** Existencia que dice el reporte de existencias de despacho (unidades base). */
  existencia: number;
}

export interface CuadreExistencias {
  /** Productos cuya suma de lotes no coincide con la existencia. */
  diferencias: DiferenciaExistencia[];
  /** Con existencia en el reporte de existencias pero sin ningún lote en este reporte. */
  sinLotes: { codigo: string; descripcion: string; ud: string; existencia: number }[];
  /** Con lotes aquí pero que no aparecen en las existencias guardadas. */
  sinExistencia: string[];
  /** Productos que sí cuadran. */
  coinciden: number;
}

export interface ExistenciaBase {
  codigo: string;
  ud: string;
  descripcion: string;
  existencia?: number | undefined;
}

/**
 * Compara la suma de lotes de cada producto con la existencia de SIFA ya guardada (si no hay, no se compara).
 * Ojo: solo es comparable si ambos reportes son de la misma fecha; la pantalla lo avisa.
 */
export function cuadrarConExistencias(lotes: readonly Lote[], existencias: readonly ExistenciaBase[]): CuadreExistencias {
  const sumas = new Map<string, number>();
  for (const l of lotes) sumas.set(l.codigo, (sumas.get(l.codigo) ?? 0) + l.cantidad);
  const porCodigo = new Map(existencias.map((e) => [e.codigo, e]));

  const diferencias: DiferenciaExistencia[] = [];
  const sinExistencia: string[] = [];
  let coinciden = 0;
  for (const [codigo, suma] of sumas) {
    const e = porCodigo.get(codigo);
    if (!e || e.existencia === undefined) {
      sinExistencia.push(codigo);
      continue;
    }
    if (Math.abs(suma - e.existencia) < 0.5) coinciden++;
    else diferencias.push({ codigo, descripcion: e.descripcion, ud: e.ud, lotes: suma, existencia: e.existencia });
  }
  const sinLotes = existencias
    .filter((e) => (e.existencia ?? 0) > 0 && !sumas.has(e.codigo))
    .map((e) => ({ codigo: e.codigo, descripcion: e.descripcion, ud: e.ud, existencia: e.existencia ?? 0 }));

  return {
    diferencias: diferencias.toSorted((a, b) => a.codigo.localeCompare(b.codigo)),
    sinLotes: sinLotes.toSorted((a, b) => a.codigo.localeCompare(b.codigo)),
    sinExistencia: sinExistencia.toSorted(),
    coinciden,
  };
}

/** Qué conviene avisar sobre la fecha del reporte frente a lo ya cargado. */
export function revisarFechaCarga(fechaReporte: FechaISO | null, ultimaCarga: FechaISO | null): { nivel: 'ok' | 'aviso' | 'bloqueo'; mensaje: string | null } {
  if (fechaReporte === null) return { nivel: 'aviso', mensaje: 'El reporte no trae fecha; se usará la de hoy.' };
  if (ultimaCarga === null) return { nivel: 'ok', mensaje: null };
  if (fechaReporte < ultimaCarga) {
    return { nivel: 'bloqueo', mensaje: `Este reporte (${fechaReporte}) es más antiguo que el último cargado (${ultimaCarga}). Cargarlo reemplazaría datos nuevos con datos viejos.` };
  }
  if (fechaReporte === ultimaCarga) {
    return { nivel: 'aviso', mensaje: `Ya hay una carga con esta misma fecha (${fechaReporte}). Si la guardas, reemplaza la anterior.` };
  }
  return { nivel: 'ok', mensaje: null };
}

/** Fecha más reciente en que se vio algún lote (la «última carga» de lotes); `null` si nunca se cargó. */
export function ultimaCargaLotes(guardados: readonly LoteGuardado[]): FechaISO | null {
  return guardados.reduce<FechaISO | null>((m, l) => (m === null || l.ultimaVez > m ? l.ultimaVez : m), null);
}

export interface RevisionLotes {
  cambios: CambiosLotes;
  /** `false` si no había nada guardado (primera carga). */
  hayAnterior: boolean;
  ultimaCarga: FechaISO | null;
  fecha: { nivel: 'ok' | 'aviso' | 'bloqueo'; mensaje: string | null };
  vencidos: Lote[];
  cuadre: CuadreExistencias | null;
  productos: number;
  noMedicamentos: number;
}

/** Junta todo lo que la persona debe revisar antes de guardar una carga de lotes. */
export function revisarCarga(p: {
  nuevos: readonly Lote[];
  anteriores: readonly LoteGuardado[];
  existencias: readonly ExistenciaBase[] | null;
  fechaReporte: FechaISO | null;
  hoy: FechaISO;
}): RevisionLotes {
  const fecha = p.fechaReporte ?? p.hoy;
  const ultimaCarga = ultimaCargaLotes(p.anteriores);
  return {
    cambios: compararLotes(p.anteriores, p.nuevos),
    hayAnterior: p.anteriores.some((l) => l.estado !== 'agotado'),
    ultimaCarga,
    fecha: revisarFechaCarga(p.fechaReporte, ultimaCarga),
    vencidos: vencidosConExistencia(p.nuevos, fecha),
    cuadre: p.existencias && p.existencias.length > 0 ? cuadrarConExistencias(p.nuevos, p.existencias) : null,
    productos: new Set(p.nuevos.map((l) => l.codigo)).size,
    noMedicamentos: p.nuevos.filter((l) => !esMedicamento(l.codigo)).length,
  };
}

export interface EscrituraLote {
  id: string;
  datos: {
    codigo: string;
    ud: string;
    descripcion: string;
    lote: string;
    vence: FechaISO;
    cantidad: number;
    valor: number;
    estado: EstadoLote;
    cantidadIngresada: number;
    fechaIngreso: FechaISO;
    ultimaVez: FechaISO;
    noMedicamento: boolean;
  };
}

export interface EscrituraSalida {
  id: string;
  datos: { cantidad: number; estado: EstadoLote; salioEn: FechaISO };
}

/**
 * Qué se escribe al guardar una carga:
 * - cada lote del reporte queda con su cantidad real y `ultimaVez`; si ya existía, conserva su ingreso original y
 *   suma lo que subió (RF-1.9); un lote `gestionado` sigue gestionado, y uno `agotado` que reaparece vuelve a `activo`;
 * - cada lote con existencia que ya no aparece queda en cantidad 0 y `agotado` (el historial no se borra).
 */
export function planGuardadoLotes(nuevos: readonly Lote[], anteriores: readonly LoteGuardado[], fecha: FechaISO): { lotes: EscrituraLote[]; salidas: EscrituraSalida[] } {
  const previosPorId = new Map(anteriores.map((l) => [l.id, l]));
  const presentes = new Set<string>();

  const lotes = nuevos.map((n): EscrituraLote => {
    const id = idLote(n.codigo, n.lote, n.vence);
    presentes.add(id);
    const p = previosPorId.get(id);
    const subio = p && p.estado !== 'agotado' ? Math.max(0, n.cantidad - p.cantidad) : 0;
    const reaparece = p?.estado === 'agotado';
    return {
      id,
      datos: {
        codigo: n.codigo,
        ud: n.ud,
        descripcion: n.descripcion,
        lote: n.lote,
        vence: n.vence,
        cantidad: n.cantidad,
        valor: n.valor,
        estado: p && !reaparece && p.estado === 'gestionado' ? 'gestionado' : 'activo',
        cantidadIngresada: !p ? n.cantidad : reaparece ? Math.round((p.cantidadIngresada + n.cantidad) * 1e6) / 1e6 : Math.round((p.cantidadIngresada + subio) * 1e6) / 1e6,
        fechaIngreso: p?.fechaIngreso ?? fecha,
        ultimaVez: fecha,
        noMedicamento: !esMedicamento(n.codigo),
      },
    };
  });

  const salidas = anteriores
    .filter((p) => !presentes.has(p.id) && p.estado !== 'agotado' && p.cantidad > 0)
    .map((p): EscrituraSalida => ({ id: p.id, datos: { cantidad: 0, estado: p.estado === 'gestionado' ? 'gestionado' : 'agotado', salioEn: fecha } }));

  return { lotes, salidas };
}
