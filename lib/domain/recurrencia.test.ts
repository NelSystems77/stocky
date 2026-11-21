import { describe, expect, it } from 'vitest';
import { ocurreEn, proximaOcurrencia } from './recurrencia';
import type { Recurrencia } from './types';

describe('recurrencias', () => {
  it('diaria solo en días laborables', () => {
    expect(ocurreEn({ tipo: 'diaria' }, '2026-11-16')).toBe(true);
    expect(ocurreEn({ tipo: 'diaria' }, '2026-11-15')).toBe(false);
    expect(ocurreEn({ tipo: 'diaria' }, '2026-11-17', ['2026-11-17'])).toBe(false);
  });
  it('días específicos (L-Mi-J-V)', () => {
    const rec: Recurrencia = { tipo: 'diasSemana', dias: [1, 3, 4, 5] };
    expect(ocurreEn(rec, '2026-11-16')).toBe(true); // lunes
    expect(ocurreEn(rec, '2026-11-17')).toBe(false); // martes
  });
  it('quincenal desde un ancla', () => {
    const rec = { tipo: 'quincenal', dia: 4, ancla: '2026-11-12' } as const;
    expect(ocurreEn(rec, '2026-11-12')).toBe(true);
    expect(ocurreEn(rec, '2026-11-19')).toBe(false);
    expect(ocurreEn(rec, '2026-11-26')).toBe(true);
  });
  it('mensual se corre al siguiente día laborable', () => {
    const rec = { tipo: 'mensual', diaMes: 15 } as const; // 15-nov-2026 es domingo
    expect(ocurreEn(rec, '2026-11-15')).toBe(false);
    expect(ocurreEn(rec, '2026-11-16')).toBe(true);
    expect(ocurreEn({ tipo: 'mensual', diaMes: 31 }, '2026-11-30')).toBe(true); // mes de 30 días
  });
  it('segundo sábado', () => {
    expect(ocurreEn({ tipo: 'segundoSabado' }, '2026-11-14')).toBe(true);
    expect(ocurreEn({ tipo: 'segundoSabado' }, '2026-11-21')).toBe(false);
  });
  it('próxima ocurrencia', () => {
    expect(proximaOcurrencia({ tipo: 'segundoSabado' }, '2026-11-15')).toBe('2026-12-12');
    expect(proximaOcurrencia({ tipo: 'diaria' }, '2026-11-14')).toBe('2026-11-14');
  });
});

describe('tercer jueves y 15 días después (RF-1.8)', () => {
  const tj = { tipo: 'tercerJueves' } as const;
  const mas15 = { tipo: 'tercerJuevesMas15' } as const;
  it('tercer jueves del mes', () => {
    expect(ocurreEn(tj, '2026-11-19')).toBe(true);
    expect(ocurreEn(tj, '2026-11-12')).toBe(false);
    expect(ocurreEn(tj, '2026-11-26')).toBe(false);
    expect(ocurreEn(tj, '2026-12-17')).toBe(true);
  });
  it('si el tercer jueves es feriado pasa al siguiente día laborable', () => {
    expect(ocurreEn(tj, '2026-11-19', ['2026-11-19'])).toBe(false);
    expect(ocurreEn(tj, '2026-11-20', ['2026-11-19'])).toBe(true);
  });
  it('15 días después: el viernes siguiente al cuarto jueves', () => {
    expect(ocurreEn(mas15, '2026-12-04')).toBe(true); // 19-nov + 15
    expect(ocurreEn(mas15, '2026-12-03')).toBe(false);
    expect(ocurreEn(mas15, '2026-12-18')).toBe(false);
  });
  it('15 días después puede caer en el mes siguiente', () => {
    expect(ocurreEn(mas15, '2026-10-30')).toBe(true); // 3.er jueves de octubre = 15
    expect(ocurreEn(mas15, '2027-02-05')).toBe(true); // 3.er jueves de enero = 21
  });
  it('15 días después en día no laborable pasa al siguiente', () => {
    expect(ocurreEn(mas15, '2026-12-04', ['2026-12-04'])).toBe(false);
    expect(ocurreEn(mas15, '2026-12-07', ['2026-12-04'])).toBe(true);
    expect(proximaOcurrencia(mas15, '2027-02-20')).toBe('2027-03-05'); // 3.er jueves de febrero = 18
  });
  it('un solo día al mes', () => {
    const dias = [...Array(30).keys()].map((i) => `2026-11-${String(i + 1).padStart(2, '0')}`).filter((f) => ocurreEn(tj, f));
    expect(dias).toEqual(['2026-11-19']);
  });
});

