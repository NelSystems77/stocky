import { describe, expect, it } from 'vitest';
import {
  crearFoto,
  diferenciaConteo,
  filasConteo,
  formatearCantidad,
  formatearDiferencia,
  leerCantidad,
  resumenConteo,
  validarContado,
  type LineaConteo,
} from './conteo';

const PARACETAMOL = { codigo: '110-16-0010', descripcion: 'PARACETAMOL 500 MG', ud: 'CN', existencia: 20000 };
const JERINGA = { codigo: '110-20-0001', descripcion: 'JERINGA 5 ML', ud: 'FC', existencia: 40 };
const AMOXI = { codigo: '110-05-0003', descripcion: 'AMOXICILINA 500 MG', ud: 'CN', existencia: 5000 };

describe('conversión de unidades sueltas a la UD del producto', () => {
  it('20000 sueltas de un producto CN son 200 CN', () => {
    expect(formatearCantidad(20000, 'CN')).toBe('200 CN');
  });
  it('acepta decimales: 20050 → 200,5 CN', () => {
    const v = validarContado(20050);
    expect(v).toEqual({ ok: true, valor: 20050 });
    expect(formatearCantidad(20050, 'CN').replace(',', '.')).toBe('200.5 CN');
  });
  it('productos con factor 1 se muestran igual que se escribieron', () => {
    expect(formatearCantidad(40, 'FC')).toBe('40 FC');
    expect(formatearCantidad(7, 'TR')).toBe('7 TR');
  });
  it('rechaza lo negativo y lo que no es número; el cero sí vale', () => {
    expect(validarContado(-1).ok).toBe(false);
    expect(validarContado(Number.NaN).ok).toBe(false);
    expect(validarContado(Infinity).ok).toBe(false);
    expect(validarContado(0)).toEqual({ ok: true, valor: 0 });
  });
  it('sin contar se muestra con un guion, no como 0', () => {
    expect(formatearCantidad(null, 'CN')).toBe('—');
  });
});

describe('diferencia = contado − SIFA', () => {
  it('falta producto → signo menos, en la UD del producto', () => {
    expect(diferenciaConteo(20000, 15000)).toBe(-5000);
    expect(formatearDiferencia(-5000, 'CN')).toBe('-50 CN');
  });
  it('sobra producto → signo más', () => {
    expect(diferenciaConteo(20000, 21200)).toBe(1200);
    expect(formatearDiferencia(1200, 'CN')).toBe('+12 CN');
  });
  it('coincide → 0 sin marca', () => {
    expect(diferenciaConteo(40, 40)).toBe(0);
    expect(formatearDiferencia(0, 'FC')).toBe('0');
  });
  it('producto sin contar no tiene diferencia (no cuenta como 0)', () => {
    expect(diferenciaConteo(20000, null)).toBeNull();
    expect(formatearDiferencia(null, 'CN')).toBe('—');
  });
  it('se calcula en unidades base: sin ruido de coma flotante', () => {
    expect(diferenciaConteo(0.3, 0.1 + 0.2)).toBe(0);
  });
});

describe('filas, estados y resumen', () => {
  const foto = crearFoto([PARACETAMOL, JERINGA, AMOXI]);
  const lineas: LineaConteo[] = [
    { codigo: PARACETAMOL.codigo, contado: 15000, observacion: 'caja abierta' },
    { codigo: JERINGA.codigo, contado: 40, observacion: '' },
    { codigo: '110-99-0001', contado: 300, observacion: '', fueraDeSifa: { descripcion: 'PRODUCTO NUEVO', ud: 'CN' } },
  ];
  const filas = filasConteo(foto, lineas);

  it('una fila por producto de la foto más los contados fuera de SIFA, ordenadas por código', () => {
    expect(filas.map((f) => f.codigo)).toEqual(['110-05-0003', '110-16-0010', '110-20-0001', '110-99-0001']);
  });
  it('estados: sin contar, falta, coincide y sobra (fuera de SIFA)', () => {
    const e = Object.fromEntries(filas.map((f) => [f.codigo, f.estado]));
    expect(e).toEqual({ '110-05-0003': 'sinContar', '110-16-0010': 'falta', '110-20-0001': 'coincide', '110-99-0001': 'sobra' });
  });
  it('un contado fuera de SIFA tiene SIFA = 0 y queda marcado', () => {
    const f = filas.find((x) => x.codigo === '110-99-0001');
    expect(f).toMatchObject({ sifa: 0, contado: 300, diferencia: 300, fueraDeSifa: true, descripcion: 'PRODUCTO NUEVO' });
  });
  it('la observación viaja con su fila', () => {
    expect(filas.find((f) => f.codigo === PARACETAMOL.codigo)?.observacion).toBe('caja abierta');
  });
  it('resumen: contados, sin contar, con diferencia, faltantes y sobrantes', () => {
    expect(resumenConteo(filas)).toEqual({ productos: 4, contados: 3, sinContar: 1, conDiferencia: 2, faltantes: 1, sobrantes: 1 });
  });
});

describe('la foto de SIFA se conserva', () => {
  it('importar otro reporte después no cambia las diferencias de un conteo ya iniciado', () => {
    const foto = crearFoto([PARACETAMOL]);
    const lineas: LineaConteo[] = [{ codigo: PARACETAMOL.codigo, contado: 15000, observacion: '' }];
    const antes = filasConteo(foto, lineas);

    // Llega un reporte nuevo con otra existencia: la foto (copia) no se toca.
    const reporteNuevo = [{ ...PARACETAMOL, existencia: 15000 }];
    expect(crearFoto(reporteNuevo)[PARACETAMOL.codigo]?.sifa).toBe(15000);

    expect(filasConteo(foto, lineas)).toEqual(antes);
    expect(antes[0]?.diferencia).toBe(-5000);
  });
  it('crearFoto copia los valores: cambiar el origen después no la altera', () => {
    const origen = { ...PARACETAMOL };
    const foto = crearFoto([origen]);
    origen.existencia = 1;
    expect(foto[PARACETAMOL.codigo]?.sifa).toBe(20000);
  });
  it('con una lista de códigos solo se congelan esos; sin existencia cuenta como 0', () => {
    const foto = crearFoto([PARACETAMOL, JERINGA, { ...AMOXI, existencia: undefined }], new Set([AMOXI.codigo, JERINGA.codigo]));
    expect(Object.keys(foto).sort()).toEqual([AMOXI.codigo, JERINGA.codigo].sort());
    expect(foto[AMOXI.codigo]?.sifa).toBe(0);
  });
});

describe('leerCantidad (lo que la persona escribe)', () => {
  it('enteros, con espacios o puntos de miles', () => {
    expect(leerCantidad('20000')).toBe(20000);
    expect(leerCantidad('20 000')).toBe(20000);
    expect(leerCantidad('20.050')).toBe(20050);
    expect(leerCantidad('1.250.000')).toBe(1250000);
  });
  it('decimales con coma o con punto', () => {
    expect(leerCantidad('0,5')).toBe(0.5);
    expect(leerCantidad('0.5')).toBe(0.5);
    expect(leerCantidad('20.050,5')).toBe(20050.5);
  });
  it('vacío, texto o negativos no son cantidades', () => {
    expect(leerCantidad('')).toBeNull();
    expect(leerCantidad('  ')).toBeNull();
    expect(leerCantidad('abc')).toBeNull();
    expect(leerCantidad('-5')).toBeNull();
    expect(leerCantidad('1,2,3')).toBeNull();
  });
});
