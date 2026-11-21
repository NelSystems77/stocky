import { describe, expect, it } from 'vitest';
import { aplicarAjustes, calcularPedidoAldi } from '@/lib/domain/pedidoAldi';
import { generarExcel } from './excel';
import { generarPdf } from './pdf';
import { reportePedidoAldi } from './pedidoAldi';

const emisor = { usuario: 'Ana Pérez', unidad: '771', generadoEn: new Date('2026-11-21T18:00:00Z') };
const meta = { fecha: '2026-11-21', fechaReporteSifa: '2026-11-20', factor: 1.5, dias: 30 };

const { lineas } = calcularPedidoAldi(
  [
    { codigo: '110-16-0010', descripcion: 'PARACETAMOL 500 MG', ud: 'CN', cuota: 10000, existencia: 4000 },
    { codigo: '110-20-0001', descripcion: 'JERINGA 5 ML', ud: 'FC', cuota: 10, existencia: 4 },
  ],
  { factor: 1.5, dias: 30 },
);

describe('reportePedidoAldi', () => {
  const r = reportePedidoAldi(lineas, meta, emisor);

  it('tiene encabezado, columnas y nombre de archivo', () => {
    expect(r.titulo).toBe('Pedido al ALDI');
    expect(r.usuario).toBe('Ana Pérez');
    expect(r.unidad).toBe('771');
    expect(r.columnas).toEqual(['Código', 'Descripción', 'UD', 'Cuota', 'Existencia', 'Objetivo', 'A pedir']);
    expect(r.nombreArchivo).toBe('pedido_aldi_20261121');
  });
  it('el detalle dice el período, el factor, la fecha del reporte de SIFA y la fórmula', () => {
    const d = r.detalle.join(' ');
    expect(d).toContain('mensual');
    expect(d).toContain('factor 1,5');
    expect(d).toContain('20 de noviembre 2026');
    expect(d).toContain('cuota × factor');
  });
  it('cuota, existencia y objetivo van en la UD del producto y «A pedir» es un entero', () => {
    expect(r.filas[0]).toEqual(['110-16-0010', 'PARACETAMOL 500 MG', 'CN', '100', '40', '150', 110]);
    expect(r.filas[1]).toEqual(['110-20-0001', 'JERINGA 5 ML', 'FC', '10', '4', '15', 11]);
  });
  it('el resumen cuenta los productos, avisa que es una propuesta y menciona los ajustes solo si los hay', () => {
    expect(r.resumen[0]).toBe('Productos a pedir: 2');
    expect(r.resumen.join(' ')).toContain('propuesta');
    expect(r.resumen.join(' ')).not.toContain('ajustadas');
    const ajustado = reportePedidoAldi(aplicarAjustes(lineas, { '110-16-0010': '120' }), meta, emisor);
    expect(ajustado.resumen.join(' ')).toContain('Cantidades ajustadas a mano: 1');
    expect(ajustado.filas[0]?.[6]).toBe(120);
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
