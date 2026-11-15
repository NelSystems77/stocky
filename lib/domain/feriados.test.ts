import { describe, expect, it } from 'vitest';
import { esDiaLaborable } from './calendario';
import { agregarFeriado, esFechaValida, feriadosPorAnio, normalizarFeriados, quitarFeriado } from './feriados';

describe('esFechaValida', () => {
  it('acepta fechas reales y rechaza inexistentes o mal formadas', () => {
    expect(esFechaValida('2026-12-25')).toBe(true);
    expect(esFechaValida('2028-02-29')).toBe(true); // bisiesto
    expect(esFechaValida('2026-02-29')).toBe(false);
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('2026-13-01')).toBe(false);
    expect(esFechaValida('25/12/2026')).toBe(false);
    expect(esFechaValida('')).toBe(false);
    expect(esFechaValida(20261225)).toBe(false);
  });
});

describe('normalizarFeriados', () => {
  it('ordena, quita repetidas y descarta basura', () => {
    expect(normalizarFeriados(['2026-12-25', '2026-04-11', '2026-12-25', 'x', 5, null])).toEqual(['2026-04-11', '2026-12-25']);
  });
  it('devuelve vacío si no es una lista', () => {
    expect(normalizarFeriados(undefined)).toEqual([]);
    expect(normalizarFeriados('2026-12-25')).toEqual([]);
  });
});

describe('agregar y quitar', () => {
  it('agrega en orden y no duplica', () => {
    const l = agregarFeriado(['2026-12-25'], '2026-08-15');
    expect(l).toEqual(['2026-08-15', '2026-12-25']);
    expect(agregarFeriado(l, '2026-08-15')).toEqual(l);
  });
  it('ignora una fecha inválida', () => {
    expect(agregarFeriado(['2026-12-25'], '2026-02-30')).toEqual(['2026-12-25']);
  });
  it('quita un feriado y no falla si no estaba', () => {
    expect(quitarFeriado(['2026-08-15', '2026-12-25'], '2026-08-15')).toEqual(['2026-12-25']);
    expect(quitarFeriado(['2026-12-25'], '2026-01-01')).toEqual(['2026-12-25']);
  });
  it('no modifica la lista recibida', () => {
    const original = ['2026-12-25'];
    agregarFeriado(original, '2026-08-15');
    quitarFeriado(original, '2026-12-25');
    expect(original).toEqual(['2026-12-25']);
  });
});

describe('feriadosPorAnio', () => {
  it('agrupa por año en orden', () => {
    expect(feriadosPorAnio(['2027-01-01', '2026-12-25', '2026-08-15'])).toEqual([
      { anio: '2026', fechas: ['2026-08-15', '2026-12-25'] },
      { anio: '2027', fechas: ['2027-01-01'] },
    ]);
  });
});

describe('integración con el calendario laboral', () => {
  it('un feriado en día hábil deja de ser laborable', () => {
    expect(esDiaLaborable('2026-12-25', [])).toBe(true); // viernes
    expect(esDiaLaborable('2026-12-25', ['2026-12-25'])).toBe(false);
    expect(esDiaLaborable('2026-12-24', ['2026-12-25'])).toBe(true); // otro día no cambia
  });
});
