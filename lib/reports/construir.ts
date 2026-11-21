import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { diasAgotado, separarRegistros, type RegistroAgotado } from '@/lib/domain/agotados';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { formatearEnUD } from '@/lib/domain/formato';
import type { Periodo } from '@/lib/domain/periodos';
import { seSolapa } from '@/lib/domain/periodos';
import { estadoStock } from '@/lib/domain/stock';
import type { FechaISO } from '@/lib/domain/types';
import type { AlertaLote, LoteVista, ResumenVencimientos, UmbralesVencimiento } from '@/lib/domain/vencimientos';
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

export interface FilaVencimiento {
  lote: LoteVista;
  /** `null` para lotes gestionados o sin alerta. */
  alerta: AlertaLote | null;
}

const ETIQUETA_NIVEL = { vencido: 'Vencido', alta: 'Alta', media: 'Media' } as const;

/**
 * Lista de lotes y vencimientos tal como se ve en pantalla (la lista filtrada, de la más urgente a la menos): código,
 * lote, vencimiento, días, existencia (con ≈ si es proyección), prioridad, excedente de A1 y nota.
 */
export function reporteVencimientos(
  filas: readonly FilaVencimiento[],
  p: { filtro: string; hoy: FechaISO; ultimaCarga: FechaISO | null; resumen: ResumenVencimientos; umbrales: UmbralesVencimiento },
  e: Emisor,
): DatosReporte {
  const dias = (f: FilaVencimiento) => f.alerta?.diasParaVencer ?? Math.round((Date.parse(f.lote.vence) - Date.parse(p.hoy)) / 86_400_000);
  const proyectados = filas.filter((f) => f.lote.proyectado).length;
  return {
    titulo: 'Vencimientos y lotes',
    usuario: e.usuario,
    unidad: e.unidad,
    generadoEn: e.generadoEn,
    detalle: [
      `Lista: ${p.filtro}`,
      p.ultimaCarga ? `Última carga del reporte de lotes: ${fechaCorta(p.ultimaCarga)}` : 'Sin carga del reporte de lotes',
      `Prioridad alta: faltan ${p.umbrales.alta} días o menos, o no se consume a tiempo (A1) · Prioridad media: ${p.umbrales.media} días o menos`,
    ],
    columnas: ['Código', 'Descripción', 'Lote', 'Vence', 'Días', 'Existencia', 'Prioridad', 'Excedente (A1)', 'Nota'],
    filas: filas.map((f) => [
      f.lote.codigo,
      f.lote.descripcion,
      f.lote.lote,
      fechaCorta(f.lote.vence),
      dias(f),
      `${f.lote.proyectado ? '≈ ' : ''}${formatearEnUD(f.lote.cantidad, f.lote.ud)}`,
      f.alerta?.nivel ? ETIQUETA_NIVEL[f.alerta.nivel] : '—',
      f.alerta?.a1 ? formatearEnUD(f.alerta.a1.excedente, f.lote.ud) : '—',
      f.lote.estado === 'gestionado'
        ? `Gestionado${f.lote.gestion ? `: ${f.lote.gestion.motivo}` : ''}`
        : f.lote.proyectado
          ? `Proyectado desde el reporte del ${fechaCorta(f.lote.ultimaVez)}`
          : '',
    ]),
    columnasNumericas: [4],
    resumen: [
      `Lotes en esta lista: ${filas.length}`,
      `En todos los lotes con existencia: vencidos ${p.resumen.vencidos} · prioridad alta ${p.resumen.alta} · media ${p.resumen.media} · con A1 ${p.resumen.a1}`,
      ...(proyectados > 0 ? [`≈ = cantidad proyectada con el consumo diario promedio (${proyectados} lotes); el reporte de lotes la reemplaza por lo real.`] : []),
      ...(p.resumen.sinConsumo > 0 ? [`${p.resumen.sinConsumo} lotes son de productos sin consumo cargado: solo se evaluó la fecha (A2).`] : []),
    ],
    nombreArchivo: `vencimientos_${sufijoArchivo(p.hoy)}`,
  };
}

