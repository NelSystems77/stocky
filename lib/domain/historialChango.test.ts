import { describe, expect, it } from 'vitest';
import { agruparHistorialPorDia, ordenarHistorial, type EntradaHistorial } from './historialChango';

const entrada = (id: string, iso: string): EntradaHistorial => ({ id, pregunta: `p-${id}`, respuesta: `r-${id}`, modelo: 'm', fecha: new Date(iso) });

describe('ordenarHistorial', () => {
  it('deja la consulta más reciente primero y no modifica la lista original', () => {
    const lista = [entrada('a', '2026-11-20T15:00:00Z'), entrada('b', '2026-11-22T15:00:00Z'), entrada('c', '2026-11-21T15:00:00Z')];
    expect(ordenarHistorial(lista).map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(lista.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('agruparHistorialPorDia', () => {
  it('agrupa por día de Costa Rica (UTC-6), no por UTC', () => {
    // 2026-11-22T03:00Z = 21 de nov. 21:00 en Costa Rica; 2026-11-21T15:00Z = 21 de nov. 09:00.
    const g = agruparHistorialPorDia([entrada('a', '2026-11-22T03:00:00Z'), entrada('b', '2026-11-21T15:00:00Z'), entrada('c', '2026-11-22T15:00:00Z')]);
    expect(g.map((x) => x.dia)).toEqual(['2026-11-22', '2026-11-21']);
    expect(g[0]?.entradas.map((e) => e.id)).toEqual(['c']);
    expect(g[1]?.entradas.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('sin consultas no hay grupos', () => {
    expect(agruparHistorialPorDia([])).toEqual([]);
  });
});
