import { describe, expect, it } from 'vitest';
import { resumenEntregasPendientes, type RegistroPreconteo } from './preconteo';
import {
  aplicarRecepcion,
  camposEditadosTraslado,
  diferenciaItem,
  quitarRecepcion,
  tieneDiferencia,
  totalesTraslados,
  validarTraslado,
  type RegistroTraslado,
} from './traslados';

const traslado = (extra: Partial<RegistroTraslado> = {}): RegistroTraslado => ({
  id: 't1',
  fecha: '2026-11-10',
  ordenSAP: '5000012345',
  tipo: 'recepcion',
  unidad: 'Hospital',
  items: [
    { codigo: 'A', cantidad: 20000 },
    { codigo: 'B', cantidad: 40 },
  ],
  estado: 'pendiente',
  fechaCierre: null,
  enSAP: false,
  enSIFA: false,
  notas: '',
  ...extra,
});

describe('recibir un traslado con cantidades distintas', () => {
  it('lo que no se anota se toma como llegado completo', () => {
    const r = aplicarRecepcion(traslado().items, new Map([['A', 15000]]));
    expect(r).toEqual({
      ok: true,
      valor: [
        { codigo: 'A', cantidad: 20000, recibida: 15000 },
        { codigo: 'B', cantidad: 40, recibida: 40 },
      ],
    });
  });
  it('la diferencia es recibido − esperado, con signo menos si faltó', () => {
    expect(diferenciaItem({ codigo: 'A', cantidad: 20000, recibida: 15000 })).toBe(-5000);
    expect(diferenciaItem({ codigo: 'A', cantidad: 20000, recibida: 21200 })).toBe(1200);
    expect(diferenciaItem({ codigo: 'A', cantidad: 20000, recibida: 20000 })).toBe(0);
  });
  it('sin anotar lo recibido no hay diferencia (no cuenta como 0)', () => {
    expect(diferenciaItem({ codigo: 'A', cantidad: 20000 })).toBeNull();
  });
  it('rechaza una cantidad recibida negativa; el cero sí vale (no llegó nada)', () => {
    expect(aplicarRecepcion(traslado().items, new Map([['A', -1]])).ok).toBe(false);
    const cero = aplicarRecepcion(traslado().items, new Map([['A', 0]]));
    expect(cero.ok && cero.valor[0]?.recibida).toBe(0);
  });
  it('tieneDiferencia: solo una recepción cerrada con algún producto distinto', () => {
    const cerrada = (recibida: number) => traslado({ estado: 'recibido', items: [{ codigo: 'A', cantidad: 100, recibida }] });
    expect(tieneDiferencia(cerrada(90))).toBe(true);
    expect(tieneDiferencia(cerrada(100))).toBe(false);
    expect(tieneDiferencia(traslado({ items: [{ codigo: 'A', cantidad: 100, recibida: 90 }] }))).toBe(false); // pendiente
    expect(tieneDiferencia(traslado({ estado: 'recibido' }))).toBe(false); // sin anotar: llegó completo
  });
  it('deshacer quita lo anotado como recibido', () => {
    const r = aplicarRecepcion(traslado().items, new Map([['A', 15000]]));
    if (!r.ok) throw new Error('inválido');
    expect(quitarRecepcion(r.valor)).toEqual(traslado().items);
  });
});

describe('totales con lo recibido', () => {
  it('las unidades recibidas son lo que llegó, no lo que decía la orden, y se cuentan las recepciones con diferencia', () => {
    const lista = [
      traslado({ id: '1', estado: 'recibido', items: [{ codigo: 'A', cantidad: 100, recibida: 80 }] }),
      traslado({ id: '2', estado: 'recibido', items: [{ codigo: 'A', cantidad: 50 }] }),
      traslado({ id: '3', estado: 'recibido', items: [{ codigo: 'A', cantidad: 10, recibida: 10 }] }),
    ];
    const t = totalesTraslados(lista);
    expect(t.unidadesRecibidas).toBe(140);
    expect(t.conDiferencia).toBe(1);
  });
});

describe('editar un traslado ya recibido', () => {
  const recibido = traslado({
    estado: 'recibido',
    fechaCierre: '2026-11-12',
    items: [
      { codigo: '110-16-0010', cantidad: 20000, recibida: 15000 },
      { codigo: '110-20-0001', cantidad: 40, recibida: 40 },
    ],
  });
  const nuevo = (items: { codigo: string; cantidad: number; ud: string }[], tipo: 'envio' | 'recepcion' = 'recepcion') => {
    const r = validarTraslado({ fecha: '2026-11-10', ordenSAP: '5000012345', tipo, unidad: 'Hospital', items, notas: '' });
    if (!r.ok) throw new Error('inválido');
    return r.valor;
  };

  it('conserva lo recibido de cada producto al corregir otros datos', () => {
    const c = camposEditadosTraslado(recibido, nuevo([{ codigo: '110-16-0010', cantidad: 20000, ud: 'UN' }, { codigo: '110-20-0001', cantidad: 40, ud: 'UN' }]));
    expect(c.items).toEqual(recibido.items);
    expect(c.estado).toBe('recibido');
  });
  it('si cambia la cantidad esperada, la diferencia se recalcula con lo recibido', () => {
    const c = camposEditadosTraslado(recibido, nuevo([{ codigo: '110-16-0010', cantidad: 16000, ud: 'UN' }, { codigo: '110-20-0001', cantidad: 40, ud: 'UN' }]));
    expect(c.items[0]).toEqual({ codigo: '110-16-0010', cantidad: 16000, recibida: 15000 });
  });
  it('un producto agregado al editar no trae lo recibido', () => {
    const c = camposEditadosTraslado(recibido, nuevo([{ codigo: '110-16-0010', cantidad: 20000, ud: 'UN' }, { codigo: '110-05-0003', cantidad: 5, ud: 'UN' }]));
    expect(c.items.find((i) => i.codigo === '110-05-0003')).toEqual({ codigo: '110-05-0003', cantidad: 5 });
  });
  it('si cambia a envío, vuelve a pendiente y se descarta lo recibido', () => {
    const c = camposEditadosTraslado(recibido, nuevo([{ codigo: '110-16-0010', cantidad: 20000, ud: 'UN' }], 'envio'));
    expect(c).toMatchObject({ estado: 'pendiente', fechaCierre: null });
    expect(c.items.every((i) => i.recibida === undefined)).toBe(true);
  });
});

describe('resumenEntregasPendientes (chip de Hoy)', () => {
  const entrega = (id: string, fecha: string, recibida: number | null): RegistroPreconteo => ({ id, fecha, codigo: 'A', cantidad: 100, presentacion: 30, recibida, notas: '' });
  it('cuenta solo las que no han vuelto y dice cuánto lleva la más antigua', () => {
    const r = resumenEntregasPendientes([entrega('1', '2026-11-16', null), entrega('2', '2026-11-19', null), entrega('3', '2026-11-10', 100)], '2026-11-21');
    expect(r).toEqual({ total: 2, masAntiguaDias: 5 });
  });
  it('sin entregas pendientes: cero', () => {
    expect(resumenEntregasPendientes([entrega('1', '2026-11-10', 100)], '2026-11-21')).toEqual({ total: 0, masAntiguaDias: 0 });
    expect(resumenEntregasPendientes([], '2026-11-21')).toEqual({ total: 0, masAntiguaDias: 0 });
  });
  it('una entrega de hoy lleva 0 días y una fecha futura no da negativos', () => {
    expect(resumenEntregasPendientes([entrega('1', '2026-11-21', null)], '2026-11-21').masAntiguaDias).toBe(0);
    expect(resumenEntregasPendientes([entrega('1', '2026-11-25', null)], '2026-11-21').masAntiguaDias).toBe(0);
  });
});
