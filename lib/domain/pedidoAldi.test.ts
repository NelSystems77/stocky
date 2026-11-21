import { describe, expect, it } from 'vitest';
import {
  aplicarAjustes,
  calcularPedidoAldi,
  cantidadAPedir,
  diasHabilesDelPeriodo,
  etiquetaPeriodo,
  leerCantidadAjustada,
  resumenPedidoAldi,
  validarParametrosAldi,
  type ProductoAldi,
} from './pedidoAldi';

// Cuota 100 CN (10 000 unidades), existencia 40 CN (4 000), 20 días hábiles en el período.
const HABILES = 20;
const P = { factor: 1.5, dias: 30, diasHabiles: HABILES };
/** Consumo diario (por día hábil) de un consumo mensual dado en CN: 30 CN al mes = 3 000 unidades / 20 días. */
const diarioDeCN = (cnPorPeriodo: number) => (cnPorPeriodo * 100) / HABILES;
const producto = (consumoCN: number | null | undefined, extra: Partial<ProductoAldi> = {}): ProductoAldi => ({
  codigo: '110-16-0010',
  descripcion: 'PARACETAMOL 500 MG',
  ud: 'CN',
  cuota: 10000,
  existencia: 4000,
  consumoDiario: consumoCN === undefined ? undefined : consumoCN === null ? null : diarioDeCN(consumoCN),
  ...extra,
});

describe('objetivo = menor entre la cuota y consumo × factor; a pedir = objetivo − existencia', () => {
  it('consumo bajo (30 CN al mes): 30 × 1.5 = 45 CN → pide 5 CN', () => {
    const r = calcularPedidoAldi([producto(30)], P);
    expect(r.lineas[0]).toMatchObject({ objetivo: 4500, calculada: 5, cantidad: 5, criterio: 'consumo', consumo: 3000 });
  });
  it('consumo alto (70 CN): 105 CN pasa la cuota de 100 → se limita a 100 y pide 60 CN', () => {
    const r = calcularPedidoAldi([producto(70)], P);
    expect(r.lineas[0]).toMatchObject({ objetivo: 10000, calculada: 60, criterio: 'limitadaPorCuota' });
  });
  it('consumo muy alto (120 CN): sigue limitado por la cuota, nunca la pasa', () => {
    const r = calcularPedidoAldi([producto(120)], P);
    expect(r.lineas[0]).toMatchObject({ objetivo: 10000, calculada: 60, criterio: 'limitadaPorCuota' });
  });
  it('si consumo × factor da justo la cuota no cuenta como limitada', () => {
    // 100 / 1.5 no es exacto: usamos factor 2 y consumo 50 CN → 100 CN justo.
    const r = calcularPedidoAldi([producto(50)], { ...P, factor: 2 });
    expect(r.lineas[0]).toMatchObject({ objetivo: 10000, criterio: 'consumo' });
  });
  it('el factor es el margen sobre el consumo: 1.25, 1.5 y 2', () => {
    const pedir = (factor: number) => calcularPedidoAldi([producto(40)], { ...P, factor }).lineas[0]?.calculada;
    expect(pedir(1.25)).toBe(10); // 50 − 40
    expect(pedir(1.5)).toBe(20); //  60 − 40
    expect(pedir(2)).toBe(40); //    80 − 40
  });
  it('un período de 15 días (10 días hábiles) usa la mitad del consumo', () => {
    // Mismo consumo diario que 40 CN en 20 días; con 10 días hábiles: 20 CN × 1.5 = 30 CN < existencia 40 → ya cubierto
    const r = calcularPedidoAldi([producto(40)], { factor: 1.5, dias: 15, diasHabiles: 10 });
    expect(r.lineas).toEqual([]);
    expect(r.yaCubiertos).toBe(1);
  });
  it('si la existencia ya llega al objetivo, no se pide (nunca negativo)', () => {
    const r = calcularPedidoAldi([producto(10)], P); // objetivo 15 CN, hay 40
    expect(r.lineas).toEqual([]);
    expect(r.yaCubiertos).toBe(1);
  });
  it('redondea hacia arriba a la UD entera', () => {
    expect(cantidadAPedir(4050, 10000, 'CN')).toBe(60); // 59.5 → 60
    expect(cantidadAPedir(9999, 10000, 'CN')).toBe(1);
    expect(cantidadAPedir(4, 15, 'FC')).toBe(11);
  });
});

describe('sin consumo y consumo cero', () => {
  it('sin consumo cargado se repone hasta la cuota y la línea queda marcada', () => {
    const r = calcularPedidoAldi([producto(null), producto(undefined, { codigo: '110-16-0020' })], P);
    expect(r.lineas.map((l) => [l.codigo, l.calculada, l.criterio, l.consumo])).toEqual([
      ['110-16-0010', 60, 'sinConsumo', null],
      ['110-16-0020', 60, 'sinConsumo', null],
    ]);
  });
  it('consumo cero (hay datos pero no se mueve): no se pide, aunque la existencia sea baja', () => {
    const r = calcularPedidoAldi([producto(0, { existencia: 0 })], P);
    expect(r.lineas).toEqual([]);
    expect(r.sinMovimiento).toBe(1);
  });
});

describe('alcance y omitidos', () => {
  const productos: ProductoAldi[] = [
    producto(70, { codigo: '110-16-0020' }), //        pide 60
    producto(30, { codigo: '110-16-0010' }), //        pide 5
    producto(30, { codigo: '110-16-0030', cuota: 0 }), // sin cuota
    producto(30, { codigo: '110-16-0040', cuota: undefined }), // sin cuota
    producto(30, { codigo: '110-16-0050', existencia: undefined }), // sin existencia
    producto(0, { codigo: '110-16-0060' }), //         sin movimiento
    producto(10, { codigo: '110-16-0070' }), //        ya cubierto
  ];
  const r = calcularPedidoAldi(productos, P);

  it('solo entran los que tienen cuota, existencia y algo que reponer, ordenados por código', () => {
    expect(r.lineas.map((l) => [l.codigo, l.cantidad])).toEqual([
      ['110-16-0010', 5],
      ['110-16-0020', 60],
    ]);
  });
  it('cuenta lo omitido y por qué', () => {
    expect(r).toMatchObject({ sinCuota: 2, sinExistencia: 1, sinMovimiento: 1, yaCubiertos: 1 });
  });
  it('la lista de omitidos trae cada producto con su motivo, cuota y existencia, ordenada por código', () => {
    expect(r.omitidos.map((o) => [o.codigo, o.motivo])).toEqual([
      ['110-16-0030', 'sinCuota'],
      ['110-16-0040', 'sinCuota'],
      ['110-16-0050', 'sinExistencia'],
      ['110-16-0060', 'sinMovimiento'],
      ['110-16-0070', 'yaCubierto'],
    ]);
    expect(r.omitidos[0]).toMatchObject({ cuota: 0, existencia: 4000, ud: 'CN' });
    expect(r.omitidos[1]).not.toHaveProperty('cuota'); // el reporte no la trae
    expect(r.omitidos[2]).not.toHaveProperty('existencia');
  });
  it('las cuentas coinciden con la lista, y lo pedido más lo omitido es todo el inventario', () => {
    const por = (m: string) => r.omitidos.filter((o) => o.motivo === m).length;
    expect([r.sinCuota, r.sinExistencia, r.sinMovimiento, r.yaCubiertos]).toEqual([por('sinCuota'), por('sinExistencia'), por('sinMovimiento'), por('yaCubierto')]);
    expect(r.lineas.length + r.omitidos.length).toBe(productos.length);
  });
  it('sin productos devuelve un pedido vacío', () => {
    expect(calcularPedidoAldi([], P)).toEqual({ lineas: [], omitidos: [], sinCuota: 0, sinExistencia: 0, sinMovimiento: 0, yaCubiertos: 0 });
  });
});

describe('ajustes a mano y resumen', () => {
  const { lineas } = calcularPedidoAldi([producto(70), producto(30, { codigo: '110-16-0020' }), producto(null, { codigo: '110-16-0030' })], P);

  it('una cantidad válida reemplaza lo calculado y se cuenta como ajustada', () => {
    const l = aplicarAjustes(lineas, { '110-16-0010': '65' });
    expect(l[0]).toMatchObject({ calculada: 60, cantidad: 65 });
    expect(resumenPedidoAldi(l).ajustadas).toBe(1);
  });
  it('una cantidad en 0 saca la línea; un texto inválido se ignora', () => {
    expect(aplicarAjustes(lineas, { '110-16-0020': '0' }).map((x) => x.codigo)).not.toContain('110-16-0020');
    for (const malo of ['', '-5', '1.5', 'abc', ' ']) expect(aplicarAjustes(lineas, { '110-16-0010': malo })[0]?.cantidad).toBe(60);
  });
  it('el resumen cuenta las limitadas por la cuota y las sin consumo', () => {
    expect(resumenPedidoAldi(lineas)).toEqual({ productos: 3, ajustadas: 0, limitadasPorCuota: 1, sinConsumo: 1 });
  });
  it('leerCantidadAjustada solo acepta enteros', () => {
    expect(leerCantidadAjustada('15')).toBe(15);
    expect(leerCantidadAjustada('1,5')).toBeNull();
  });
});

describe('días hábiles del período', () => {
  it('cuenta los días hábiles de los próximos días (desde mañana), sin feriados', () => {
    // Del sábado 21-nov-2026 el 22 es domingo; 23 al 27 son 5 hábiles; el período de 7 días llega hasta el sábado 28 (no es 2.º sábado).
    expect(diasHabilesDelPeriodo('2026-11-21', 7)).toBe(5);
  });
  it('un feriado no cuenta', () => {
    expect(diasHabilesDelPeriodo('2026-11-21', 7, ['2026-11-25'])).toBe(4);
  });
  it('un mes tiene cerca de 21 o 22 días hábiles', () => {
    const n = diasHabilesDelPeriodo('2026-11-21', 30);
    expect(n).toBeGreaterThanOrEqual(20);
    expect(n).toBeLessThanOrEqual(23);
  });
});

describe('parámetros del pedido', () => {
  it('acepta los factores y períodos habituales y los personalizados', () => {
    expect(validarParametrosAldi({ factor: 1.25, dias: 30 })).toEqual({ ok: true, valor: { factor: 1.25, dias: 30 } });
    expect(validarParametrosAldi({ factor: 1.75, dias: 45 }).ok).toBe(true);
  });
  it('rechaza factor 0, negativo, enorme o no numérico, y días no enteros, 0 o más de 90', () => {
    for (const factor of [0, -1, 11, Number.NaN, Infinity]) expect(validarParametrosAldi({ factor, dias: 30 }).ok).toBe(false);
    for (const dias of [0, -5, 1.5, 91]) expect(validarParametrosAldi({ factor: 1.5, dias }).ok).toBe(false);
  });
  it('etiqueta del período', () => {
    expect(etiquetaPeriodo(30)).toBe('mensual');
    expect(etiquetaPeriodo(15)).toBe('15 días');
    expect(etiquetaPeriodo(1)).toBe('1 día');
  });
});
