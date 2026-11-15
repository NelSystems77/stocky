import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { diasAgotado, separarRegistros, type RegistroAgotado } from '@/lib/domain/agotados';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { formatearEnUD } from '@/lib/domain/formato';
import type { Periodo } from '@/lib/domain/periodos';
import { seSolapa } from '@/lib/domain/periodos';
import { estadoStock } from '@/lib/domain/stock';
import type { FechaISO } from '@/lib/domain/types';
import type { DatosReporte } from './tipos';

export interface Emisor {
  usuario: string;
  unidad: string;
  generadoEn: Date;
}

/** Producto con sus cantidades en unidades base (lo que guarda Firestore). */
export interface ProductoReporte {
  codigo: string;
  descripcion: string;
  ud: string;
  cuota?: number;
  cuotaMinima?: number;
  existencia?: number;
}

const fechaCorta = (f: FechaISO) => format(parseISO(f), "d MMM yyyy", { locale: es });
const sufijoArchivo = (f: FechaISO) => f.replaceAll('-', '');

/** Lista de bajos (regla A5): existencia menor que la cuota mínima, del más al menos escaso. */
export function reporteBajos(productos: readonly ProductoReporte[], fechaReporte: FechaISO | null, e: Emisor): DatosReporte {
  const bajos = productos
    .filter((p) => estadoStock(p) === 'bajo')
    .sort((a, b) => {
      const ra = (a.existencia ?? 0) / (a.cuotaMinima || 1);
      const rb = (b.existencia ?? 0) / (b.cuotaMinima || 1);
      return ra - rb || a.codigo.localeCompare(b.codigo);
    });
  const hoy = hoyCostaRica(e.generadoEn);
  return {
    titulo: 'Productos bajos',
    usuario: e.usuario,
    unidad: e.unidad,
    generadoEn: e.generadoEn,
    detalle: [fechaReporte ? `Existencias según el reporte de SIFA del ${fechaCorta(fechaReporte)}` : 'Existencias según el último reporte de SIFA'],
    columnas: ['Código', 'Descripción', 'Existencia', 'Cuota mínima', 'Cuota'],
    filas: bajos.map((p) => [
      p.codigo,
      p.descripcion,
      formatearEnUD(p.existencia ?? 0, p.ud),
      formatearEnUD(p.cuotaMinima ?? 0, p.ud),
      p.cuota ? formatearEnUD(p.cuota, p.ud) : '—',
    ]),
    columnasNumericas: [2, 3, 4],
    resumen: [`Productos bajos: ${bajos.length}`, 'Los agotados (existencia 0) van en el reporte de agotados.'],
    nombreArchivo: `bajos_${sufijoArchivo(fechaReporte ?? hoy)}`,
  };
}

/** Agotados que tocan el período: los que se agotaron en él o ya lo estaban y siguieron agotados dentro de él. */
export function reporteAgotados(
  registros: readonly RegistroAgotado[],
  descripciones: ReadonlyMap<string, string>,
  periodo: Periodo,
  hoy: FechaISO,
  e: Emisor,
): DatosReporte {
  const enPeriodo = registros.filter((r) => seSolapa(r.fechaAgotado, r.fechaIngreso, periodo));
  const { activos, cerrados } = separarRegistros(enPeriodo);
  const ordenados = [...activos, ...[...cerrados].sort((a, b) => a.fechaAgotado.localeCompare(b.fechaAgotado))];
  return {
    titulo: 'Reporte de agotados',
    usuario: e.usuario,
    unidad: e.unidad,
    generadoEn: e.generadoEn,
    detalle: [`Período: ${fechaCorta(periodo.desde)} al ${fechaCorta(periodo.hasta)}`],
    columnas: ['Código', 'Descripción', 'Agotado desde', 'Ingreso', 'Días agotado', 'Observaciones'],
    filas: ordenados.map((r) => [
      r.codigo,
      descripciones.get(r.codigo) ?? '—',
      fechaCorta(r.fechaAgotado),
      r.fechaIngreso ? fechaCorta(r.fechaIngreso) : 'Sigue agotado',
      diasAgotado(r, hoy),
      r.notas,
    ]),
    columnasNumericas: [4],
    resumen: [
      `Productos en el reporte: ${enPeriodo.length}`,
      `Siguen agotados: ${activos.length}`,
      `Ya reabastecidos: ${cerrados.length}`,
    ],
    nombreArchivo: `agotados_${sufijoArchivo(periodo.desde)}_${sufijoArchivo(periodo.hasta)}`,
  };
}
