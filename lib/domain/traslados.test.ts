import { describe, expect, it } from 'vitest';
import {
  cerrarTraslado,
  diasDesdeRegistro,
  esOrdenSAPValida,
  estadosValidos,
  ordenarTraslados,
  totalesTraslados,
  trasladosDelMes,
  trasladosPendientes,
  tramitesPendientes,
  validarTraslado,
  type EntradaTraslado,
  type RegistroTraslado,
} from './traslados';

const entrada = (extra: Partial<EntradaTraslado> = {}): EntradaTraslado => ({
  fecha: '2026-11-16',
  ordenSAP: '5000012345',
  tipo: 'envio',
  unidad: 'Hospital de Heredia',
  items: [{ codigo: '110-16-0010', cantidad: 2, ud: 'CN' }],
  notas: '',
  ...extra,
});
const t = (id: string, fecha: string, estado: RegistroTraslado['estado'], extra: Partial<RegistroTraslado> = {}): RegistroTraslado => ({
  id,
  fecha,
  ordenSAP: `50000${id.padStart(5, '0')}`,
  tipo: estado === 'recibido' ? 'recepcion' : 'envio',
  unidad: 'Hospital',
  items: [{ codigo: 'A', cantidad: 100 }],
  estado,
  fechaCierre: estado === 'pendiente' ? null : fecha,
  enSAP: false,
  enSIFA: false,
  notas: '',
  ...extra,
});

describe('orden SAP', () => {
  it('debe empezar con 50000, solo dígitos y tener más de 5', () => {
    expect(esOrdenSAPValida('5000012345')).toBe(true);
    expect(esOrdenSAPValida('50000 12345')).toBe(true);
    expect(esOrdenSAPValida('500001')).toBe(true);
    expect(esOrdenSAPValida('50000')).toBe(false);
    expect(esOrdenSAPValida('4000012345')).toBe(false);
    expect(esOrdenSAPValida('50000ABC1')).toBe(false);
    expect(esOrdenSAPValida('')).toBe(false);
  });
});

describe('validarTraslado', () => {
  it('convierte cantidades a unidades base y limpia la orden', () => {
    const r = validarTraslado(entrada({ ordenSAP: ' 50000 12345 ' }));
    expect(r.ok && r.valor.ordenSAP).toBe('5000012345');
    expect(r.ok && r.valor.items).toEqual([{ codigo: '110-16-0010', cantidad: 200 }]);
  });
  it('suma un producto repetido en una sola línea', () => {
    const r = validarTraslado(entrada({ items: [{ codigo: '110-16-0010', cantidad: 1, ud: 'CN' }, { codigo: '1-10-16-0010', cantidad: 50, ud: 'FC' }] }));
    expect(r.ok && r.valor.items).toEqual([{ codigo: '110-16-0010', cantidad: 150 }]);
  });
  it('rechaza orden, fecha, unidad, productos y cantidades inválidos', () => {
    expect(validarTraslado(entrada({ ordenSAP: '123' })).ok).toBe(false);
    expect(validarTraslado(entrada({ fecha: '16/11/2026' })).ok).toBe(false);
    expect(validarTraslado(entrada({ unidad: '  ' })).ok).toBe(false);
    expect(validarTraslado(entrada({ items: [] })).ok).toBe(false);
    expect(validarTraslado(entrada({ items: [{ codigo: 'xx', cantidad: 1, ud: 'FC' }] })).ok).toBe(false);
    expect(validarTraslado(entrada({ items: [{ codigo: '110-16-0010', cantidad: 0, ud: 'FC' }] })).ok).toBe(false);
  });
  it('el mensaje de unidad depende del tipo', () => {
    const e = validarTraslado(entrada({ unidad: '', tipo: 'recepcion' }));
    expect(!e.ok && e.error).toMatch(/origen/);
  });
});

describe('estados', () => {
  it('recepción: pendiente o recibido; envío: pendiente o enviado', () => {
    expect(estadosValidos('recepcion')).toEqual(['pendiente', 'recibido']);
    expect(estadosValidos('envio')).toEqual(['pendiente', 'enviado']);
  });
  it('cerrar usa el estado final según el tipo', () => {
    expect(cerrarTraslado({ tipo: 'recepcion' }, '2026-11-20')).toEqual({ estado: 'recibido', fechaCierre: '2026-11-20' });
    expect(cerrarTraslado({ tipo: 'envio' }, '2026-11-20')).toEqual({ estado: 'enviado', fechaCierre: '2026-11-20' });
  });
});

describe('pendientes y trámite', () => {
  const lista = [
    t('1', '2026-11-10', 'pendiente'),
    t('2', '2026-11-02', 'pendiente'),
    t('3', '2026-11-05', 'enviado', { enSAP: true, enSIFA: false }),
    t('4', '2026-11-06', 'recibido', { enSAP: true, enSIFA: true }),
  ];
  it('pendientes: los más antiguos primero', () => {
    expect(trasladosPendientes(lista).map((x) => x.id)).toEqual(['2', '1']);
  });
  it('trámites pendientes: cerrados sin SAP o SIFA completos', () => {
    expect(tramitesPendientes(lista).map((x) => x.id)).toEqual(['3']);
  });
  it('días desde el registro hasta hoy o hasta el cierre, nunca negativo', () => {
    expect(diasDesdeRegistro({ fecha: '2026-11-10', fechaCierre: null }, '2026-11-16')).toBe(6);
    expect(diasDesdeRegistro({ fecha: '2026-11-10', fechaCierre: '2026-11-12' }, '2026-11-16')).toBe(2);
    expect(diasDesdeRegistro({ fecha: '2026-11-20', fechaCierre: null }, '2026-11-16')).toBe(0);
  });
  it('ordena y filtra por mes', () => {
    expect(ordenarTraslados(lista).map((x) => x.id)).toEqual(['1', '4', '3', '2']);
    expect(trasladosDelMes(lista, '2026-11')).toHaveLength(4);
    expect(trasladosDelMes(lista, '2026-10')).toEqual([]);
  });
});

describe('totalesTraslados', () => {
  it('cuenta por estado y suma unidades enviadas y recibidas', () => {
    const lista = [
      t('1', '2026-11-10', 'pendiente'),
      t('2', '2026-11-02', 'enviado', { items: [{ codigo: 'A', cantidad: 50 }, { codigo: 'B', cantidad: 25 }] }),
      t('3', '2026-11-05', 'recibido', { enSAP: true, enSIFA: true }),
    ];
    expect(totalesTraslados(lista)).toEqual({
      total: 3,
      enviados: 1,
      recibidos: 1,
      pendientes: 1,
      tramitePendiente: 1,
      unidadesEnviadas: 75,
      unidadesRecibidas: 100,
    });
  });
  it('sin registros devuelve ceros', () => {
    expect(totalesTraslados([]).total).toBe(0);
  });
});
