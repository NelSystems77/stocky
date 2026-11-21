import { parsearCodigo } from '@/lib/domain/codigos';
import type { FechaISO } from '@/lib/domain/types';
import {
  ErrorReporte,
  ResultadoReporteSchema,
  type Columna,
  type FilaReporte,
  type ResultadoReporte,
  type TipoReporte,
} from './tipos';

const NUM = String.raw`-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const CODIGO = String.raw`(?:\d-\d{2}-\d{2}-\d{4}|\d{3}-\d{2}-\d{4})`;

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

function numero(texto: string): number {
  return Number.parseFloat(texto.replaceAll(',', ''));
}

/** Tipo de reporte de despacho (existencias o productos en despacho) según su encabezado; `null` si no es ninguno. */
export function detectarTipoReporte(texto: string): TipoReporte | null {
  const t = sinAcentos(texto).toLowerCase();
  if (t.includes('rpt_existenciasdespacho') || t.includes('reporte de existencias de despacho')) {
    return 'existenciasDespacho';
  }
  if (t.includes('rptsifa032') || t.includes('reporte de productos en despacho')) {
    return 'productosEnDespacho';
  }
  return null;
}

/** Lee el orden de las columnas numéricas desde la línea de encabezado (no se supone un orden fijo). */
function detectarColumnas(lineas: readonly string[]): Columna[] | null {
  for (const linea of lineas) {
    const t = sinAcentos(linea).toUpperCase().replace('CUOTA MINIMA', 'CUOTAMIN');
    if (!/\bEXISTENCIA\b/.test(t) || !/\bCUOTA(MIN)?\b/.test(t) || !/\b(CODIGO|PRODUCTO)\b/.test(t)) continue;
    const candidatas: [Columna, RegExp][] = [
      ['cuotaMinima', /\bCUOTAMIN\b/],
      ['cuota', /\bCUOTA\b/],
      ['existencia', /\bEXISTENCIA\b/],
      ['consumo', /\bCONSUMO\b/],
    ];
    return candidatas
      .map(([col, re]) => ({ col, pos: t.search(re) }))
      .filter((c) => c.pos >= 0)
      .sort((a, b) => a.pos - b.pos)
      .map((c) => c.col);
  }
  return null;
}

function leerFecha(lineas: readonly string[]): FechaISO | null {
  for (const l of lineas) {
    const m = /Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(l);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

function leerDespacho(lineas: readonly string[]): { codigo: string | null; nombre: string | null } {
  for (const l of lineas) {
    const m = /^Despacho:\s*(\d+)\s+(.+)$/.exec(l);
    if (m) return { codigo: m[1] ?? null, nombre: m[2]?.trim() ?? null };
  }
  for (const l of lineas) {
    const m = /Reporte de existencias de Despacho\s+(\d+)/i.exec(l);
    if (m) return { codigo: m[1] ?? null, nombre: null };
  }
  return { codigo: null, nombre: null };
}

function leerCentro(lineas: readonly string[]): string | null {
  for (const l of lineas) {
    const m = /^Centro (?:de Salud|M[eé]dico):\s*(.+)$/.exec(l);
    if (m) return m[1]?.trim() ?? null;
  }
  return null;
}

function leerTotal(lineas: readonly string[]): number | null {
  for (const l of lineas) {
    const m = /^TOTAL PRODUCTOS:\s*(\d+)/i.exec(l);
    if (m) return Number(m[1]);
  }
  // El reporte de existencias imprime el total como un entero suelto al final.
  const ultima = [...lineas].reverse().find((l) => l.trim() !== '');
  return ultima && /^\d+$/.test(ultima.trim()) ? Number(ultima.trim()) : null;
}

/**
 * Convierte las líneas de texto de un reporte SIFA en filas de producto.
 * Las cantidades quedan en la UD del reporte; la conversión a unidades base se hace después.
 * @throws ErrorReporte si no es un reporte reconocido.
 */
export function parsearReporte(lineas: readonly string[]): ResultadoReporte {
  const todo = lineas.join('\n');
  const tipo = detectarTipoReporte(todo);
  if (!tipo) {
    throw new ErrorReporte('No reconozco este reporte. Sube el PDF de existencias de despacho o de productos en despacho.');
  }
  const columnas = detectarColumnas(lineas);
  if (!columnas || columnas.length === 0) {
    throw new ErrorReporte('No encontré el encabezado de columnas del reporte.');
  }

  const numeros = Array.from({ length: columnas.length }, () => `(${NUM})`).join(String.raw`\s+`);
  const reFila = new RegExp(String.raw`^(${CODIGO})\s+([A-Za-z]{1,4})\s+(.*?)\s+${numeros}$`);
  const reInicio = new RegExp(String.raw`^(${CODIGO})\s+([A-Za-z]{1,4})\s+(.*)$`);
  const reContinuacion = new RegExp(String.raw`^(.*?)\s+${numeros}$`);

  const filas: FilaReporte[] = [];
  const advertencias: string[] = [];
  const vistos = new Set<string>();

  const agregar = (codigoCrudo: string, ud: string, descripcion: string, valores: string[], dudosa: boolean, nota?: string) => {
    const codigo = parsearCodigo(codigoCrudo);
    if (!codigo) return;
    const fila: FilaReporte = { codigo, ud: ud.toUpperCase(), descripcion: descripcion.trim(), dudosa, ...(nota ? { nota } : {}) };
    columnas.forEach((col, i) => {
      fila[col] = numero(valores[i] ?? '');
    });
    if (vistos.has(codigo)) {
      advertencias.push(`Código repetido en el reporte: ${codigo}. Se conserva la última fila.`);
      const previo = filas.findIndex((f) => f.codigo === codigo);
      if (previo >= 0) filas.splice(previo, 1);
    }
    vistos.add(codigo);
    filas.push(fila);
  };

  let pendiente: { codigo: string; ud: string; desc: string } | null = null;

  for (const linea of lineas) {
    const completa = reFila.exec(linea);
    if (completa) {
      pendiente = null;
      agregar(completa[1]!, completa[2]!, completa[3]!, completa.slice(4), false);
      continue;
    }
    const inicio = reInicio.exec(linea);
    if (inicio) {
      if (pendiente) advertencias.push(`Fila incompleta descartada: ${pendiente.codigo}.`);
      pendiente = { codigo: inicio[1]!, ud: inicio[2]!, desc: inicio[3]! };
      continue;
    }
    if (pendiente) {
      // Descripción partida en dos líneas: la segunda trae el resto del nombre y las cantidades.
      const cont = reContinuacion.exec(linea);
      if (cont) {
        const descripcion = `${cont[1]} ${pendiente.desc}`.replace(/\s+/g, ' ');
        agregar(pendiente.codigo, pendiente.ud, descripcion, cont.slice(2), true, 'Descripción partida en dos líneas en el PDF.');
      } else {
        advertencias.push(`Fila incompleta descartada: ${pendiente.codigo}.`);
      }
      pendiente = null;
    }
  }
  if (pendiente) advertencias.push(`Fila incompleta descartada: ${pendiente.codigo}.`);

  const totalDeclarado = leerTotal(lineas);
  if (filas.length === 0) throw new ErrorReporte('No encontré filas de productos en el reporte.');
  if (totalDeclarado !== null && totalDeclarado !== filas.length) {
    advertencias.push(`El reporte declara ${totalDeclarado} productos pero leí ${filas.length}. Revisa antes de guardar.`);
  }

  return ResultadoReporteSchema.parse({
    tipo,
    fechaReporte: leerFecha(lineas),
    despacho: leerDespacho(lineas),
    centro: leerCentro(lineas),
    totalDeclarado,
    columnas,
    filas,
    advertencias,
  });
}
