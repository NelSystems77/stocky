import { describe, expect, it } from 'vitest';
import { rangoPeriodo, seSolapa } from './periodos';

describe('rangoPeriodo', () => {
  it('semana: del lunes a hoy', () => {
    expect(rangoPeriodo('semana', '2026-11-12')).toEqual({ desde: '2026-11-09', hasta: '2026-11-12' }); // jueves
    expect(rangoPeriodo('semana', '2026-11-09')).toEqual({ desde: '2026-11-09', hasta: '2026-11-09' }); // lunes
    expect(rangoPeriodo('semana', '2026-11-15')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' }); // domingo
  });
  it('mes: del día 1 a hoy', () => {
    expect(rangoPeriodo('mes', '2026-11-12')).toEqual({ desde: '2026-11-01', hasta: '2026-11-12' });
  });
  it('personalizado: usa las fechas y las acomoda si vienen invertidas', () => {
    expect(rangoPeriodo('personalizado', '2026-11-12', '2026-10-01', '2026-10-31')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoPeriodo('personalizado', '2026-11-12', '2026-10-31', '2026-10-01')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
  });
  it('personalizado sin fechas completas no hay período', () => {
    expect(rangoPeriodo('personalizado', '2026-11-12')).toBeNull();
    expect(rangoPeriodo('personalizado', '2026-11-12', '2026-10-01')).toBeNull();
  });
});

describe('seSolapa', () => {
  const p = { desde: '2026-11-01', hasta: '2026-11-30' };
  it('detecta intervalos dentro, cruzando y abiertos', () => {
    expect(seSolapa('2026-11-05', '2026-11-10', p)).toBe(true);
    expect(seSolapa('2026-10-20', '2026-11-02', p)).toBe(true);
    expect(seSolapa('2026-11-20', '2026-12-05', p)).toBe(true);
    expect(seSolapa('2026-10-01', null, p)).toBe(true);
  });
  it('descarta los que terminan antes o empiezan después', () => {
    expect(seSolapa('2026-10-01', '2026-10-31', p)).toBe(false);
    expect(seSolapa('2026-12-01', null, p)).toBe(false);
  });
  it('los bordes cuentan', () => {
    expect(seSolapa('2026-10-20', '2026-11-01', p)).toBe(true);
    expect(seSolapa('2026-11-30', null, p)).toBe(true);
  });
});
