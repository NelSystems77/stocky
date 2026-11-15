import { describe, expect, it } from 'vitest';
import {
  diasHabilesAlIngreso, diasHabilesEntre, esDiaLaborable, hoyCostaRica, proximoIngreso, segundoSabado,
} from './calendario';

describe('segundoSabado', () => {
  it('calcula el segundo sábado', () => {
    expect(segundoSabado(2026, 11)).toBe('2026-11-14');
    expect(segundoSabado(2026, 8)).toBe('2026-08-08'); // el 1 es sábado
    expect(segundoSabado(2026, 2)).toBe('2026-02-14');
  });
});

describe('esDiaLaborable', () => {
  it('lunes a viernes y segundo sábado', () => {
    expect(esDiaLaborable('2026-11-16')).toBe(true); // lunes
    expect(esDiaLaborable('2026-11-14')).toBe(true); // segundo sábado
    expect(esDiaLaborable('2026-11-07')).toBe(false); // primer sábado
    expect(esDiaLaborable('2026-11-15')).toBe(false); // domingo
  });
  it('respeta feriados', () => {
    expect(esDiaLaborable('2026-12-25', ['2026-12-25'])).toBe(false);
  });
});

describe('proximoIngreso', () => {
  it('usa el del mes actual si no ha pasado (incluye el mismo día)', () => {
    expect(proximoIngreso('2026-11-10')).toBe('2026-11-14');
    expect(proximoIngreso('2026-11-14')).toBe('2026-11-14');
  });
  it('pasa al mes siguiente y cruza el año', () => {
    expect(proximoIngreso('2026-11-15')).toBe('2026-12-12');
    expect(proximoIngreso('2026-12-20')).toBe('2027-01-09');
  });
});

describe('días hábiles', () => {
  it('cuenta lunes a viernes + segundo sábado', () => {
    expect(diasHabilesEntre('2026-11-09', '2026-11-15')).toBe(6); // L-V + sábado 14
    expect(diasHabilesEntre('2026-11-16', '2026-11-10')).toBe(0);
  });
  it('días hábiles hasta el ingreso', () => {
    // desde el lunes 9 → mar 10, mié 11, jue 12, vie 13, sáb 14
    expect(diasHabilesAlIngreso('2026-11-09')).toBe(5);
  });
});

describe('hoyCostaRica', () => {
  it('usa UTC−6', () => {
    expect(hoyCostaRica(new Date('2026-11-15T03:00:00Z'))).toBe('2026-11-14');
    expect(hoyCostaRica(new Date('2026-11-15T06:00:00Z'))).toBe('2026-11-15');
  });
});

import { inicioSemana, rangoCuadriculaMes } from './calendario';
import { describirRecurrencia } from './recurrenciaTexto';

describe('semana y cuadrícula de mes', () => {
  it('la semana empieza en lunes (el domingo pertenece a la semana anterior)', () => {
    expect(inicioSemana('2026-11-12')).toBe('2026-11-09'); // jueves
    expect(inicioSemana('2026-11-09')).toBe('2026-11-09'); // lunes
    expect(inicioSemana('2026-11-15')).toBe('2026-11-09'); // domingo
  });
  it('cuadrícula de noviembre 2026: lun 26-oct a dom 6-dic', () => {
    expect(rangoCuadriculaMes(2026, 11)).toEqual({ desde: '2026-10-26', hasta: '2026-12-06' });
  });
});

describe('describirRecurrencia', () => {
  it('describe cada tipo', () => {
    expect(describirRecurrencia({ tipo: 'diaria' })).toBe('Todos los días laborables');
    expect(describirRecurrencia({ tipo: 'diasSemana', dias: [5, 1, 3] })).toBe('Cada lun, mié, vie');
    expect(describirRecurrencia({ tipo: 'quincenal', dia: 4, ancla: '2026-11-12' })).toBe('Cada 2 semanas (jueves)');
    expect(describirRecurrencia({ tipo: 'mensual', diaMes: 15 })).toBe('Cada mes, el día 15');
    expect(describirRecurrencia({ tipo: 'segundoSabado' })).toBe('Cada segundo sábado');
  });
});
