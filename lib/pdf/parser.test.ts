import { describe, expect, it } from 'vitest';
import { agruparLineas } from './lineas';
import { parsearReporte } from './parser';
import { ErrorReporte } from './tipos';

const EXISTENCIAS = [
  'Fecha: 12/11/2026',
  'CAJA COSTARRICENSE DE SEGURO SOCIAL',
  'Rpt_ExistenciasDespacho.rpt',
  'Unidad Ejecutora : 2217 AREA DE SALUD DE CORONADO',
  'Centro Médico: 2217 AREA DE SALUD CORONADO',
  'Reporte de existencias de Despacho 771',
  'SIN FILTRO',
  'CODIGO UD DESCRIPCION DEL PRODUCTO CUOTA Cuota Mínima EXISTENCIA',
  '110-16-0010 CN PARACETAMOL 500 MG, TABLETA 5,220.000 2610 0.000',
  '110-11-0030 CN ACIDO ACETIL SALICILICO 100 MG. TABLETA 3,140.000 1570 474.000',
  '110-04-0044 CN CÁPSULA 300 MILIGRAMOS (COMO SULFA',
  'ABACAVIR 0.000 0 0.000',
  '470-06-2403 UD ETIQUETAS ADHESIVAS CON INDICACIONE 0.000 0 2.000',
  '4',
];

const DESPACHO = [
  'CAJA COSTARRICENSE DE SEGURO SOCIAL Fecha: 01/11/2024',
  'Reporte de Productos en Despacho RptSIFA032.rpt',
  'Unidad Ejecutora: 2217 2217',
  'Centro de Salud: 221713 EBAIS IPIS-ZETILLAL',
  'Despacho: 13 EBAIS ZETILLAL',
  'PRODUCTO EXISTENCIA CUOTA CONSUMO',
  '1-10-16-0010 CN PARACETAMOL 500 MG, TABLETA 128.500 480.000 332.300',
  '4-60-04-0001 UD BOLSAS DE PAPEL DE 1.8 KG (4 LIB 4,000.000 4,000.000 0.000',
  'TOTAL PRODUCTOS: 2',
];

describe('parsearReporte · existencias de despacho 771', () => {
  const r = parsearReporte(EXISTENCIAS);

  it('detecta tipo, fecha, despacho y centro', () => {
    expect(r.tipo).toBe('existenciasDespacho');
    expect(r.fechaReporte).toBe('2026-11-12');
    expect(r.despacho.codigo).toBe('771');
    expect(r.centro).toBe('2217 AREA DE SALUD CORONADO');
  });

  it('lee las columnas del encabezado en su orden', () => {
    expect(r.columnas).toEqual(['cuota', 'cuotaMinima', 'existencia']);
  });

  it('lee cantidades con separador de miles', () => {
    const p = r.filas.find((f) => f.codigo === '110-16-0010');
    expect(p).toMatchObject({ ud: 'CN', cuota: 5220, cuotaMinima: 2610, existencia: 0, dudosa: false });
    expect(r.filas.find((f) => f.codigo === '110-11-0030')?.existencia).toBe(474);
  });

  it('une la descripción partida y marca la fila como dudosa', () => {
    const p = r.filas.find((f) => f.codigo === '110-04-0044');
    expect(p?.descripcion).toBe('ABACAVIR CÁPSULA 300 MILIGRAMOS (COMO SULFA');
    expect(p?.dudosa).toBe(true);
  });

  it('cuadra contra el total declarado', () => {
    expect(r.totalDeclarado).toBe(4);
    expect(r.filas).toHaveLength(4);
    expect(r.advertencias).toEqual([]);
  });

  it('avisa cuando el total no cuadra', () => {
    const r2 = parsearReporte([...EXISTENCIAS.slice(0, -1), '9']);
    expect(r2.advertencias.join(' ')).toMatch(/declara 9 productos pero leí 4/);
  });
});

describe('parsearReporte · productos en despacho (EBAIS)', () => {
  const r = parsearReporte(DESPACHO);

  it('usa el orden de columnas de este reporte', () => {
    expect(r.tipo).toBe('productosEnDespacho');
    expect(r.columnas).toEqual(['existencia', 'cuota', 'consumo']);
    expect(r.filas[0]).toMatchObject({ existencia: 128.5, cuota: 480, consumo: 332.3 });
  });

  it('normaliza el código 1-10-16-0010 a 110-16-0010', () => {
    expect(r.filas[0]?.codigo).toBe('110-16-0010');
    expect(r.filas[1]?.codigo).toBe('460-04-0001');
  });

  it('lee fecha y despacho', () => {
    expect(r.fechaReporte).toBe('2024-11-01');
    expect(r.despacho).toEqual({ codigo: '13', nombre: 'EBAIS ZETILLAL' });
    expect(r.totalDeclarado).toBe(2);
    expect(r.advertencias).toEqual([]);
  });

  it('no confunde números dentro de la descripción con columnas', () => {
    expect(r.filas[1]?.descripcion).toBe('BOLSAS DE PAPEL DE 1.8 KG (4 LIB');
    expect(r.filas[1]?.existencia).toBe(4000);
  });
});

describe('parsearReporte · errores', () => {
  it('rechaza un PDF que no es un reporte conocido', () => {
    expect(() => parsearReporte(['Factura 123', 'Total 5'])).toThrow(ErrorReporte);
  });
  it('rechaza un reporte sin filas', () => {
    expect(() => parsearReporte(DESPACHO.slice(0, 6))).toThrow(/filas de productos/);
  });
  it('avisa de códigos repetidos', () => {
    const r = parsearReporte([...DESPACHO.slice(0, 7), DESPACHO[6]!]);
    expect(r.advertencias.join(' ')).toMatch(/repetido/);
    expect(r.filas).toHaveLength(1);
  });
});

describe('agruparLineas', () => {
  it('ordena por posición y une fragmentos de la misma línea', () => {
    const lineas = agruparLineas([
      { texto: '0.000', x: 300, y: 700, ancho: 25 },
      { texto: '110-16-0010', x: 20, y: 700.5, ancho: 60 },
      { texto: 'CN', x: 90, y: 700, ancho: 10 },
      { texto: 'SIGUIENTE', x: 20, y: 690, ancho: 50 },
    ]);
    expect(lineas).toEqual(['110-16-0010 CN 0.000', 'SIGUIENTE']);
  });

  it('descarta el fragmento dibujado encima de la descripción visible', () => {
    const lineas = agruparLineas([
      { texto: '110-04-0044', x: 17, y: 459, ancho: 46 },
      { texto: 'CN', x: 96, y: 459, ancho: 12 },
      { texto: 'ABACAVIR 300 MILIGRAMOS (COMO SULFA', x: 120, y: 459, ancho: 185 },
      { texto: 'CÁPSULA', x: 120, y: 459.2, ancho: 41 },
      { texto: '0.000', x: 348, y: 460, ancho: 18 },
    ]);
    expect(lineas).toEqual(['110-04-0044 CN ABACAVIR 300 MILIGRAMOS (COMO SULFA 0.000']);
  });
});
