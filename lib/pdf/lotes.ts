import { z } from 'zod';
import { parsearCodigo } from '@/lib/domain/codigos';
import type { FechaISO } from '@/lib/domain/types';
import { ErrorReporte } from './tipos';

/**
 * Lector del reporte de lotes y vencimientos de SIFA (`Rpt_VenceBodega.rpt`, «Reporte por Lotes Próximos a Vencer»).
 * Una fila por lote: producto, lote, vencimiento, existencia (en la UD del producto) y valor en colones.
 * Se cuadra contra el «Total general» que imprime el propio reporte.
 */

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

export const FilaLoteSchema = z.object({
  codigo: z.string().regex(/^\d{3}-\d{2}-\d{4}$/),
  ud: z.string().min(1),
  descripcion: z.string(),
  lote: z.string().min(1),
  vence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** En la UD de la fila (`CN` = cientos), tal como viene en el reporte. */
  existencia: z.number().finite().nonnegative(),
  /** Valor en colones. */
  valor: z.number().finite(),
  /** Fila que conviene revisar (descripción partida en dos líneas). */
  dudosa: z.boolean(),
  nota: z.string().optional(),
});
export type FilaLote = z.infer<typeof FilaLoteSchema>;

export const ResultadoLotesSchema = z.object({
  tipo: z.literal('lotesVencimientos'),
  fechaReporte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  despacho: z.object({ codigo: z.string().nullable(), nombre: z.string().nullable() }),
  /** «Próximos a vencer como límite al…»: con 2070 el reporte trae todos los lotes. */
  limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** «Total general» (colones) que declara el reporte. */
  totalDeclarado: z.number().nullable(),
  /** Suma del valor de las filas leídas (colones). */
  sumaValor: z.number(),
  /** `true` si la suma coincide con el total declarado (con el redondeo del propio reporte); `null` si no trae total. */
  cuadra: z.boolean().nullable(),
  filas: z.array(FilaLoteSchema),
  advertencias: z.array(z.string()),
});
export type ResultadoLotes = z.infer<typeof ResultadoLotesSchema>;

export function esReporteLotes(lineas: readonly string[]): boolean {
  const t = sinAcentos(lineas.join('\n')).toLowerCase();
  return t.includes('rpt_vencebodega') || t.includes('reporte por lotes proximos a vencer');
}

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, set: 9, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

/** `31-ene-2029` → `2029-01-31`; `null` si el mes no se conoce o el día no existe. */
export function fechaDeLote(texto: string): FechaISO | null {
  const m = /^(\d{1,2})-([A-Za-z]+)-(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const mes = MESES[sinAcentos(m[2]!).toLowerCase()];
  if (!mes) return null;
  const dia = Number(m[1]);
  const anio = Number(m[3]);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const numero = (t: string) => Number.parseFloat(t.replaceAll(',', ''));

// El código puede venir de tres maneras y las tres son el mismo producto:
//   «1-10-16-0010» (X-XX-XX-XXXX), «110-16-0010» (XXX-XX-XXXX) y, como en el reporte real de lotes, en cuatro columnas
//   «1 10 16 10» (los ceros a la izquierda no se imprimen). Todas se unifican a XXX-XX-XXXX.
const CODIGO = String.raw`(\d-\d{2}-\d{2}-\d{4}|\d{3}-\d{2}-\d{4}|\d\s\d{2}\s\d{1,2}\s\d{1,4})`;
const FECHA = String.raw`(\d{1,2}-[A-Za-z]+-\d{4})`;
// Existencia con 3 decimales y valor con 2; a veces el PDF los imprime pegados («384000.0001,442,995,200.00»).
const CANTIDADES = String.raw`(\d+\.\d{3})\s?(-?[\d,]+\.\d{2})`;

const reFila = new RegExp(String.raw`^${CODIGO}\s([A-Za-z]{1,4})\s(.+?)\s(\S+)\s${FECHA}\s${CANTIDADES}$`);
/** Descripción larga: el reporte imprime antes «UD descripción lote» y después el código con las cantidades. */
const reInicioPartida = /^([A-Za-z]{1,4})\s(.+)\s(\S+)$/;
const reFinPartida = new RegExp(String.raw`^${CODIGO}\s${FECHA}\s${CANTIDADES}$`);

const ENCABEZADOS = [
  /^Fecha\s\d{2}\/\d{2}\/\d{4}$/i,
  /^CAJA COSTARRICENSE/i,
  /^P[aá]gina\s\d+$/i,
  /^Rpt_/i,
  /^\d{4}\sAREA\s/i,
  /^Reporte por Lotes/i,
  /^Existencia$/i,
  /^Producto\sLote\sVence\sValor$/i,
  /^Total general\b/i,
];

/** Código canónico `XXX-XX-XXXX` desde cualquiera de las tres formas en que SIFA lo imprime; `null` si no es válido. */
export function codigoDeLote(crudo: string): string | null {
  const partes = crudo.trim().split(/\s+/);
  if (partes.length === 4) return parsearCodigo(`${partes[0]}-${partes[1]}-${partes[2]!.padStart(2, '0')}-${partes[3]!.padStart(4, '0')}`);
  return parsearCodigo(crudo);
}

function leerFecha(lineas: readonly string[]): FechaISO | null {
  for (const l of lineas) {
    const m = /^Fecha\s(\d{2})\/(\d{2})\/(\d{4})$/.exec(l);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

function leerLimite(lineas: readonly string[]): FechaISO | null {
  for (const l of lineas) {
    const m = /l[ií]mite al\s(\d{2})\/(\d{2})\/(\d{4})/i.exec(sinAcentos(l).replace(/limite/i, 'límite'));
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

function leerDespacho(lineas: readonly string[]): { codigo: string | null; nombre: string | null } {
  for (const l of lineas) {
    const m = /^(\d{3})\s(\D.+)$/.exec(l);
    if (m) return { codigo: m[1] ?? null, nombre: m[2]?.trim() ?? null };
  }
  return { codigo: null, nombre: null };
}

function leerTotal(lineas: readonly string[]): number | null {
  for (const l of lineas) {
    const m = /^Total general\s(-?[\d,]+\.\d{2})$/i.exec(l);
    if (m) return numero(m[1]!);
  }
  return null;
}

const centimos = (n: number) => Math.round(n * 100);
const colones = (c: number) => (c / 100).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Convierte las líneas del PDF en lotes. Todo lo que no se pueda leer queda como advertencia (nada se descarta en silencio),
 * y la suma del valor de las filas debe coincidir con el «Total general» del reporte.
 * @throws ErrorReporte si no es el reporte de lotes o no trae filas.
 */
export function parsearLotes(lineas: readonly string[]): ResultadoLotes {
  if (!esReporteLotes(lineas)) throw new ErrorReporte('No reconozco este reporte de lotes y vencimientos (Rpt_VenceBodega).');

  const filas: FilaLote[] = [];
  const advertencias: string[] = [];
  const noReconocidas: string[] = [];

  const agregar = (cod: string, ud: string, descripcion: string, lote: string, fecha: string, cant: string, valor: string, dudosa: boolean) => {
    const codigo = codigoDeLote(cod);
    const vence = fechaDeLote(fecha);
    if (!codigo || !vence) {
      noReconocidas.push(`${cod} ${lote} ${fecha}`);
      return;
    }
    filas.push({
      codigo,
      ud: ud.toUpperCase(),
      descripcion: descripcion.replace(/\s+/g, ' ').trim(),
      lote,
      vence,
      existencia: numero(cant),
      valor: numero(valor),
      dudosa,
      ...(dudosa ? { nota: 'Descripción partida en dos líneas en el PDF.' } : {}),
    });
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!;
    const completa = reFila.exec(linea);
    if (completa) {
      agregar(completa[1]!, completa[2]!, completa[3]!, completa[4]!, completa[5]!, completa[6]!, completa[7]!, false);
      continue;
    }
    const fin = reFinPartida.exec(lineas[i + 1] ?? '');
    const inicio = fin ? reInicioPartida.exec(linea) : null;
    if (inicio && fin) {
      agregar(fin[1]!, inicio[1]!, inicio[2]!, inicio[3]!, fin[2]!, fin[3]!, fin[4]!, true);
      i++;
      continue;
    }
    if (!ENCABEZADOS.some((re) => re.test(linea)) && !/^(\d{3})\s\D/.test(linea)) noReconocidas.push(linea);
  }

  if (filas.length === 0) throw new ErrorReporte('No encontré filas de lotes en el reporte.');

  if (noReconocidas.length > 0) {
    const muestra = noReconocidas.slice(0, 5).map((l) => `«${l}»`).join(', ');
    advertencias.push(
      `${noReconocidas.length} línea(s) del PDF no se pudieron leer y NO están en la vista previa: ${muestra}${noReconocidas.length > 5 ? '…' : ''}.`,
    );
  }

  const vistos = new Map<string, number>();
  for (const f of filas) {
    const k = `${f.codigo}|${f.lote}|${f.vence}`;
    vistos.set(k, (vistos.get(k) ?? 0) + 1);
  }
  for (const [k, n] of vistos) {
    if (n > 1) advertencias.push(`Lote repetido en el reporte (${k.replaceAll('|', ' · ')}): ${n} filas. Se suman sus cantidades.`);
  }

  const totalDeclarado = leerTotal(lineas);
  const suma = filas.reduce((s, f) => s + centimos(f.valor), 0);
  // Cada valor del PDF está redondeado al céntimo y el total se calcula sin redondear: la suma puede diferir hasta medio céntimo por fila.
  const cuadra = totalDeclarado === null ? null : Math.abs(suma - centimos(totalDeclarado)) <= Math.ceil(filas.length / 2);
  if (totalDeclarado === null) {
    advertencias.push('No encontré el «Total general» del reporte: no se pudo cuadrar el valor.');
  } else if (!cuadra) {
    advertencias.push(
      `El valor no cuadra: el reporte declara ₡${colones(centimos(totalDeclarado))} y las filas leídas suman ₡${colones(suma)} (diferencia ₡${colones(suma - centimos(totalDeclarado))}). Falta o sobra alguna fila.`,
    );
  }

  return ResultadoLotesSchema.parse({
    tipo: 'lotesVencimientos',
    fechaReporte: leerFecha(lineas),
    despacho: leerDespacho(lineas),
    limite: leerLimite(lineas),
    totalDeclarado,
    sumaValor: suma / 100,
    cuadra,
    filas,
    advertencias,
  });
}

/** Suma del valor de las filas (colones), sin error de coma flotante. */
export function sumaValor(filas: readonly Pick<FilaLote, 'valor'>[]): number {
  return filas.reduce((s, f) => s + centimos(f.valor), 0) / 100;
}
