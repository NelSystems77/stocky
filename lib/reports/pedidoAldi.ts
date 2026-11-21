import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatearNumero } from '@/lib/domain/formato';
import { etiquetaPeriodo, resumenPedidoAldi, type LineaAldi } from '@/lib/domain/pedidoAldi';
import type { FechaISO } from '@/lib/domain/types';
import { deUnidadesBase } from '@/lib/domain/unidades';
import type { Emisor } from './construir';
import type { DatosReporte } from './tipos';

const fechaLarga = (f: FechaISO) => format(parseISO(f), "d 'de' MMMM yyyy", { locale: es });

export interface MetaPedidoAldi {
  /** Día en que se hizo el pedido. */
  fecha: FechaISO;
  /** Fecha del reporte de SIFA del que salen las existencias. */
  fechaReporteSifa: FechaISO | null;
  factor: number;
  dias: number;
}

/**
 * Pedido al ALDI para PDF y Excel. Cuota, existencia y objetivo van en la UD del producto (sin repetir la sigla: tiene
 * su columna); «A pedir» es un entero en esa UD. Es una propuesta: el trámite se hace en SIFA/SAP.
 */
export function reportePedidoAldi(lineas: readonly LineaAldi[], m: MetaPedidoAldi, e: Emisor): DatosReporte {
  const r = resumenPedidoAldi(lineas);
  const enUD = (base: number, ud: string) => formatearNumero(deUnidadesBase(base, ud));
  return {
    titulo: 'Pedido al ALDI',
    usuario: e.usuario,
    unidad: e.unidad,
    generadoEn: e.generadoEn,
    detalle: [
      `Pedido del ${fechaLarga(m.fecha)} · ${etiquetaPeriodo(m.dias)} · factor ${formatearNumero(m.factor)}`,
      m.fechaReporteSifa ? `Existencias según el reporte de SIFA del ${fechaLarga(m.fechaReporteSifa)}` : 'Existencias según el último reporte de SIFA',
      'A pedir = cuota × factor × (días ÷ 30) − existencia, redondeado hacia arriba a la UD entera',
    ],
    columnas: ['Código', 'Descripción', 'UD', 'Cuota', 'Existencia', 'Objetivo', 'A pedir'],
    filas: lineas.map((l) => [l.codigo, l.descripcion, l.ud, enUD(l.cuota, l.ud), enUD(l.existencia, l.ud), enUD(l.objetivo, l.ud), l.cantidad]),
    columnasNumericas: [3, 4, 5, 6],
    resumen: [
      `Productos a pedir: ${r.productos}`,
      ...(r.ajustadas > 0 ? [`Cantidades ajustadas a mano: ${r.ajustadas}`] : []),
      'Es una propuesta: el pedido se tramita en SIFA/SAP.',
    ],
    nombreArchivo: `pedido_aldi_${m.fecha.replaceAll('-', '')}`,
  };
}
