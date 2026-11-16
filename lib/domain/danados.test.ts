import { describe, expect, it } from 'vitest';
import { danadosDelMes, ordenarDanados, totalesDanados, validarDanado, type EntradaDanado, type RegistroDanado } from './danados';

const entrada = (extra: Partial<EntradaDanado> = {}): EntradaDanado => ({
  fecha: '2026-11-16',
  codigo: '110-16-0010',
  lote: ' L123 ',
  cantidad: 3,
  motivo: 'quebrado',
  notas: '',
  ...extra,
});
const r = (id: string, codigo: string, fecha: string, cantidad: number, motivo: RegistroDanado['motivo'] = 'quebrado'): RegistroDanado => ({
  id,
  codigo,
  fecha,
  cantidad,
  motivo,
  lote: '',
  notas: '',
  fotoRuta: null,
});

describe('validarDanado', () => {
  it('acepta una entrada correcta y limpia el lote', () => {
    const res = validarDanado(entrada());
    expect(res.ok && res.valor.lote).toBe('L123');
  });
  it('normaliza el código antes de validarlo', () => {
    const res = validarDanado(entrada({ codigo: ' 1-10-16-0010 ' }));
    expect(res.ok && res.valor.codigo).toBe('110-16-0010');
  });
  it('rechaza código inválido, cantidad no positiva y fecha mala', () => {
    expect(validarDanado(entrada({ codigo: 'abc' })).ok).toBe(false);
    expect(validarDanado(entrada({ cantidad: 0 })).ok).toBe(false);
    expect(validarDanado(entrada({ cantidad: -2 })).ok).toBe(false);
    expect(validarDanado(entrada({ cantidad: Number.NaN })).ok).toBe(false);
    expect(validarDanado(entrada({ fecha: '16/11/2026' })).ok).toBe(false);
  });
  it('acepta decimales (media caja) y recorta notas largas', () => {
    const res = validarDanado(entrada({ cantidad: 0.5, notas: 'x'.repeat(600) }));
    expect(res.ok && res.valor.cantidad).toBe(0.5);
    expect(res.ok && res.valor.notas.length).toBe(500);
  });
});

describe('ordenarDanados y danadosDelMes', () => {
  const lista = [r('1', 'B', '2026-10-30', 1), r('2', 'A', '2026-11-02', 1), r('3', 'A', '2026-11-10', 1), r('4', 'B', '2026-11-10', 1)];
  it('ordena del más reciente al más antiguo y desempata por código', () => {
    expect(ordenarDanados(lista).map((x) => x.id)).toEqual(['3', '4', '2', '1']);
  });
  it('no modifica la lista original', () => {
    const copia = [...lista];
    ordenarDanados(lista);
    expect(lista).toEqual(copia);
  });
  it('filtra por mes YYYY-MM', () => {
    expect(danadosDelMes(lista, '2026-11').map((x) => x.id)).toEqual(['2', '3', '4']);
    expect(danadosDelMes(lista, '2026-12')).toEqual([]);
  });
});

describe('totalesDanados', () => {
  it('suma por motivo y por producto, de mayor a menor', () => {
    const t = totalesDanados([r('1', 'A', '2026-11-01', 5, 'quebrado'), r('2', 'B', '2026-11-02', 20, 'derramado'), r('3', 'A', '2026-11-03', 2.5, 'otro')]);
    expect(t.registros).toBe(3);
    expect(t.unidades).toBe(27.5);
    expect(t.porMotivo).toEqual({ quebrado: 5, derramado: 20, otro: 2.5 });
    expect(t.porProducto).toEqual([
      { codigo: 'B', unidades: 20, registros: 1 },
      { codigo: 'A', unidades: 7.5, registros: 2 },
    ]);
  });
  it('sin registros devuelve ceros', () => {
    expect(totalesDanados([])).toEqual({ registros: 0, unidades: 0, porMotivo: { quebrado: 0, derramado: 0, otro: 0 }, porProducto: [] });
  });
});
