import { formatearNumero } from './formato';
import { deUnidadesBase, type TablaUD, TABLA_UD_INICIAL } from './unidades';

/**
 * Conteo físico contra SIFA (CLAUDE.md §13). Todo en **unidades base**: la persona escribe unidades sueltas
 * (`20000`) y la pantalla las muestra en la UD del producto (`200 CN`).
 */

export interface ProductoFoto {
  descripcion: string;
  ud: string;
  /** Existencia que decía SIFA al iniciar el conteo (unidades base). */
  sifa: number;
}

/** Foto de SIFA congelada al iniciar: importar otro reporte después no la cambia. */
export type FotoSifa = Record<string, ProductoFoto>;

/** Lo contado de un producto. Solo existe si ya se contó (un producto sin línea está «sin contar», no en 0). */
export interface LineaConteo {
  codigo: string;
  /** Unidades base. */
  contado: number;
  observacion: string;
  /** Solo si el producto no estaba en el reporte de SIFA: su descripción y UD, para poder mostrarlo. */
  fueraDeSifa?: { descripcion: string; ud: string };
}

export type EstadoLinea = 'sinContar' | 'coincide' | 'falta' | 'sobra';

export interface FilaConteo {
  codigo: string;
  descripcion: string;
  ud: string;
  sifa: number;
  /** `null` = sin contar. */
  contado: number | null;
  /** Contado − SIFA en unidades base (negativa si falta producto). `null` si está sin contar. */
  diferencia: number | null;
  estado: EstadoLinea;
  observacion: string;
  fueraDeSifa: boolean;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

/** Lo que la persona escribió (unidades sueltas) → unidades base. Acepta decimales (`20050`); no negativos. */
export function validarContado(sueltas: number): Resultado<number> {
  if (!Number.isFinite(sueltas) || sueltas < 0) return { ok: false, error: 'La cantidad contada no puede ser negativa.' };
  return { ok: true, valor: redondear(sueltas) };
}

/**
 * Lee lo que la persona escribió en el campo de cantidad. Acepta `20000`, `20 000`, `20.000` (miles) y decimales con
 * coma o punto (`0,5`, `0.5`). `null` si no es una cantidad válida o es negativa. Un punto seguido de exactamente tres
 * dígitos se toma como separador de miles (`20.050` = 20050): para decimales usa coma.
 */
export function leerCantidad(texto: string): number | null {
  const t = texto.trim();
  if (t === '') return null;
  const conMiles = /^\d{1,3}([.\s]\d{3})+(,\d+)?$/.test(t);
  const limpio = conMiles ? t.replace(/[.\s]/g, '').replace(',', '.') : t.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Existencia de SIFA que entra a la foto (los reportes sin existencia cuentan como 0). */
export interface ExistenciaFoto {
  codigo: string;
  descripcion: string;
  ud: string;
  existencia?: number;
}

/** Congela la existencia de SIFA. Con `codigos` se cuenta solo esa lista; sin ella, todos los productos. */
export function crearFoto(existencias: readonly ExistenciaFoto[], codigos?: ReadonlySet<string>): FotoSifa {
  const foto: FotoSifa = {};
  for (const e of existencias) {
    if (codigos && !codigos.has(e.codigo)) continue;
    foto[e.codigo] = { descripcion: e.descripcion, ud: e.ud, sifa: e.existencia ?? 0 };
  }
  return foto;
}

/** Contado − SIFA en unidades base. `null` si el producto no se ha contado. */
export function diferenciaConteo(sifa: number, contado: number | null): number | null {
  return contado === null ? null : redondear(contado - sifa);
}

export function estadoDe(diferencia: number | null): EstadoLinea {
  if (diferencia === null) return 'sinContar';
  if (diferencia < 0) return 'falta';
  return diferencia > 0 ? 'sobra' : 'coincide';
}

/**
 * Una fila por producto de la foto, más los contados que no estaban en SIFA (con SIFA = 0, todo lo contado sobra).
 * Ordenadas por código.
 */
export function filasConteo(foto: FotoSifa, lineas: readonly LineaConteo[]): FilaConteo[] {
  const porCodigo = new Map(lineas.map((l) => [l.codigo, l]));
  const filas: FilaConteo[] = [];
  for (const [codigo, p] of Object.entries(foto)) {
    const linea = porCodigo.get(codigo);
    const contado = linea ? linea.contado : null;
    const diferencia = diferenciaConteo(p.sifa, contado);
    filas.push({
      codigo,
      descripcion: p.descripcion,
      ud: p.ud,
      sifa: p.sifa,
      contado,
      diferencia,
      estado: estadoDe(diferencia),
      observacion: linea?.observacion ?? '',
      fueraDeSifa: false,
    });
  }
  for (const l of lineas) {
    if (foto[l.codigo] !== undefined) continue;
    const diferencia = diferenciaConteo(0, l.contado);
    filas.push({
      codigo: l.codigo,
      descripcion: l.fueraDeSifa?.descripcion ?? l.codigo,
      ud: l.fueraDeSifa?.ud ?? '',
      sifa: 0,
      contado: l.contado,
      diferencia,
      estado: estadoDe(diferencia),
      observacion: l.observacion,
      fueraDeSifa: true,
    });
  }
  return filas.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/** `-50 CN`, `+12 CN`, `0`; `—` si está sin contar. El signo `-` marca lo que falta. */
export function formatearDiferencia(diferencia: number | null, ud: string, tabla: TablaUD = TABLA_UD_INICIAL): string {
  if (diferencia === null) return '—';
  if (diferencia === 0) return '0';
  const n = deUnidadesBase(Math.abs(diferencia), ud, tabla);
  return `${diferencia < 0 ? '-' : '+'}${formatearNumero(n)}${ud ? ` ${ud}` : ''}`;
}

/** Cantidad en la UD del producto: `20000` + `CN` → `200 CN`. */
export function formatearCantidad(base: number | null, ud: string, tabla: TablaUD = TABLA_UD_INICIAL): string {
  if (base === null) return '—';
  return `${formatearNumero(deUnidadesBase(base, ud, tabla))}${ud ? ` ${ud}` : ''}`;
}

export interface ResumenConteo {
  productos: number;
  contados: number;
  sinContar: number;
  conDiferencia: number;
  faltantes: number;
  sobrantes: number;
}

export function resumenConteo(filas: readonly FilaConteo[]): ResumenConteo {
  const r: ResumenConteo = { productos: filas.length, contados: 0, sinContar: 0, conDiferencia: 0, faltantes: 0, sobrantes: 0 };
  for (const f of filas) {
    if (f.estado === 'sinContar') r.sinContar++;
    else r.contados++;
    if (f.estado === 'falta') r.faltantes++;
    if (f.estado === 'sobra') r.sobrantes++;
  }
  r.conDiferencia = r.faltantes + r.sobrantes;
  return r;
}
