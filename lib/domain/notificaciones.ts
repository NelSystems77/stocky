import { diaSemana, esDiaLaborable, sumarDias } from './calendario';
import { DIAS_NOMBRE, ocurrenciasProgramadas, type Programado, type Seguimiento } from './pedidosEnvios';
import { vistaHoy, type Cumplimiento, type Tarea } from './tareas';
import type { FechaISO } from './types';

/** Cada persona puede silenciar cada tipo de aviso en Ajustes. */
export interface AjustesNotificaciones {
  /** Resumen de las 7:00 a. m. */
  resumenManana: boolean;
  /** Resumen de las 12:00 m. d. */
  resumenMediodia: boolean;
  /** Recordatorio a la hora de cada tarea que tiene hora. */
  recordatorios: boolean;
  /** «Preparar envío / poner en trámite el pedido», según la anticipación de cada uno (7:00 a. m.). */
  pedidosEnvios: boolean;
}

export const AJUSTES_NOTIFICACIONES_INICIALES: AjustesNotificaciones = {
  resumenManana: true,
  resumenMediodia: true,
  recordatorios: true,
  pedidosEnvios: true,
};

export interface Aviso {
  /** Identifica el aviso del día; sirve para no enviarlo dos veces. */
  clave: string;
  titulo: string;
  cuerpo: string;
}

/** Tamaño de la franja con que corre el programador, en minutos. */
export const FRANJA_MIN = 5;

/** Días que se conserva la marca de un aviso enviado antes de que la política TTL de Firestore la borre. */
export const DIAS_VIGENCIA_AVISO = 14;

/**
 * Fecha en que caduca la marca de un aviso (campo `expiraEn`, base de la política TTL).
 * Debe quedar en el futuro: la marca evita avisos repetidos mientras dure su franja,
 * y un TTL sobre una fecha pasada la borraría al instante y reenviaría el aviso.
 */
export function expiraEnAviso(ahora: Date, dias: number = DIAS_VIGENCIA_AVISO): Date {
  return new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
}
export const HORA_RESUMEN_MANANA = '07:00';
export const HORA_RESUMEN_MEDIODIA = '12:00';

const aMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Redondea hacia abajo a la franja de 5 minutos: `07:03` → `07:00`. */
export function franjaDe(hhmm: string): string {
  const min = aMinutos(hhmm);
  const f = min - (min % FRANJA_MIN);
  return `${String(Math.floor(f / 60)).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}`;
}

/**
 * Qué avisos tocan en `franja` (`HH:mm` redondeada a 5 min). Nada fuera del calendario laboral
 * (lunes a viernes + segundo sábado, sin feriados) y nada de lo que la persona silenció.
 */
export function planificarAvisos(p: {
  tareas: readonly Tarea[];
  cumplimientos: readonly Cumplimiento[];
  hoy: FechaISO;
  franja: string;
  ajustes: AjustesNotificaciones;
  feriados?: readonly FechaISO[];
  /** Pedidos y envíos del 771; vacío para quien no los tiene. */
  programados?: readonly Programado[];
  seguimientos?: readonly Seguimiento[];
}): Aviso[] {
  const feriados = p.feriados ?? [];
  if (!esDiaLaborable(p.hoy, feriados)) return [];

  const vista = vistaHoy(p.tareas, p.cumplimientos, p.hoy, feriados);
  const avisos: Aviso[] = [];

  // Pedidos y envíos que vencen hoy o que hoy toca preparar (fechaAviso = hoy), solo los pendientes.
  const programadasHoy =
    p.franja === HORA_RESUMEN_MANANA && p.ajustes.pedidosEnvios && p.programados
      ? ocurrenciasProgramadas(p.programados, p.seguimientos ?? [], p.hoy, sumarDias(p.hoy, 21), feriados).filter(
          (o) => o.estado === 'pendiente' && o.fechaAviso === p.hoy,
        )
      : [];
  for (const o of programadasHoy) {
    const cuando = o.fecha === p.hoy ? 'hoy' : `el ${DIAS_NOMBRE[diaSemana(o.fecha)]} ${Number(o.fecha.slice(8))}`;
    avisos.push({
      clave: `${p.hoy}_programado_${o.programadoId}_${o.fecha}`,
      titulo: o.clase === 'envio' ? `Preparar envío · ${o.nombre.replace(/^Envío a /, '')}` : `Poner en trámite · ${o.nombre}`,
      cuerpo: o.clase === 'envio' ? `Sale ${cuando}.` : `Toca ${cuando}.`,
    });
  }

  if (p.franja === HORA_RESUMEN_MANANA && p.ajustes.resumenManana) {
    const partes = [
      vista.hoy.length > 0 ? `${plural(vista.hoy.length, 'tarea', 'tareas')} para hoy` : null,
      vista.atrasadas.length > 0 ? `${plural(vista.atrasadas.length, 'pendiente', 'pendientes')} de días anteriores` : null,
    ].filter(Boolean);
    if (partes.length > 0) {
      avisos.push({ clave: `${p.hoy}_resumen-manana`, titulo: 'Buenos días · Stocky', cuerpo: `${partes.join(' y ')}.` });
    }
  }

  if (p.franja === HORA_RESUMEN_MEDIODIA && p.ajustes.resumenMediodia && vista.hoy.length > 0) {
    const nombres = vista.hoy.slice(0, 3).map((o) => o.titulo).join(', ');
    const resto = vista.hoy.length > 3 ? ` y ${vista.hoy.length - 3} más` : '';
    avisos.push({
      clave: `${p.hoy}_resumen-mediodia`,
      titulo: `Te falta por hacer hoy: ${vista.hoy.length}`,
      cuerpo: `${nombres}${resto}.`,
    });
  }

  if (p.ajustes.recordatorios) {
    const ini = aMinutos(p.franja);
    for (const o of vista.hoy) {
      if (!o.hora) continue;
      const m = aMinutos(o.hora);
      if (m >= ini && m < ini + FRANJA_MIN) {
        avisos.push({
          clave: `${p.hoy}_tarea_${o.tareaId}_${o.fechaOrigen}`,
          titulo: `Recordatorio · ${o.hora}`,
          cuerpo: o.titulo,
        });
      }
    }
  }

  return avisos;
}
