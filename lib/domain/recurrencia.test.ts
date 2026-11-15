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
