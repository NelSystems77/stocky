import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { diasAgotado, separarRegistros, type RegistroAgotado } from '@/lib/domain/agotados';
import { danadosDelMes, ETIQUETA_MOTIVO, MOTIVOS_DANADO, ordenarDanados, totalesDanados, type RegistroDanado } from '@/lib/domain/danados';
import { formatearEnUD, formatearNumero } from '@/lib/domain/formato';
import { seSolapa } from '@/lib/domain/periodos';
import { ordenarPreconteos, preconteosDelMes, totalesPreconteo, type RegistroPreconteo } from '@/lib/domain/preconteo';
import { ETIQUETA_SECCION, SECCIONES_RESUMEN, type SeccionResumen } from '@/lib/domain/resumenSecciones';
import type { Ocurrencia } from '@/lib/domain/tareas';
import {
  ETIQUETA_ESTADO_TRASLADO,
  ETIQUETA_TIPO_TRASLADO,
  ordenarTraslados,
  totalesTraslados,
  trasladosDelMes,
  type RegistroTraslado,
} from '@/lib/domain/traslados';
import type { FechaISO } from '@/lib/domain/types';
import { ordenarVencidos, totalesVencidos, vencidosDelMes, type RegistroVencido } from '@/lib/domain/vencidos';
import type { Emisor } from './construir';
import type { DatosResumen, SeccionReporte } from './tipos';

/** Todo lo que el resumen puede necesitar. Cada sección usa solo lo suyo. */
export interface DatosMes {
  /** `YYYY-MM`. */
  mes: string;
  /** Hoy, o el último día del mes si ya pasó: los días futuros no cuentan como «sin hacer». */
  hasta: FechaISO;
  /** Ocurrencias de tareas del mes (hasta `hasta`). */
  ocurrencias: readonly Ocurrencia[];
  preconteos: readonly RegistroPreconteo[];
  traslados: readonly RegistroTraslado[];
  danados: readonly RegistroDanado[];
  vencidos: readonly RegistroVencido[];
  agotados: readonly RegistroAgotado[];
  descripciones: ReadonlyMap<string, string>;
  /** UD por código; sin ella la cantidad se muestra en unidades. */
  uds: ReadonlyMap<string, string>;
}

const fechaCorta = (f: FechaISO) => format(parseISO(f), 'd MMM yyyy', { locale: es });
const desc = (d: DatosMes, codigo: string) => d.descripciones.get(codigo) ?? '—';
const cant = (d: DatosMes, codigo: string, base: number) => {
  const ud = d.uds.get(codigo);
  return ud ? formatearEnUD(base, ud) : `${formatearNumero(base)} u.`;
};

export function inicioFinMes(mes: string): { desde: FechaISO; hasta: FechaISO } {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

function seccionTareas(d: DatosMes): SeccionReporte {
  const porTarea = new Map<string, { hechas: number; pospuestas: number; descartadas: number; sinHacer: number }>();
  for (const o of d.ocurrencias) {
    const f = porTarea.get(o.titulo) ?? { hechas: 0, pospuestas: 0, descartadas: 0, sinHacer: 0 };
    if (o.estado === 'hecha') f.hechas++;
    else if (o.estado === 'pospuesta') f.pospuestas++;
    else if (o.estado === 'descartada') f.descartadas++;
    else f.sinHacer++;
    porTarea.set(o.titulo, f);
  }
  const filas = [...porTarea.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([titulo, f]) => [titulo, f.hechas, f.pospuestas, f.descartadas, f.sinHacer]);
  const tot = [...porTarea.values()].reduce(
    (s, f) => ({ hechas: s.hechas + f.hechas, pospuestas: s.pospuestas + f.pospuestas, descartadas: s.descartadas + f.descartadas, sinHacer: s.sinHacer + f.sinHacer }),
    { hechas: 0, pospuestas: 0, descartadas: 0, sinHacer: 0 },
  );
  const total = tot.hechas + tot.pospuestas + tot.descartadas + tot.sinHacer;
  return {
    titulo: ETIQUETA_SECCION.tareas,
    columnas: ['Tarea', 'Hechas', 'Pospuestas', 'Descartadas', 'Sin hacer'],
    filas,
    columnasNumericas: [1, 2, 3, 4],
    resumen:
      total === 0
        ? []
        : [
            `Ocurrencias: ${total} · hechas ${tot.hechas} · pospuestas ${tot.pospuestas} · descartadas ${tot.descartadas} · sin hacer ${tot.sinHacer}`,
            `Cumplimiento: ${Math.round((tot.hechas / total) * 100)} %`,
          ],
  };
}

function seccionPreconteo(d: DatosMes): SeccionReporte {
  const delMes = ordenarPreconteos(preconteosDelMes(d.preconteos, d.mes));
  const t = totalesPreconteo(delMes);
  return {
    titulo: ETIQUETA_SECCION.preconteo,
    columnas: ['Código', 'Descripción', 'Presentación', 'Entregado', 'Recibido', 'Sin recibir'],
    filas: t.porProducto.map((p) => [p.codigo, desc(d, p.codigo), `de a ${p.presentacion}`, cant(d, p.codigo, p.entregado), cant(d, p.codigo, p.recibido), p.pendientes]),
    columnasNumericas: [3, 4, 5],
    resumen: t.entregas === 0 ? [] : [`Entregas: ${t.entregas} · sin recibir ${t.pendientes} · con diferencia ${t.conDiferencia}`],
  };
}

function seccionTraslados(d: DatosMes): SeccionReporte {
  const delMes = ordenarTraslados(trasladosDelMes(d.traslados, d.mes));
  const t = totalesTraslados(delMes);
  return {
    titulo: ETIQUETA_SECCION.traslados,
    columnas: ['Orden SAP', 'Tipo', 'Unidad', 'Fecha', 'Estado', 'Productos', 'SAP', 'SIFA'],
    filas: delMes.map((r) => [
      r.ordenSAP,
      ETIQUETA_TIPO_TRASLADO[r.tipo],
      r.unidad,
      fechaCorta(r.fecha),
      ETIQUETA_ESTADO_TRASLADO[r.estado],
      r.items.length,
      r.enSAP ? 'Sí' : 'No',
      r.enSIFA ? 'Sí' : 'No',
    ]),
    columnasNumericas: [5],
    resumen:
      t.total === 0
        ? []
        : [
            `Traslados: ${t.total} · enviados ${t.enviados} · recibidos ${t.recibidos} · pendientes ${t.pendientes}`,
            `Trámite SAP/SIFA sin completar: ${t.tramitePendiente}`,
          ],
  };
}

function seccionDanados(d: DatosMes): SeccionReporte {
  const delMes = ordenarDanados(danadosDelMes(d.danados, d.mes));
  const t = totalesDanados(delMes);
  return {
    titulo: ETIQUETA_SECCION.danados,
    columnas: ['Fecha', 'Código', 'Descripción', 'Lote', 'Cantidad', 'Motivo'],
    filas: delMes.map((r) => [fechaCorta(r.fecha), r.codigo, desc(d, r.codigo), r.lote || '—', cant(d, r.codigo, r.cantidad), ETIQUETA_MOTIVO[r.motivo]]),
    columnasNumericas: [4],
    resumen:
      t.registros === 0
        ? []
        : [
            `Registros: ${t.registros} · productos distintos: ${t.porProducto.length}`,
            MOTIVOS_DANADO.map((m) => `${ETIQUETA_MOTIVO[m]}: ${formatearNumero(t.porMotivo[m])} u.`).join(' · '),
          ],
  };
}

function seccionVencidos(d: DatosMes): SeccionReporte {
  const delMes = ordenarVencidos(vencidosDelMes(d.vencidos, d.mes));
  const t = totalesVencidos(delMes);
  return {
    titulo: ETIQUETA_SECCION.vencidos,
    columnas: ['Fecha', 'Código', 'Descripción', 'Lote', 'Venció', 'Cantidad'],
    filas: delMes.map((r) => [fechaCorta(r.fecha), r.codigo, desc(d, r.codigo), r.lote, fechaCorta(r.fechaVencimiento), cant(d, r.codigo, r.cantidad)]),
    columnasNumericas: [5],
    resumen: t.registros === 0 ? [] : [`Lotes vencidos: ${t.registros} · productos distintos: ${t.productos}`],
  };
}

function seccionAgotados(d: DatosMes): SeccionReporte {
  const { desde, hasta } = inicioFinMes(d.mes);
  const enMes = d.agotados.filter((r) => seSolapa(r.fechaAgotado, r.fechaIngreso, { desde, hasta }));
  const { activos, cerrados } = separarRegistros(enMes);
  const ordenados = [...activos, ...[...cerrados].sort((a, b) => a.fechaAgotado.localeCompare(b.fechaAgotado))];
  return {
    titulo: ETIQUETA_SECCION.agotados,
    columnas: ['Código', 'Descripción', 'Agotado desde', 'Ingreso', 'Días agotado'],
    filas: ordenados.map((r) => [r.codigo, desc(d, r.codigo), fechaCorta(r.fechaAgotado), r.fechaIngreso ? fechaCorta(r.fechaIngreso) : 'Sigue agotado', diasAgotado(r, d.hasta)]),
    columnasNumericas: [4],
    resumen: enMes.length === 0 ? [] : [`Productos: ${enMes.length} · siguen agotados ${activos.length} · reabastecidos ${cerrados.length}`],
  };
}

const CONSTRUCTORES: Record<SeccionResumen, (d: DatosMes) => SeccionReporte> = {
  tareas: seccionTareas,
  preconteo: seccionPreconteo,
  traslados: seccionTraslados,
  danados: seccionDanados,
  vencidos: seccionVencidos,
  agotados: seccionAgotados,
};

/**
 * Resumen mensual de labores (PRD §7) con solo las secciones elegidas, en el orden fijo del resumen.
 * Una sección sin registros se conserva (se muestra «Sin registros»): solo se omite lo que la persona desmarca.
 */
export function reporteResumenMensual(d: DatosMes, secciones: readonly SeccionResumen[], e: Emisor): DatosResumen {
  const mesTexto = format(parseISO(`${d.mes}-01`), 'MMMM yyyy', { locale: es });
  const ordenadas = SECCIONES_RESUMEN.filter((s) => secciones.includes(s));
  return {
    titulo: 'Resumen mensual de labores',
    usuario: e.usuario,
    unidad: e.unidad,
    generadoEn: e.generadoEn,
    detalle: [`Mes: ${mesTexto}`, `Secciones: ${ordenadas.map((s) => ETIQUETA_SECCION[s]).join(', ')}`],
    secciones: ordenadas.map((s) => CONSTRUCTORES[s](d)),
    nombreArchivo: `resumen_labores_${d.mes.replace('-', '')}`,
  };
}
