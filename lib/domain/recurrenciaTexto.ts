import { diaSemana } from './calendario';
import type { Recurrencia } from './types';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Descripción corta y legible de una recurrencia, para listas. */
export function describirRecurrencia(r: Recurrencia): string {
  switch (r.tipo) {
    case 'unica':
      return `Una vez · ${r.fecha}`;
    case 'diaria':
      return 'Todos los días laborables';
    case 'diasSemana': {
      const dias = [...r.dias].sort((a, b) => a - b).map((d) => DIAS_CORTOS[d]);
      return dias.length === 0 ? 'Sin días' : `Cada ${dias.join(', ')}`;
    }
    case 'quincenal':
      return `Cada 2 semanas (${DIAS[diaSemana(r.ancla)]})`;
    case 'mensual':
      return `Cada mes, el día ${r.diaMes}`;
    case 'segundoSabado':
      return 'Cada segundo sábado';
    case 'tercerJueves':
      return 'Cada tercer jueves del mes';
    case 'tercerJuevesMas15':
      return '15 días después del tercer jueves';
  }
}
