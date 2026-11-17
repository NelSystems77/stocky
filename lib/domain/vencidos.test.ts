import { describe, expect, it } from 'vitest';
import { ordenarVencidos, totalesVencidos, validarVencido, vencidosDelMes, type EntradaVencido, type RegistroVencido } from './vencidos';

const entrada = (extra: Partial<EntradaVencido> = {}): EntradaVencido => ({
  fecha: '2026-11-16',
  codigo: '110-16-0010',
  lote: ' L77 ',
  fechaVencimiento: '2026-11-01',
  cantidad: 40,
  notas: '',
  ...extra,
});
const r = (id: string, codigo: string, fecha: string, cantidad: number, lote = 'L1'): RegistroVencido => ({
  id,
  codigo,
  fecha,
  lote,
  fechaVencimiento: '2026-10-31',
  cantidad,
  origen: 'manual',
  notas: '',
});

describe('validarVencido', () => {
  it('acepta una entrada correcta y limpia el lote', () => {
    const res = validarVencido(entrada());
    expect(res.ok && res.valor.lote).toBe('L77');
  });
  it('normaliza el código', () => {
    const res = validarVencido(entrada({ codigo: '1-10-16-0010' }));
    expect(res.ok && res.valor.codigo).toBe('110-16-0010');
  });
  it('rechaza código, fechas, cantidad y lote vacío inválidos', () => {
    expect(validarVencido(entrada({ codigo: 'abc' })).ok).toBe(false);
    expect(validarVencido(entrada({ fecha: 'ayer' })).ok).toBe(false);
    expect(validarVencido(entrada({ fechaVencimiento: '01/11/2026' })).ok).toBe(false);
    expect(validarVencido(entrada({ cantidad: 0 })).ok).toBe(false);
    expect(validarVencido(entrada({ lote: '   ' })).ok).toBe(false);
  });
});

describe('listas y totales', () => {
  const lista = [r('1', 'B', '2026-10-30', 10), r('2', 'A', '2026-11-02', 5), r('3', 'A', '2026-11-10', 2.5, 'L2')];
  it('ordena del más reciente al más antiguo', () => {
    expect(ordenarVencidos(lista).map((x) => x.id)).toEqual(['3', '2', '1']);
  });
  it('filtra por mes', () => {
    expect(vencidosDelMes(lista, '2026-11').map((x) => x.id)).toEqual(['2', '3']);
  });
  it('totales: registros, unidades y productos distintos', () => {
    expect(totalesVencidos(lista)).toEqual({ registros: 3, unidades: 17.5, productos: 2 });
    expect(totalesVencidos([])).toEqual({ registros: 0, unidades: 0, productos: 0 });
  });
});
