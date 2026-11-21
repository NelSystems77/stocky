import { describe, expect, it } from 'vitest';
import { modulosRegistrosVisibles, veRegistros } from './modulos772';

describe('módulos de Registros según la unidad', () => {
  it('el 771 y el superadmin ven todos', () => {
    expect(modulosRegistrosVisibles('771', false, [])).toEqual(['preconteo', 'traslados', 'vencidos', 'danados']);
    expect(modulosRegistrosVisibles(null, true, [])).toHaveLength(4);
    expect(modulosRegistrosVisibles('772', true, [])).toHaveLength(4);
  });
  it('el 772 sin módulos habilitados no ve nada y no ve el acceso a Registros', () => {
    expect(modulosRegistrosVisibles('772', false, [])).toEqual([]);
    expect(veRegistros('772', false, [])).toBe(false);
  });
  it('el 772 ve solo los de Registros que el 771 le habilitó', () => {
    expect(modulosRegistrosVisibles('772', false, ['traslados', 'danados'])).toEqual(['traslados', 'danados']);
    expect(veRegistros('772', false, ['danados'])).toBe(true);
  });
  it('un módulo habilitado que no es de Registros (pedidos, chango…) no abre Registros', () => {
    expect(veRegistros('772', false, ['pedidos', 'envios', 'chango', 'ubicaciones'])).toBe(false);
  });
  it('Vencidos nunca se muestra al 772, aunque aparezca en su lista', () => {
    expect(modulosRegistrosVisibles('772', false, ['vencidos', 'preconteo'])).toEqual(['preconteo']);
  });
  it('el 771 siempre ve Registros', () => {
    expect(veRegistros('771', false, [])).toBe(true);
  });
});
