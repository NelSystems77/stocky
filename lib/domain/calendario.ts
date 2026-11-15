import type { FechaISO } from './types';

export const ZONA = 'America/Costa_Rica';

const MS_DIA = 86_400_000;

function aUTC(fecha: FechaISO): number {
  const [y, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function deUTC(ms: number): FechaISO {
  return new Date(ms).toISOString().slice(0, 10);
}

export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  return deUTC(aUTC(fecha) + dias * MS_DIA);
}

export function diaSemana(fecha: FechaISO): number {
  return new Date(aUTC(fecha)).getUTCDay();
}

/** Fecha de hoy en Costa Rica (UTC−6, sin horario de verano). */
export function hoyCostaRica(ahora: Date = new Date()): FechaISO {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Segundo sábado del mes (`mes` de 1 a 12): día de ingreso de mercadería. */
export function segundoSabado(anio: number, mes: number): FechaISO {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  const primerSabado = 1 + ((6 - primero + 7) % 7);
  return deUTC(Date.UTC(anio, mes - 1, primerSabado + 7));
}

export function esSegundoSabado(fecha: FechaISO): boolean {
  const [y, m] = fecha.split('-').map(Number) as [number, number];
  return fecha === segundoSabado(y, m);
}

/** Lunes a viernes + segundo sábado del mes, menos feriados configurados. */
export function esDiaLaborable(fecha: FechaISO, feriados: readonly FechaISO[] = []): boolean {
  if (feriados.includes(fecha)) return false;
  const d = diaSemana(fecha);
  if (d >= 1 && d <= 5) return true;
  return d === 6 && esSegundoSabado(fecha);
}

/** Próximo ingreso: segundo sábado del mes actual si no ha pasado; si no, el del mes siguiente. */
export function proximoIngreso(hoy: FechaISO): FechaISO {
  const [y, m] = hoy.split('-').map(Number) as [number, number];
  const actual = segundoSabado(y, m);
  if (actual >= hoy) return actual;
  return m === 12 ? segundoSabado(y + 1, 1) : segundoSabado(y, m + 1);
}

/** Días hábiles en el rango cerrado [desde, hasta]. 0 si el rango está invertido. */
export function diasHabilesEntre(desde: FechaISO, hasta: FechaISO, feriados: readonly FechaISO[] = []): number {
  let n = 0;
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    if (esDiaLaborable(f, feriados)) n++;
  }
  return n;
}

/** Días hábiles desde mañana hasta el próximo ingreso (inclusive). Sirve para comparar contra la cobertura. */
export function diasHabilesAlIngreso(hoy: FechaISO, feriados: readonly FechaISO[] = []): number {
  return diasHabilesEntre(sumarDias(hoy, 1), proximoIngreso(hoy), feriados);
}

/** Siguiente día laborable estrictamente posterior a `fecha` (para «posponer a mañana»). */
export function siguienteDiaLaborable(fecha: FechaISO, feriados: readonly FechaISO[] = []): FechaISO {
  let f = sumarDias(fecha, 1);
  for (let i = 0; i < 14 && !esDiaLaborable(f, feriados); i++) f = sumarDias(f, 1);
  return f;
}

/** Lunes de la semana que contiene `fecha` (la semana laboral empieza en lunes). */
export function inicioSemana(fecha: FechaISO): FechaISO {
  const d = diaSemana(fecha);
  return sumarDias(fecha, d === 0 ? -6 : 1 - d);
}

/** Rango de la cuadrícula de un mes: del lunes anterior (o igual) al día 1, hasta el domingo posterior al último día. */
export function rangoCuadriculaMes(anio: number, mes: number): { desde: FechaISO; hasta: FechaISO } {
  const primero = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = deUTC(Date.UTC(anio, mes, 0));
  return { desde: inicioSemana(primero), hasta: sumarDias(inicioSemana(ultimo), 6) };
}
