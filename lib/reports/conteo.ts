import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatearCantidad, formatearDiferencia, resumenConteo, type FilaConteo } from '@/lib/domain/conteo';
import type { FechaISO } from '@/lib/domain/types';
import type { Emisor } from './construir';
import type { DatosReporte } from './tipos';

const fechaLarga = (f: FechaISO) => format(parseISO(f), "d 'de' MMMM yyyy", { locale: es });

const ESTADO: Record<FilaConteo['estado'], string> = { sinContar: 'Sin contar', coincide: 'Coincide', falta: 'Falta', sobra: 'Sobra' };

export interface MetaConteo {
  /** Día en que se hizo el conteo. */
  fecha: FechaISO;
  /** Fecha del reporte de SIFA usado como base. */
  fechaReporteSifa: FechaISO | null;
}

/**
 * Reporte del conteo físico (CLAUDE.md §13). Columnas: Código, Descripción, UD, SIFA, Contado, Diferencia, Observación.
 * Las filas con diferencia ≠ 0 van en gris (PDF) y con la diferencia en negrita; el signo `-` marca lo que falta.
 * `soloDiferencias` deja solo esas filas (el resumen sigue contando todo el conteo).
 */
export function reporteConteo(filas: readonly FilaConteo[], meta: MetaConteo, e: Emisor, soloDiferencias = false): DatosReporte {
  const r = resumenConteo(filas);
  const visibles = soloDiferencias ? filas.filter((f) => f.estado === 'falta' || f.estado === 'sobra') : filas;
  const detalle = [
    `Conteo del ${fechaLarga(meta.fecha)}`,
    meta.fechaReporteSifa ? `Existencias de SIFA según el reporte del ${fechaLarga(meta.fechaReporteSifa)}` : 'Existencias de SIFA según el último reporte importado',
  ];
  if (soloDiferencias) detalle.push('Solo productos con diferencia');

  const filasTabla = visibles.map((f) => [
    f.codigo,
    f.fueraDeSifa ? `${f.descripcion} (no está en SIFA)` : f.descripcion,
    f.ud,
    f.fueraDeSifa ? '—' : formatearCantidad(f.sifa, f.ud),
    formatearCantidad(f.contado, f.ud),
    // El Excel no admite colores de relleno: la palabra deja clara la diferencia aunque no se vea el gris.
    f.diferencia === null || f.diferencia === 0 ? formatearDiferencia(f.diferencia, f.ud) : `${formatearDiferencia(f.diferencia, f.ud)} (${ESTADO[f.estado].toLowerCase()})`,
    f.observacion,
  ]);

  return {
    titulo: 'Conteo físico contra SIFA',
    usuario: e.usuario,
    unidad: e.unidad,
    generadoEn: e.generadoEn,
    detalle,
    columnas: ['Código', 'Descripción', 'UD', 'SIFA', 'Contado', 'Diferencia', 'Observación'],
    filas: filasTabla,
    columnasNumericas: [3, 4, 5],
    filasResaltadas: visibles.flatMap((f, i) => (f.estado === 'falta' || f.estado === 'sobra' ? [i] : [])),
    columnasNegrita: [5],
    resumen: [
      `Productos contados: ${r.contados} de ${r.productos}${r.sinContar > 0 ? ` (${r.sinContar} sin contar)` : ''}`,
      `Con diferencia: ${r.conDiferencia}`,
      `Faltantes (-): ${r.faltantes}`,
      `Sobrantes (+): ${r.sobrantes}`,
    ],
    nombreArchivo: `conteo_${meta.fecha.replaceAll('-', '')}`,
  };
}
