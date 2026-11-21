import { describe, expect, it } from 'vitest';
import { entradaDesdePreconteo, validarPreconteo } from './preconteo';
import { camposEditadosTraslado, entradaDesdeTraslado, validarTraslado, type RegistroTraslado } from './traslados';

describe('editar una entrega de preconteo', () => {
  const guardada = { fecha: '2026-11-18', codigo: '110-16-0010', cantidad: 20000, presentacion: 60, notas: 'caja 3' };

  it('la cantidad vuelve a la UD del producto (20000 sueltas → 200 CN)', () => {
    const e = entradaDesdePreconteo(guardada, 'CN');
    expect(e).toMatchObject({ cantidad: 200, ud: 'CN', presentacion: 60, notas: 'caja 3' });
  });
  it('sin UD conocida queda en unidades sueltas', () => {
    expect(entradaDesdePreconteo(guardada, undefined)).toMatchObject({ cantidad: 20000, ud: 'UN' });
  });
  it('guardar lo mismo sin tocar nada no cambia los datos (ida y vuelta)', () => {
    const r = validarPreconteo(entradaDesdePreconteo(guardada, 'CN'));
    expect(r).toEqual({ ok: true, valor: guardada });
  });
  it('una cantidad con decimales en la UD se conserva (200,5 CN = 20050)', () => {
    const r = validarPreconteo({ ...entradaDesdePreconteo({ ...guardada, cantidad: 20050 }, 'CN') });
    expect(r.ok && r.valor.cantidad).toBe(20050);
  });
});

describe('editar un traslado', () => {
  const guardado: RegistroTraslado = {
    id: 't1',
    fecha: '2026-11-10',
    ordenSAP: '5000012345',
    tipo: 'recepcion',
    unidad: 'Hospital',
    items: [
      { codigo: '110-16-0010', cantidad: 20000 },
      { codigo: '110-20-0001', cantidad: 40 },
    ],
    estado: 'recibido',
    fechaCierre: '2026-11-12',
    enSAP: true,
    enSIFA: false,
    notas: '',
  };
  const udDe = (c: string) => ({ '110-16-0010': 'CN', '110-20-0001': 'FC' })[c];

  it('cada producto vuelve a su UD', () => {
    const e = entradaDesdeTraslado(guardado, udDe);
    expect(e.items).toEqual([
      { codigo: '110-16-0010', ud: 'CN', cantidad: 200 },
      { codigo: '110-20-0001', ud: 'FC', cantidad: 40 },
    ]);
  });
  it('un producto fuera del último reporte queda en unidades sueltas', () => {
    expect(entradaDesdeTraslado(guardado, () => undefined).items[0]).toMatchObject({ ud: 'UN', cantidad: 20000 });
  });
  it('guardar sin tocar nada devuelve los mismos productos (ida y vuelta)', () => {
    const r = validarTraslado(entradaDesdeTraslado(guardado, udDe));
    expect(r.ok && r.valor.items).toEqual(guardado.items);
    expect(r.ok && r.valor.ordenSAP).toBe('5000012345');
  });
  it('si el tipo no cambia, conserva el estado y la fecha de cierre', () => {
    const r = validarTraslado(entradaDesdeTraslado(guardado, udDe));
    if (!r.ok) throw new Error('inválido');
    expect(camposEditadosTraslado(guardado, r.valor)).toMatchObject({ estado: 'recibido', fechaCierre: '2026-11-12' });
  });
  it('si cambia a envío, «recibido» ya no corresponde: vuelve a pendiente y sin fecha de cierre', () => {
    const r = validarTraslado({ ...entradaDesdeTraslado(guardado, udDe), tipo: 'envio' });
    if (!r.ok) throw new Error('inválido');
    expect(camposEditadosTraslado(guardado, r.valor)).toMatchObject({ tipo: 'envio', estado: 'pendiente', fechaCierre: null });
  });
  it('un traslado pendiente sigue pendiente aunque cambie el tipo', () => {
    const pendiente = { estado: 'pendiente' as const, fechaCierre: null, items: [] };
    const r = validarTraslado({ ...entradaDesdeTraslado(guardado, udDe), tipo: 'envio' });
    if (!r.ok) throw new Error('inválido');
    expect(camposEditadosTraslado(pendiente, r.valor)).toMatchObject({ estado: 'pendiente', fechaCierre: null });
  });
  it('los campos editados no incluyen el trámite SAP/SIFA', () => {
    const r = validarTraslado(entradaDesdeTraslado(guardado, udDe));
    if (!r.ok) throw new Error('inválido');
    const campos = camposEditadosTraslado(guardado, r.valor);
    expect('enSAP' in campos || 'enSIFA' in campos).toBe(false);
  });
});
