import { describe, expect, it } from 'vitest';
import { aplicarAjustes, calcularPedidoAldi } from '@/lib/domain/pedidoAldi';
import { generarExcel } from './excel';
import { generarPdf } from './pdf';
import { reportePedidoAldi } from './pedidoAldi';

const emisor = { usuario: 'Ana Pérez', unidad: '771', generadoEn: new Date('2026-11-21T18:00:00Z') };
const meta = { fecha: '2026-11-21', fechaReporteSifa: '2026-11-20', factor: 1.5, dias: 30 };

// 20 días hábiles. Consumo mensual: A = 30 CN (3 000 u → 150 u/día), B = 70 CN (350 u/día), C sin consumo cargado.
const { lineas } = calcularPedidoAldi(
  [
    { codigo: '110-16-0010', descripcion: 'PARACETAMOL 500 MG', ud: 'CN', cuota: 10000, existencia: 4000, consumoDiario: 150 },
    { codigo: '110-16-0020', descripcion: 'AMOXICILINA 500 MG', ud: 'CN', cuota: 10000, existencia: 4000, consumoDiario: 350 },
    { codigo: '110-20-0001', descripcion: 'JERINGA 5 ML', ud: 'FC', cuota: 10, existencia: 4, consumoDiario: null },
  ],
  { factor: 1.5, dias: 30, diasHabiles: 20 },
);

describe('reportePedidoAldi', () => {
  const r = reportePedidoAldi(lineas, meta, emisor);

  it('tiene encabezado, columnas y nombre de archivo', () => {
    expect(r.titulo).toBe('Pedido al ALDI');
    expect(r.usuario).toBe('Ana Pérez');
    expect(r.unidad).toBe('771');
    expect(r.columnas).toEqual(['Código', 'Descripción', 'UD', 'Cuota', 'Existencia', 'Consumo del período', 'Objetivo', 'A pedir', 'Nota']);
    expect(r.nombreArchivo).toBe('pedido_aldi_20261121');
  });
  it('el detalle dice el período, el factor, la fecha del reporte de SIFA y la fórmula con el tope de la cuota', () => {
    const d = r.detalle.join(' ');
    expect(d).toContain('mensual');
    expect(d).toContain('factor 1,5');
    expect(d).toContain('20 de noviembre 2026');
    expect(d).toContain('lo menor entre la cuota');
  });
  it('cuota, existencia, consumo y objetivo van en la UD del producto y «A pedir» es un entero', () => {
    expect(r.filas[0]).toEqual(['110-16-0010', 'PARACETAMOL 500 MG', 'CN', '100', '40', '30', '45', 5, '']);
  });
  it('una línea limitada por la cuota lo dice en la nota y nunca pasa la cuota', () => {
    const f = r.filas[1];
    expect(f).toEqual(['110-16-0020', 'AMOXICILINA 500 MG', 'CN', '100', '40', '70', '100', 60, 'Limitada por la cuota']);
  });
  it('una línea sin consumo se repone hasta la cuota y lo dice', () => {
    expect(r.filas[2]).toEqual(['110-20-0001', 'JERINGA 5 ML', 'FC', '10', '4', '—', '10', 6, 'Sin consumo: hasta la cuota']);
  });
  it('el resumen cuenta los productos, las limitadas, las sin consumo y avisa que es una propuesta', () => {
    const txt = r.resumen.join(' | ');
    expect(r.resumen[0]).toBe('Productos a pedir: 3');
    expect(txt).toContain('Limitadas por la cuota: 1');
    expect(txt).toContain('cuota está actualizada');
    expect(txt).toContain('Sin consumo cargado: 1');
    expect(txt).toContain('propuesta');
    expect(txt).not.toContain('ajustadas');
  });
  it('menciona los ajustes a mano solo si los hay y los refleja en «A pedir»', () => {
    const ajustado = reportePedidoAldi(aplicarAjustes(lineas, { '110-16-0010': '8' }), meta, emisor);
    expect(ajustado.resumen.join(' ')).toContain('Cantidades ajustadas a mano: 1');
    expect(ajustado.filas[0]?.[7]).toBe(8);
  });
  it('un pedido guardado con la primera versión (sin consumo ni criterio) se exporta sin nota', () => {
    const viejo = reportePedidoAldi([{ codigo: '110-16-0010', descripcion: 'X', ud: 'CN', cuota: 10000, existencia: 4000, objetivo: 15000, calculada: 110, cantidad: 110 }], meta, emisor);
    expect(viejo.filas[0]).toEqual(['110-16-0010', 'X', 'CN', '100', '40', '—', '150', 110, '']);
  });
  it('un período de 15 días se nombra así', () => {
    expect(reportePedidoAldi(lineas, { ...meta, dias: 15 }, emisor).detalle[0]).toContain('15 días');
  });
});

describe('exportar el pedido', () => {
  it('genera un PDF y un Excel válidos', async () => {
    const datos = reportePedidoAldi(lineas, meta, emisor);
    expect(new TextDecoder().decode((await generarPdf(datos)).slice(0, 5))).toBe('%PDF-');
    expect(new TextDecoder('latin1').decode((await generarExcel(datos)).slice(0, 2))).toBe('PK');
  });
});
