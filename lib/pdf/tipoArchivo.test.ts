import { describe, expect, it } from 'vitest';
import { detectarTipoArchivo, resolverTipoArchivo } from './tipoArchivo';

const EXISTENCIAS = ['Fecha: 12/11/2026', 'Rpt_ExistenciasDespacho.rpt', 'Reporte de existencias de Despacho 771'];
const CONSUMOS = ['CAJA COSTARRICENSE DE SEGURO SOCIAL Fecha: 01/11/2024', 'Reporte de Productos en Despacho RptSIFA032.rpt'];
const LOTES = ['Fecha: 20/11/2026', 'Rpt_VenceBodega.rpt', 'Reporte por lotes próximos a vencer'];

describe('detectarTipoArchivo', () => {
  it('reconoce los tres reportes por su encabezado', () => {
    expect(detectarTipoArchivo(EXISTENCIAS)).toBe('existenciasDespacho');
    expect(detectarTipoArchivo(CONSUMOS)).toBe('productosEnDespacho');
    expect(detectarTipoArchivo(LOTES)).toBe('lotesVencimientos');
  });
  it('un PDF cualquiera no se reconoce', () => {
    expect(detectarTipoArchivo(['Factura 123', 'Total 50.000'])).toBeNull();
  });
});

describe('resolverTipoArchivo', () => {
  it('en automático manda lo detectado', () => {
    expect(resolverTipoArchivo('auto', 'lotesVencimientos')).toEqual({ ok: true, tipo: 'lotesVencimientos' });
    expect(resolverTipoArchivo('auto', 'productosEnDespacho')).toEqual({ ok: true, tipo: 'productosEnDespacho' });
  });
  it('si la persona eligió el tipo correcto, pasa', () => {
    expect(resolverTipoArchivo('existenciasDespacho', 'existenciasDespacho')).toEqual({ ok: true, tipo: 'existenciasDespacho' });
  });
  it('si eligió un tipo y el PDF es de otro, no pasa y el mensaje dice cuál es cuál', () => {
    const r = resolverTipoArchivo('lotesVencimientos', 'existenciasDespacho');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('Lotes y vencimientos');
      expect(r.error).toContain('Existencias de despacho');
      expect(r.error).toContain('No se guardó nada');
    }
  });
  it('un PDF no reconocido no pasa, ni en automático ni con un tipo elegido', () => {
    expect(resolverTipoArchivo('auto', null).ok).toBe(false);
    expect(resolverTipoArchivo('productosEnDespacho', null).ok).toBe(false);
  });
});
