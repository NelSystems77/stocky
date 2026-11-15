import { describe, expect, it } from 'vitest';
import { analizarRiesgo, cargasDeConsumo, normalizarMargen, nivelRiesgo } from './riesgo';

describe('nivelRiesgo', () => {
  it('crítico si la cobertura no llega al ingreso', () => {
    expect(nivelRiesgo(100, 1, 2)).toBe('critico');
    expect(nivelRiesgo(100, 1.99, 2)).toBe('critico');
  });
  it('riesgo si llega al ingreso pero con menos del margen de sobra', () => {
    expect(nivelRiesgo(100, 2, 2)).toBe('riesgo'); // justo en el ingreso ya no es crítico
    expect(nivelRiesgo(100, 8.9, 2)).toBe('riesgo'); // 2 + 7 = 9
  });
  it('ok con cobertura de sobra', () => {
    expect(nivelRiesgo(100, 9, 2)).toBe('ok');
    expect(nivelRiesgo(100, 50, 2)).toBe('ok');
  });
  it('el margen es configurable', () => {
    expect(nivelRiesgo(100, 6, 2, 3)).toBe('ok');
    expect(nivelRiesgo(100, 4, 2, 3)).toBe('riesgo');
  });
  it('sin consumo no se calcula riesgo y con existencia 0 es agotado', () => {
    expect(nivelRiesgo(100, null, 2)).toBe('sinConsumo');
    expect(nivelRiesgo(0, 0, 2)).toBe('agotado');
    expect(nivelRiesgo(0, null, 2)).toBe('agotado');
  });
});

describe('cargasDeConsumo', () => {
  it('cuenta los días hábiles del día 1 del mes hasta la fecha del reporte', () => {
    // Nov 2026: el 1 es domingo; hábiles del 2 al 6 (5) y del 9 al 12 (4) = 9.
    expect(cargasDeConsumo([{ periodo: '2026-11-12', cantidad: 900 }])).toEqual([{ cantidad: 900, diasHabiles: 9 }]);
  });
  it('un feriado resta un día hábil', () => {
    expect(cargasDeConsumo([{ periodo: '2026-11-12', cantidad: 900 }], ['2026-11-04'])[0]?.diasHabiles).toBe(8);
  });
  it('ordena de la más antigua a la más reciente', () => {
    const c = cargasDeConsumo([
      { periodo: '2026-11-12', cantidad: 1 },
      { periodo: '2026-10-29', cantidad: 2 },
    ]);
    expect(c.map((x) => x.cantidad)).toEqual([2, 1]);
  });
});

describe('analizarRiesgo', () => {
  // Reporte del jueves 12-nov-2026: 900 unidades en 9 días hábiles = 100 por día.
  // Faltan 2 días hábiles (vie 13 y sáb 14, segundo sábado) para el ingreso.
  const base = { consumos: [{ periodo: '2026-11-12', cantidad: 900 }], fechaExistencia: '2026-11-12' };

  it('calcula consumo diario, cobertura y días al ingreso', () => {
    const a = analizarRiesgo({ ...base, existencia: 500 });
    expect(a.consumoDiario).toBe(100);
    expect(a.cobertura).toBe(5);
    expect(a.diasAlIngreso).toBe(2);
    expect(a.nivel).toBe('riesgo'); // 5 < 2 + 7
  });
  it('crítico: se acaba antes del ingreso', () => {
    expect(analizarRiesgo({ ...base, existencia: 100 }).nivel).toBe('critico'); // 1 día < 2
  });
  it('ok: sobra cobertura', () => {
    expect(analizarRiesgo({ ...base, existencia: 2000 }).nivel).toBe('ok'); // 20 días
  });
  it('sin consumos no hay riesgo ni cobertura', () => {
    const a = analizarRiesgo({ consumos: [], fechaExistencia: '2026-11-12', existencia: 500 });
    expect(a).toMatchObject({ consumoDiario: null, cobertura: null, nivel: 'sinConsumo' });
  });
  it('usa el promedio de las últimas 4 cargas', () => {
    const consumos = [
      { periodo: '2026-10-08', cantidad: 10_000 }, // fuera de la ventana
      { periodo: '2026-10-15', cantidad: 100 },
      { periodo: '2026-10-22', cantidad: 100 },
      { periodo: '2026-10-29', cantidad: 100 },
      { periodo: '2026-11-12', cantidad: 900 },
    ];
    const a = analizarRiesgo({ consumos, fechaExistencia: '2026-11-12', existencia: 1000 });
    expect(a.consumoDiario).not.toBeNull();
    expect(a.consumoDiario as number).toBeLessThan(100);
  });
  it('un margen mayor vuelve «riesgo» lo que era «ok»', () => {
    expect(analizarRiesgo({ ...base, existencia: 1100, margen: 7 }).nivel).toBe('ok'); // 11 ≥ 9
    expect(analizarRiesgo({ ...base, existencia: 1100, margen: 14 }).nivel).toBe('riesgo'); // 11 < 16
  });
  it('existencia 0 es agotado, no riesgo', () => {
    expect(analizarRiesgo({ ...base, existencia: 0 }).nivel).toBe('agotado');
  });
});

describe('normalizarMargen', () => {
  it('acepta enteros de 0 a 30', () => {
    expect(normalizarMargen(0)).toBe(0);
    expect(normalizarMargen(14)).toBe(14);
    expect(normalizarMargen(30)).toBe(30);
  });
  it('lo demás vuelve a 7', () => {
    for (const malo of [-1, 31, 2.5, '7', null, undefined, NaN]) expect(normalizarMargen(malo)).toBe(7);
  });
});
