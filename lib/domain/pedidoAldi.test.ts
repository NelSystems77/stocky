import { describe, expect, it } from 'vitest';
import {
  aplicarAjustes,
  calcularPedidoAldi,
  cantidadAPedir,
  etiquetaPeriodo,
  leerCantidadAjustada,
  resumenPedidoAldi,
  validarParametrosAldi,
  type ProductoAldi,
} from './pedidoAldi';

const mensual = { factor: 1.5, dias: 30 };

describe('cantidadAPedir = cuota × factor × días/30 − existencia', () => {
  it('el ejemplo: cuota 100 CN, factor 1.5, existencia 40 CN → 110 CN', () => {
    expect(cantidadAPedir(4000, 10000, mensual, 'CN')).toBe(110);
  });
  it('factor 2 y 1.25 sobre la misma cuota', () => {
    expect(cantidadAPedir(4000, 10000, { factor: 2, dias: 30 }, 'CN')).toBe(160);
    expect(cantidadAPedir(4000, 10000, { factor: 1.25, dias: 30 }, 'CN')).toBe(85);
  });
  it('un período de 15 días usa la mitad de la cuota', () => {
    // objetivo = 10000 × 1.5 × 15/30 = 7500 → 75 CN − 40 CN = 35 CN
    expect(cantidadAPedir(4000, 10000, { factor: 1.5, dias: 15 }, 'CN')).toBe(35);
  });
  it('si la existencia ya llega al objetivo, no se pide nada (nunca negativo)', () => {
    expect(cantidadAPedir(15000, 10000, mensual, 'CN')).toBe(0);
    expect(cantidadAPedir(99999, 10000, mensual, 'CN')).toBe(0);
  });
  it('redondea hacia arriba a la UD entera', () => {
    // objetivo 15000 − existencia 4050 = 10950 → 109.5 CN → 110
    expect(cantidadAPedir(4050, 10000, mensual, 'CN')).toBe(110);
    // un solo faltante de 1 unidad suelta de un CN pide 1 CN
    expect(cantidadAPedir(14999, 10000, mensual, 'CN')).toBe(1);
  });
  it('productos con factor 1 (FC, TR…) van en unidades enteras', () => {
    // cuota 10 FC × 1.5 = 15 − 4 = 11
    expect(cantidadAPedir(4, 10, mensual, 'FC')).toBe(11);
    expect(cantidadAPedir(4, 10, { factor: 1.25, dias: 30 }, 'FC')).toBe(9); // 12.5 − 4 = 8.5 → 9
  });
  it('existencia 0 pide todo el objetivo', () => {
    expect(cantidadAPedir(0, 10000, mensual, 'CN')).toBe(150);
  });
});

describe('calcularPedidoAldi', () => {
  const productos: ProductoAldi[] = [
    { codigo: '110-16-0020', descripcion: 'B', ud: 'FC', cuota: 10, existencia: 4 }, //   pide 11
    { codigo: '110-16-0010', descripcion: 'A', ud: 'CN', cuota: 10000, existencia: 4000 }, // pide 110
    { codigo: '110-16-0030', descripcion: 'C', ud: 'FC', cuota: 0, existencia: 5 }, //   sin cuota
    { codigo: '110-16-0040', descripcion: 'D', ud: 'FC', existencia: 5 }, //             sin cuota
    { codigo: '110-16-0050', descripcion: 'E', ud: 'FC', cuota: 10 }, //                 sin existencia
    { codigo: '110-16-0060', descripcion: 'F', ud: 'FC', cuota: 10, existencia: 50 }, // ya cubierto
  ];
  const r = calcularPedidoAldi(productos, mensual);

  it('solo entran los que tienen cuota, existencia y algo que reponer, ordenados por código', () => {
    expect(r.lineas.map((l) => [l.codigo, l.cantidad])).toEqual([
      ['110-16-0010', 110],
      ['110-16-0020', 11],
    ]);
  });
  it('cuenta lo que se omitió y por qué', () => {
    expect(r).toMatchObject({ sinCuota: 2, sinExistencia: 1, yaCubiertos: 1 });
  });
  it('cada línea trae cuota, existencia y objetivo en unidades base, y lo calculado igual a lo pedido', () => {
    expect(r.lineas[0]).toMatchObject({ cuota: 10000, existencia: 4000, objetivo: 15000, calculada: 110, cantidad: 110 });
  });
  it('sin productos devuelve un pedido vacío', () => {
    expect(calcularPedidoAldi([], mensual)).toEqual({ lineas: [], sinCuota: 0, sinExistencia: 0, yaCubiertos: 0 });
  });
});

describe('ajustes a mano', () => {
  const { lineas } = calcularPedidoAldi(
    [
      { codigo: '110-16-0010', descripcion: 'A', ud: 'CN', cuota: 10000, existencia: 4000 },
      { codigo: '110-16-0020', descripcion: 'B', ud: 'FC', cuota: 10, existencia: 4 },
    ],
    mensual,
  );

  it('una cantidad válida reemplaza lo calculado y se cuenta como ajustada', () => {
    const l = aplicarAjustes(lineas, { '110-16-0010': '120' });
    expect(l.map((x) => x.cantidad)).toEqual([120, 11]);
    expect(resumenPedidoAldi(l)).toEqual({ productos: 2, ajustadas: 1 });
  });
  it('una cantidad en 0 saca la línea del pedido', () => {
    expect(aplicarAjustes(lineas, { '110-16-0020': '0' }).map((x) => x.codigo)).toEqual(['110-16-0010']);
  });
  it('un texto inválido (vacío, negativo, decimal, letras) se ignora y queda lo calculado', () => {
    for (const malo of ['', '-5', '1.5', 'abc', ' ']) {
      expect(aplicarAjustes(lineas, { '110-16-0010': malo })[0]?.cantidad).toBe(110);
    }
  });
  it('lo calculado se conserva aunque se ajuste, para saber cuánto cambió', () => {
    expect(aplicarAjustes(lineas, { '110-16-0010': '120' })[0]).toMatchObject({ calculada: 110, cantidad: 120 });
  });
  it('leerCantidadAjustada solo acepta enteros', () => {
    expect(leerCantidadAjustada('15')).toBe(15);
    expect(leerCantidadAjustada(' 15 ')).toBe(15);
    expect(leerCantidadAjustada('1,5')).toBeNull();
  });
});

describe('parámetros del pedido', () => {
  it('acepta los factores y períodos habituales y los personalizados', () => {
    expect(validarParametrosAldi({ factor: 1.25, dias: 30 })).toEqual({ ok: true, valor: { factor: 1.25, dias: 30 } });
    expect(validarParametrosAldi({ factor: 1.75, dias: 45 }).ok).toBe(true);
  });
  it('rechaza factor 0, negativo, enorme o no numérico', () => {
    for (const factor of [0, -1, 11, Number.NaN, Infinity]) expect(validarParametrosAldi({ factor, dias: 30 }).ok).toBe(false);
  });
  it('rechaza días no enteros, 0 o más de 90', () => {
    for (const dias of [0, -5, 1.5, 91]) expect(validarParametrosAldi({ factor: 1.5, dias }).ok).toBe(false);
  });
  it('etiqueta del período', () => {
    expect(etiquetaPeriodo(30)).toBe('mensual');
    expect(etiquetaPeriodo(15)).toBe('15 días');
    expect(etiquetaPeriodo(1)).toBe('1 día');
  });
});
