import { diaSemana, esDiaLaborable, sumarDias } from './calendario';
import { ocurreEn } from './recurrencia';
import type { DiaSemana, FechaISO, Recurrencia } from './types';

/** Un pedido (trámite) o un envío a un puesto (EBAIS). Ninguno maneja cantidades: solo recuerda el trámite. */
export type ClaseProgramado = 'pedido' | 'envio';

/** Recurrencias de tareas más «el último <día> del mes» (p. ej. último jueves: envío extra a R). */
export type Programacion = Recurrencia | { tipo: 'ultimoDiaSemana'; dia: DiaSemana };

export interface Programado {
  id: string;
  clase: ClaseProgramado;
  nombre: string;
  /** Puede tener varias (R: cada lunes y el último jueves). Una fecha que coincide en dos cuenta una sola vez. */
  recurrencias: Programacion[];
  /** Días hábiles antes de la fecha en que se avisa («Preparar envío…» / «Poner en trámite…»). 0 = el mismo día. */
  anticipacion: number;
  /** Pausado = `false`: no genera ocurrencias ni avisos. */
  activo: boolean;
  /** Primera fecha en que puede ocurrir. */
  desde: FechaISO;
  notas: string;
}

export const ANTICIPACION_ENVIO = 2;
export const ANTICIPACION_PEDIDO = 1;
export const ANTICIPACION_MAX = 10;

/** Estado de una ocurrencia sin registro = `pendiente`. */
export type EstadoSeguimiento = 'en_tramite' | 'enviado';
export type EstadoOcurrenciaProgramada = 'pendiente' | EstadoSeguimiento;

/** Lo que se hizo con UNA ocurrencia (programado + fecha). */
export interface Seguimiento {
  programadoId: string;
  fecha: FechaISO;
  estado: EstadoSeguimiento;
}

export interface OcurrenciaProgramada {
  programadoId: string;
  clase: ClaseProgramado;
  nombre: string;
  fecha: FechaISO;
  /** Día en que toca avisar: `anticipacion` días hábiles antes de `fecha`. */
  fechaAviso: FechaISO;
  estado: EstadoOcurrenciaProgramada;
  notas: string;
}

/** Cuántos días hacia atrás se muestran trámites sin cerrar. */
export const VENTANA_ATRASADOS = 7;
/** Cuántos días hacia adelante se muestran como «próximos». */
export const VENTANA_PROXIMOS = 7;

export const idSeguimiento = (programadoId: string, fecha: FechaISO): string => `${programadoId}_${fecha}`;

export const estaCerrada = (o: Pick<OcurrenciaProgramada, 'estado'>): boolean => o.estado === 'enviado';

/** Último día `dia` (0 = domingo … 6 = sábado) del mes de `fecha`. */
function ultimoDiaSemanaDelMes(fecha: FechaISO, dia: DiaSemana): FechaISO {
  const [y, m] = fecha.split('-').map(Number) as [number, number];
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  let f = `${y}-${mm}-${String(ultimoDia).padStart(2, '0')}`;
  while (diaSemana(f) !== dia) f = sumarDias(f, -1);
  return f;
}

/** ¿Ocurre esta programación en la fecha? Nada ocurre en días no laborables (feriados incluidos). */
export function ocurreProgramacion(p: Programacion, fecha: FechaISO, feriados: readonly FechaISO[] = []): boolean {
  if (p.tipo === 'ultimoDiaSemana') {
    return esDiaLaborable(fecha, feriados) && diaSemana(fecha) === p.dia && ultimoDiaSemanaDelMes(fecha, p.dia) === fecha;
  }
  return ocurreEn(p, fecha, feriados);
}

/** Resta `n` días hábiles a `fecha` (n = 0 devuelve la misma fecha). */
export function restarDiasHabiles(fecha: FechaISO, n: number, feriados: readonly FechaISO[] = []): FechaISO {
  let f = fecha;
  let restantes = n;
  for (let guarda = 0; restantes > 0 && guarda < 60; guarda++) {
    f = sumarDias(f, -1);
    if (esDiaLaborable(f, feriados)) restantes--;
  }
  return f;
}

/**
 * Ocurrencias de pedidos y envíos con fecha en [desde, hasta], con su estado.
 * Orden: fecha, envíos antes que pedidos, nombre.
 */
export function ocurrenciasProgramadas(
  programados: readonly Programado[],
  seguimientos: readonly Seguimiento[],
  desde: FechaISO,
  hasta: FechaISO,
  feriados: readonly FechaISO[] = [],
): OcurrenciaProgramada[] {
  const registro = new Map(seguimientos.map((s) => [idSeguimiento(s.programadoId, s.fecha), s.estado]));
  const lista: OcurrenciaProgramada[] = [];

  for (const p of programados) {
    if (!p.activo) continue;
    const inicio = p.desde > desde ? p.desde : desde;
    for (let f = inicio; f <= hasta; f = sumarDias(f, 1)) {
      if (!p.recurrencias.some((r) => ocurreProgramacion(r, f, feriados))) continue;
      lista.push({
        programadoId: p.id,
        clase: p.clase,
        nombre: p.nombre,
        fecha: f,
        fechaAviso: restarDiasHabiles(f, p.anticipacion, feriados),
        estado: registro.get(idSeguimiento(p.id, f)) ?? 'pendiente',
        notas: p.notas,
      });
    }
  }

  return lista.toSorted(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.clase.localeCompare(b.clase) || a.nombre.localeCompare(b.nombre),
  );
}

export interface VistaPedidosEnvios {
  /** Para hoy y sin cerrar. */
  hoy: OcurrenciaProgramada[];
  /** De días anteriores (hasta `VENTANA_ATRASADOS`) y sin cerrar. */
  atrasados: OcurrenciaProgramada[];
  /** En los próximos `VENTANA_PROXIMOS` días y sin cerrar; `preparar` = ya toca avisar. */
  proximos: (OcurrenciaProgramada & { preparar: boolean })[];
  cerradosHoy: OcurrenciaProgramada[];
}

export function vistaPedidosEnvios(
  programados: readonly Programado[],
  seguimientos: readonly Seguimiento[],
  hoy: FechaISO,
  feriados: readonly FechaISO[] = [],
): VistaPedidosEnvios {
  const todas = ocurrenciasProgramadas(
    programados,
    seguimientos,
    sumarDias(hoy, -VENTANA_ATRASADOS),
    sumarDias(hoy, VENTANA_PROXIMOS),
    feriados,
  );
  return {
    hoy: todas.filter((o) => o.fecha === hoy && !estaCerrada(o)),
    atrasados: todas.filter((o) => o.fecha < hoy && !estaCerrada(o)),
    proximos: todas.filter((o) => o.fecha > hoy && !estaCerrada(o)).map((o) => ({ ...o, preparar: o.fechaAviso <= hoy })),
    cerradosHoy: todas.filter((o) => o.fecha === hoy && estaCerrada(o)),
  };
}

/** Cuántos requieren atención ya: los de hoy, los atrasados y los próximos que ya toca preparar. */
export function contarPendientes(v: VistaPedidosEnvios): number {
  return v.hoy.length + v.atrasados.length + v.proximos.filter((p) => p.preparar).length;
}

/** Estados a los que se puede pasar desde el actual: un envío no «entra en trámite», solo se envía. */
export function siguienteEstado(clase: ClaseProgramado, actual: EstadoOcurrenciaProgramada): EstadoSeguimiento | null {
  if (actual === 'enviado') return null;
  if (clase === 'pedido' && actual === 'pendiente') return 'en_tramite';
  return 'enviado';
}

export const ETIQUETA_ESTADO: Record<EstadoOcurrenciaProgramada, string> = {
  pendiente: 'Pendiente',
  en_tramite: 'En trámite',
  enviado: 'Enviado',
};

export function etiquetaAccion(clase: ClaseProgramado, actual: EstadoOcurrenciaProgramada): string | null {
  const sig = siguienteEstado(clase, actual);
  if (sig === null) return null;
  return sig === 'en_tramite' ? 'Poner en trámite' : 'Marcar enviado';
}

export const DIAS_NOMBRE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

/** Descripción corta de la periodicidad, para listas. */
export function describirProgramacion(p: Programacion): string {
  switch (p.tipo) {
    case 'ultimoDiaSemana':
      return `el último ${DIAS_NOMBRE[p.dia]} del mes`;
    case 'diasSemana':
      return p.dias.length === 0 ? 'sin días' : `los ${[...p.dias].sort((a, b) => a - b).map((d) => DIAS_PLURAL[d]).join(', ')}`;
    case 'quincenal':
      return `cada 2 semanas (${DIAS_PLURAL[diaSemana(p.ancla)]})`;
    case 'mensual':
      return `el día ${p.diaMes} de cada mes`;
    case 'segundoSabado':
      return 'cada segundo sábado';
    case 'diaria':
      return 'todos los días laborables';
    case 'unica':
      return `una vez · ${p.fecha}`;
  }
}

export function describirProgramado(p: Pick<Programado, 'recurrencias'>): string {
  return p.recurrencias.length === 0 ? 'Sin periodicidad' : p.recurrencias.map(describirProgramacion).join(' y ');
}

/** Valida lo que escribe la persona. */
export function validarProgramado(e: { nombre: string; recurrencias: readonly Programacion[]; anticipacion: number }):
  | { ok: true }
  | { ok: false; error: string } {
  if (e.nombre.trim() === '') return { ok: false, error: 'Escribe el nombre.' };
  if (e.recurrencias.length === 0) return { ok: false, error: 'Elige cuándo se repite.' };
  if (e.recurrencias.some((r) => r.tipo === 'diasSemana' && r.dias.length === 0)) return { ok: false, error: 'Elige al menos un día.' };
  if (!Number.isInteger(e.anticipacion) || e.anticipacion < 0 || e.anticipacion > ANTICIPACION_MAX) {
    return { ok: false, error: `La anticipación va de 0 a ${ANTICIPACION_MAX} días hábiles.` };
  }
  return { ok: true };
}

/**
 * Precargados (RF-4.1, RF-5.1) con los días confirmados por la persona usuaria el 2026-11-20.
 * IDs fijos para que sembrarlos dos veces no duplique. Los otros tipos del PRD (rayos X, odontología, laboratorio,
 * vacunas, psicotrópicos, bajos) no tienen día confirmado: no se inventan; se agregan a mano.
 */
export function programadosSugeridos(hoy: FechaISO): Programado[] {
  const base = { activo: true, desde: hoy, notas: '' } as const;
  const envio = { ...base, clase: 'envio', anticipacion: ANTICIPACION_ENVIO } as const;
  const pedido = { ...base, clase: 'pedido', anticipacion: ANTICIPACION_PEDIDO } as const;
  return [
    {
      ...envio,
      id: 'sug-envio-r',
      nombre: 'Envío a Rancho Redondo (R)',
      recurrencias: [
        { tipo: 'diasSemana', dias: [1] },
        { tipo: 'ultimoDiaSemana', dia: 4 },
      ],
    },
    { ...envio, id: 'sug-envio-c', nombre: 'Envío a Cascajal (C)', recurrencias: [{ tipo: 'diasSemana', dias: [2] }] },
    { ...envio, id: 'sug-envio-v', nombre: 'Envío a Vista de Mar (V)', recurrencias: [{ tipo: 'diasSemana', dias: [3] }] },
    { ...envio, id: 'sug-envio-z', nombre: 'Envío a Zetillal (Z)', recurrencias: [{ tipo: 'diasSemana', dias: [3] }] },
    { ...pedido, id: 'sug-pedido-772', nombre: 'Pedido semanal 772', recurrencias: [{ tipo: 'diasSemana', dias: [3] }] },
    { ...pedido, id: 'sug-pedido-sueros', nombre: 'Pedido de sueros', recurrencias: [{ tipo: 'diasSemana', dias: [4] }] },
  ];
}
