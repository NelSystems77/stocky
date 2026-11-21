import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { resumenBajosRiesgo, type FilaBajosRiesgo, type PrioridadBajosRiesgo } from '@/lib/domain/bajosRiesgo';
import { formatearEnUD, formatearNumero } from '@/lib/domain/formato';
import type { FechaISO } from '@/lib/domain/types';
import type { Emisor } from './construir';
import type { DatosReporte } from './tipos';

const ETIQUETA: Record<PrioridadBajosRiesgo, string> = { critico: 'Crítico', riesgo: 'En riesgo', bajo: 'Bajo' };

const fechaCorta = (f: FechaISO) => format(parseISO(f), 'd MMM yyyy', { locale: es });

/**
 * Reporte «Bajos y riesgo» al día (PRD §7): productos en A3 (crítico), A4 (en riesgo) y A5 (bajo cuota mínima).
 * `hayConsumos` en `false` avisa que, sin el reporte «Productos en despacho», solo se pudieron listar los bajos.
 */
export function reporteBajosYRiesgo(
  filas: readonly FilaBajosRiesgo[],
  p: { fechaReporte: FechaISO | null; margen: number; hayConsumos: boolean },
  e: Emisor,
  hoy: FechaISO,
): DatosReporte {
  const r = resumenBajosRiesgo(filas);
  return {
    titulo: 'Bajos y riesgo de agotamiento',
    usuario: e.usuario,
    unidad: e.unidad,
    generadoEn: e.generadoEn,
    detalle: [
      p.fechaReporte ? `Existencias según el reporte de SIFA del ${fechaCorta(p.fechaReporte)}` : 'Existencias según el último reporte de SIFA',
      `Crítico: no alcanza hasta el próximo ingreso · En riesgo: alcanza, con menos de ${p.margen} días hábiles de sobra · Bajo: existencia menor que la cuota mínima`,
    ],
    columnas: ['Código', 'Descripción', 'Prioridad', 'Existencia', 'Cuota mínima', 'Alcanza (días hábiles)', 'Ingreso en (días)', 'Nota'],
    filas: filas.map((f) => [
      f.producto.codigo,
      f.producto.descripcion,
      ETIQUETA[f.prioridad],
      formatearEnUD(f.producto.existencia ?? 0, f.producto.ud),
      f.producto.cuotaMinima ? formatearEnUD(f.producto.cuotaMinima, f.producto.ud) : '—',
      f.cobertura === null ? '—' : formatearNumero(Math.floor(f.cobertura)),
      f.diasAlIngreso === null ? '—' : formatearNumero(f.diasAlIngreso),
      f.bajoMinima && f.prioridad !== 'bajo' ? 'También bajo cuota mínima' : '',
    ]),
    columnasNumericas: [3, 4, 5, 6],
    resumen: [
      `Productos en el reporte: ${r.total}`,
      `Críticos: ${r.criticos} · En riesgo: ${r.enRiesgo} · Bajos: ${r.bajos}`,
      ...(r.tambienBajos > 0 ? [`${r.tambienBajos} de los críticos o en riesgo también están bajo la cuota mínima.`] : []),
      'Los agotados (existencia 0) van en el reporte de agotados.',
      ...(p.hayConsumos ? [] : ['No hay consumos cargados: el riesgo no se pudo calcular y solo se listan los productos bajos. Importa el reporte «Productos en despacho».']),
    ],
    nombreArchivo: `bajos_y_riesgo_${(p.fechaReporte ?? hoy).replaceAll('-', '')}`,
  };
}
