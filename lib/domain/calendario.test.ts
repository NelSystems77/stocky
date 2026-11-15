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
