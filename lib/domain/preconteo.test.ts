import { describe, expect, it } from 'vitest';
import {
  diferenciaPreconteo,
  estadoPreconteo,
  ordenarPreconteos,
  preconteosDelMes,
  preconteosPendientes,
  totalesPreconteo,
  validarPreconteo,
  validarRecepcion,
  type EntradaPreconteo,
  type RegistroPreconteo,
} from './preconteo';

const entrada = (extra: Partial<EntradaPreconteo> = {}): EntradaPreconteo => ({
  fecha: '2026-11-16',
  codigo: '110-16-0010',
  cantidad: 5,
  ud: 'CN',
  presentacion: 30,
  notas: '',
  ...extra,
});
const r = (id: string, codigo: string, fecha: string, cantidad: number, recibida: number | null, presentacion = 30): RegistroPreconteo => ({
  id,
  codigo,
  fecha,
  cantidad,
  presentacion,
  recibida,
  notas: '',
});

describe('validarPreconteo', () => {
  it('convierte la cantidad en cientos a unidades base', () => {
    const res = validarPreconteo(entrada({ cantidad: 5, ud: 'CN' }));
    expect(res.ok && res.valor.cantidad).toBe(500);
  });
  it('acepta decimales en cientos y UD con factor 1', () => {
    const a = validarPreconteo(entrada({ cantidad: 1.5 }));
    expect(a.ok && a.valor.cantidad).toBe(150);
    const b = validarPreconteo(entrada({ cantidad: 12, ud: 'FC' }));
    expect(b.ok && b.valor.cantidad).toBe(12);
  });
  it('acepta presentaciones habituales y otras enteras', () => {
    for (const p of [30, 60, 90, 45]) expect(validarPreconteo(entrada({ presentacion: p })).ok).toBe(true);
  });
  it('rechaza código, cantidad, presentación y fecha inválidos', () => {
    expect(validarPreconteo(entrada({ codigo: 'abc' })).ok).toBe(false);
    expect(validarPreconteo(entrada({ cantidad: 0 })).ok).toBe(false);
    expect(validarPreconteo(entrada({ cantidad: Number.NaN })).ok).toBe(false);
    expect(validarPreconteo(entrada({ presentacion: 0 })).ok).toBe(false);
    expect(validarPreconteo(entrada({ presentacion: 2.5 })).ok).toBe(false);
    expect(validarPreconteo(entrada({ fecha: '16/11/2026' })).ok).toBe(false);
  });
  it('normaliza el código y recorta las notas', () => {
    const res = validarPreconteo(entrada({ codigo: '1-10-16-0010', notas: 'x'.repeat(600) }));
    expect(res.ok && res.valor.codigo).toBe('110-16-0010');
    expect(res.ok && res.valor.notas.length).toBe(500);
  });
});

describe('validarRecepcion', () => {
  it('convierte a unidades base y acepta 0', () => {
    const a = validarRecepcion(4.5, 'CN');
    expect(a.ok && a.valor).toBe(450);
    const b = validarRecepcion(0, 'CN');
    expect(b.ok && b.valor).toBe(0);
  });
  it('rechaza negativos y NaN', () => {
    expect(validarRecepcion(-1, 'CN').ok).toBe(false);
    expect(validarRecepcion(Number.NaN, 'CN').ok).toBe(false);
  });
});

describe('estado y diferencia', () => {
  it('pendiente mientras no vuelva, sin diferencia', () => {
    expect(estadoPreconteo(r('1', 'A', '2026-11-02', 500, null))).toBe('pendiente');
    expect(diferenciaPreconteo(r('1', 'A', '2026-11-02', 500, null))).toBeNull();
  });
  it('completo cuando volvió todo', () => {
    expect(estadoPreconteo(r('1', 'A', '2026-11-02', 500, 500))).toBe('completo');
    expect(diferenciaPreconteo(r('1', 'A', '2026-11-02', 500, 500))).toBe(0);
  });
  it('con diferencia: signo negativo si falta, positivo si sobra', () => {
    expect(diferenciaPreconteo(r('1', 'A', '2026-11-02', 500, 450))).toBe(-50);
    expect(diferenciaPreconteo(r('1', 'A', '2026-11-02', 500, 520))).toBe(20);
    expect(estadoPreconteo(r('1', 'A', '2026-11-02', 500, 450))).toBe('conDiferencia');
  });
  it('recibir 0 de lo entregado es una diferencia, no "pendiente"', () => {
    expect(estadoPreconteo(r('1', 'A', '2026-11-02', 500, 0))).toBe('conDiferencia');
  });
});

describe('listas', () => {
  const lista = [r('1', 'B', '2026-10-30', 100, 100), r('2', 'A', '2026-11-02', 100, null), r('3', 'A', '2026-11-10', 100, null), r('4', 'B', '2026-11-10', 100, 90)];
  it('ordena del más reciente al más antiguo', () => {
    expect(ordenarPreconteos(lista).map((x) => x.id)).toEqual(['3', '4', '2', '1']);
  });
  it('filtra por mes', () => {
    expect(preconteosDelMes(lista, '2026-11').map((x) => x.id)).toEqual(['2', '3', '4']);
  });
  it('pendientes: los más antiguos primero', () => {
    expect(preconteosPendientes(lista).map((x) => x.id)).toEqual(['2', '3']);
  });
});

describe('totalesPreconteo', () => {
  it('agrupa por producto y presentación', () => {
    const t = totalesPreconteo([
      r('1', 'A', '2026-11-02', 500, 500, 30),
      r('2', 'A', '2026-11-09', 300, null, 30),
      r('3', 'A', '2026-11-10', 200, 190, 60),
      r('4', 'B', '2026-11-11', 100, 100, 90),
    ]);
    expect(t.entregas).toBe(4);
    expect(t.pendientes).toBe(1);
    expect(t.conDiferencia).toBe(1);
    expect(t.porProducto).toEqual([
      { codigo: 'A', presentacion: 30, entregado: 800, recibido: 500, entregas: 2, pendientes: 1 },
      { codigo: 'A', presentacion: 60, entregado: 200, recibido: 190, entregas: 1, pendientes: 0 },
      { codigo: 'B', presentacion: 90, entregado: 100, recibido: 100, entregas: 1, pendientes: 0 },
    ]);
  });
  it('sin registros devuelve ceros', () => {
    expect(totalesPreconteo([])).toEqual({ entregas: 0, pendientes: 0, conDiferencia: 0, porProducto: [] });
  });
});
