import { diaSemana, esDiaLaborable, laborableDesde, sumarDias, tercerJueves } from './calendario';
import type { FechaISO, Recurrencia } from './types';

function diffDias(a: FechaISO, b: FechaISO): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/** Fecha efectiva de una tarea mensual: el día pedido o, si no es laborable, el siguiente día laborable del mes. */
function fechaMensual(anio: number, mes: number, diaMes: number, feriados: readonly FechaISO[]): FechaISO | null {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  let dia = Math.min(Math.max(diaMes, 1), ultimo);
  const mm = String(mes).padStart(2, '0');
  for (; dia <= ultimo; dia++) {
    const f = `${anio}-${mm}-${String(dia).padStart(2, '0')}`;
    if (esDiaLaborable(f, feriados)) return f;
  }
  return null;
}

/**
 * ¿Es `fecha` la fecha efectiva de algo que cae `desfase` días después del tercer jueves del mes?
 * Si esa fecha no es laborable pasa al siguiente día laborable, que puede ser del mes siguiente: por eso se
 * revisa también el mes anterior.
 */
function esTercerJuevesMas(fecha: FechaISO, desfase: number, feriados: readonly FechaISO[]): boolean {
  const [y, m] = fecha.split('-').map(Number) as [number, number];
  const anterior: [number, number] = m === 1 ? [y - 1, 12] : [y, m - 1];
  return [anterior, [y, m] as [number, number]].some(([a, mes]) => laborableDesde(sumarDias(tercerJueves(a, mes), desfase), feriados) === fecha);
}

/**
 * ¿Ocurre la recurrencia en esta fecha? Nada ocurre fuera del calendario laboral:
 * las semanales/quincenales que caen en feriado se omiten; las mensuales se corren al siguiente día laborable.
 * Las tareas únicas respetan la fecha elegida por la persona.
 */
export function ocurreEn(rec: Recurrencia, fecha: FechaISO, feriados: readonly FechaISO[] = []): boolean {
  if (rec.tipo === 'unica') return rec.fecha === fecha;
  if (!esDiaLaborable(fecha, feriados)) return false;
  switch (rec.tipo) {
    case 'diaria':
      return true;
    case 'diasSemana':
      return rec.dias.includes(diaSemana(fecha) as 0);
    case 'quincenal':
      return diaSemana(fecha) === rec.dia && diffDias(fecha, rec.ancla) % 14 === 0;
    case 'segundoSabado':
      return diaSemana(fecha) === 6;
    case 'tercerJueves':
      return esTercerJuevesMas(fecha, 0, feriados);
    case 'tercerJuevesMas15':
      return esTercerJuevesMas(fecha, 15, feriados);
    case 'mensual': {
      const [y, m] = fecha.split('-').map(Number) as [number, number];
      return fechaMensual(y, m, rec.diaMes, feriados) === fecha;
    }
  }
}

/** Próxima fecha (desde `desde`, inclusive) en que ocurre la recurrencia; `null` si no hay en 400 días. */
export function proximaOcurrencia(rec: Recurrencia, desde: FechaISO, feriados: readonly FechaISO[] = []): FechaISO | null {
  for (let i = 0; i <= 400; i++) {
    const f = sumarDias(desde, i);
    if (ocurreEn(rec, f, feriados)) return f;
  }
  return null;
}
