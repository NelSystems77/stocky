import { describe, expect, it } from 'vitest';
import { diasDesde, estadoConsumos, ultimoDiaAlDia } from './reporteDesactualizado';

describe('alerta A8: reporte de consumos desactualizado', () => {
  it('sin ninguna carga no hay fecha que comparar', () => {
    expect(estadoConsumos(null, '2026-11-21')).toEqual({ tipo: 'sinCarga' });
  });
  it('hasta 8 días está al día; con más de 8 salta la alerta', () => {
    expect(estadoConsumos('2026-11-21', '2026-11-21')).toEqual({ tipo: 'alDia', dias: 0 });
    expect(estadoConsumos('2026-11-13', '2026-11-21')).toEqual({ tipo: 'alDia', dias: 8 });
    expect(estadoConsumos('2026-11-12', '2026-11-21')).toEqual({ tipo: 'desactualizado', dias: 9 });
  });
  it('cuenta días calendario, también entre meses y años', () => {
    expect(diasDesde('2026-12-28', '2027-01-05')).toBe(8);
    expect(diasDesde('2026-02-27', '2026-03-02')).toBe(3);
  });
  it('una fecha de carga futura no da días negativos', () => {
    expect(diasDesde('2026-11-25', '2026-11-21')).toBe(0);
  });
  it('último día al día = fecha de carga + 8', () => {
    expect(ultimoDiaAlDia('2026-11-13')).toBe('2026-11-21');
  });
});
