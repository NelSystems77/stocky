import { describe, expect, it } from 'vitest';
import { codigoDeLote, esReporteLotes, fechaDeLote, parsearLotes } from './lotes';
import { ErrorReporte } from './tipos';

// Líneas con el mismo formato que imprime SIFA (Rpt_VenceBodega), tal como las reconstruye `agruparLineas`.
const ENCABEZADO = [
  'Fecha 20/11/2026',
  'CAJA COSTARRICENSE DE SEGURO SOCIAL',
  'Página 1',
  'Rpt_VenceBodega.rpt',
  '2217 AREA DE SALUD DE CORONADO',
  '2217 AREA DE SALUD CORONADO',
  '771 ALMACÉN LOCAL DE MEDICAMENTOS',
  'Reporte por Lotes Próximos a Vencer como límite al 20/11/2070',
  'Existencia',
  'Producto Lote Vence Valor',
];

const reporte = (filas: string[], total: string | null) => [...ENCABEZADO, ...filas, ...(total ? [`Total general ${total}`] : [])];

describe('fechaDeLote', () => {
  it('convierte los meses del reporte, incluido «sept»', () => {
    expect(fechaDeLote('31-ene-2029')).toBe('2029-01-31');
    expect(fechaDeLote('30-sept-2027')).toBe('2027-09-30');
    expect(fechaDeLote('01-abr-2028')).toBe('2028-04-01');
    expect(fechaDeLote('02-may-2030')).toBe('2030-05-02');
    expect(fechaDeLote('19-ago-2030')).toBe('2030-08-19');
  });
  it('rechaza meses desconocidos y días que no existen', () => {
    expect(fechaDeLote('31-xyz-2029')).toBeNull();
    expect(fechaDeLote('31-feb-2028')).toBeNull();
    expect(fechaDeLote('29-feb-2028')).toBe('2028-02-29');
    expect(fechaDeLote('basura')).toBeNull();
  });
});

describe('esReporteLotes', () => {
  it('lo reconoce por el nombre del reporte o por su título', () => {
    expect(esReporteLotes(ENCABEZADO)).toBe(true);
    expect(esReporteLotes(['Reporte por Lotes Próximos a Vencer como límite al 20/11/2070'])).toBe(true);
    expect(esReporteLotes(['Rpt_ExistenciasDespacho'])).toBe(false);
  });
});

describe('códigos en cualquiera de sus formas (XXX-XX-XXXX y X-XX-XX-XXXX)', () => {
  it('las tres formas son el mismo código canónico', () => {
    expect(codigoDeLote('110-16-0010')).toBe('110-16-0010');
    expect(codigoDeLote('1-10-16-0010')).toBe('110-16-0010');
    expect(codigoDeLote('1 10 16 10')).toBe('110-16-0010');
    expect(codigoDeLote('2-27-02-0140')).toBe('227-02-0140');
    expect(codigoDeLote('2 27 2 140')).toBe('227-02-0140');
  });
  it('rechaza lo que no es un código', () => {
    expect(codigoDeLote('11-016-0010')).toBeNull();
    expect(codigoDeLote('1 10 16')).toBeNull();
  });
  it('un reporte con códigos de forma mixta se lee igual y no duplica productos', () => {
    const r = parsearLotes(
      reporte(
        [
          '110-16-0010 CN PARACETAMOL 500 MG, T 250242 18-feb-2030 4256.800 2,077,658.94',
          '1-10-16-0010 CN PARACETAMOL 500 MG, T 250243 18-mar-2030 100.000 1,000.00',
          '1 10 16 10 CN PARACETAMOL 500 MG, T 250244 18-abr-2030 50.000 500.00',
          '2-27-02-0140 UD PRESERVATIVO ( CONDON 2025082 19-ago-2030 1960.000 69,795.60',
        ],
        '2,148,954.54',
      ),
    );
    expect(r.filas.map((f) => f.codigo)).toEqual(['110-16-0010', '110-16-0010', '110-16-0010', '227-02-0140']);
    expect(r.cuadra).toBe(true);
    expect(r.advertencias).toEqual([]);
  });
  it('la forma de cuatro columnas también funciona con la descripción partida', () => {
    const r = parsearLotes(reporte(['CN MOFETILO 250 MG (COMO FD25237', '1-10-04-0045 30-mar-2027 14.400 195,391.58'], '195,391.58'));
    expect(r.filas[0]).toMatchObject({ codigo: '110-04-0045', lote: 'FD25237', dudosa: true });
    const r2 = parsearLotes(reporte(['CN MOFETILO 250 MG (COMO FD25237', '110-04-0045 30-mar-2027 14.400 195,391.58'], '195,391.58'));
    expect(r2.filas[0]?.codigo).toBe('110-04-0045');
  });
});

describe('parsearLotes', () => {
  const filas = [
    '1 10 13 3 CN ROSUVASTATINA 10 MG C B260225 31-ene-2029 2544.360 4,664,498.86',
    '1 10 16 10 CN PARACETAMOL 500 MG, T 250242 18-feb-2030 4256.800 2,077,658.94',
    '1 10 11 30 CN ACIDO ACETIL SALICILI L521 30-nov-2027 185.000 61,778.90',
  ];
  const total = '6,803,936.70';

  it('lee el encabezado y rearma el código desde sus cuatro columnas', () => {
    const r = parsearLotes(reporte(filas, total));
    expect(r.fechaReporte).toBe('2026-11-20');
    expect(r.limite).toBe('2070-11-20');
    expect(r.despacho).toEqual({ codigo: '771', nombre: 'ALMACÉN LOCAL DE MEDICAMENTOS' });
    expect(r.filas.map((f) => f.codigo)).toEqual(['110-13-0003', '110-16-0010', '110-11-0030']);
  });

  it('lee lote, vencimiento, existencia en la UD del reporte y valor', () => {
    const f = parsearLotes(reporte(filas, total)).filas[0]!;
    expect(f).toMatchObject({ ud: 'CN', lote: 'B260225', vence: '2029-01-31', existencia: 2544.36, valor: 4664498.86, dudosa: false });
    expect(f.descripcion).toBe('ROSUVASTATINA 10 MG C');
  });

  it('cuadra contra el «Total general» del reporte', () => {
    const r = parsearLotes(reporte(filas, total));
    expect(r.cuadra).toBe(true);
    expect(r.sumaValor).toBe(6803936.7);
    expect(r.advertencias).toEqual([]);
  });

  it('avisa si la suma no cuadra con el total declarado', () => {
    const r = parsearLotes(reporte(filas, '7,000,000.00'));
    expect(r.cuadra).toBe(false);
    expect(r.advertencias.join(' ')).toMatch(/no cuadra/);
  });

  it('tolera la diferencia de redondeo del propio reporte', () => {
    expect(parsearLotes(reporte(filas, '6,803,936.71')).cuadra).toBe(true);
  });

  it('avisa si no hay total', () => {
    const r = parsearLotes(reporte(filas, null));
    expect(r.cuadra).toBeNull();
    expect(r.advertencias.join(' ')).toMatch(/Total general/);
  });

  it('une la fila de descripción partida (UD + descripción + lote, y luego código + cantidades) y la marca dudosa', () => {
    const r = parsearLotes(reporte(['CN MOFETILO 250 MG (COMO FD25237', '1 10 4 45 30-mar-2027 14.400 195,391.58'], '195,391.58'));
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({ codigo: '110-04-0045', lote: 'FD25237', vence: '2027-03-30', existencia: 14.4, dudosa: true });
    expect(r.cuadra).toBe(true);
  });

  it('separa existencia y valor pegados', () => {
    const r = parsearLotes(reporte(['4 50 2 109 UD ETIQUETAS BLANCAS AUT 7020000 14-nov-2027 384000.0001,442,995,200.00'], '1,442,995,200.00'));
    expect(r.filas[0]).toMatchObject({ codigo: '450-02-0109', existencia: 384000, valor: 1442995200 });
  });

  it('lee códigos de otros grupos (condones, etiquetas) con ceros completados', () => {
    const r = parsearLotes(
      reporte(['2 27 2 140 UD PRESERVATIVO ( CONDON 2025082 19-ago-2030 1960.000 69,795.60', '4 60 4 2 UD BOLSAS DE PAPEL PARA E RO00600 30-nov-2030 1000.000 29,380.00'], '99,175.60'),
    );
    expect(r.filas.map((f) => f.codigo)).toEqual(['227-02-0140', '460-04-0002']);
  });

  it('un mismo número de lote con dos vencimientos son dos filas', () => {
    const r = parsearLotes(
      reporte(
        ['1 10 42 100 CN ALFACALCIDOL 0.25 MCG 9442501 31-dic-2027 35.000 65,799.65', '1 10 42 100 CN ALFACALCIDOL 0.25 MCG 9442501 31-ene-2028 150.000 281,998.50'],
        '347,798.15',
      ),
    );
    expect(r.filas.map((f) => f.vence)).toEqual(['2027-12-31', '2028-01-31']);
    expect(r.advertencias).toEqual([]);
  });

  it('un lote en varias filas se informa con sus cantidades (no es una advertencia) y las líneas ilegibles se avisan', () => {
    const r = parsearLotes(
      reporte(
        ['1 10 14 2640 CN INDOMETACINA 100 MG., T1AIZ01 31-jul-2028 42.000 199,468.50', '1 10 14 2640 CN INDOMETACINA 100 MG., T1AIZ01 31-jul-2028 16.000 75,988.00', 'esto no es una fila válida'],
        '275,456.50',
      ),
    );
    expect(r.repetidos).toEqual([{ codigo: '110-14-2640', ud: 'CN', lote: 'T1AIZ01', vence: '2028-07-31', cantidades: [42, 16] }]);
    const adv = r.advertencias.join(' | ');
    expect(adv).not.toMatch(/repetido/i);
    expect(adv).toMatch(/1 línea\(s\) del PDF no se pudieron leer/);
    expect(adv).toContain('esto no es una fila válida');
  });
  it('sin lotes repetidos la lista va vacía; tres filas del mismo lote suman tres cantidades', () => {
    expect(parsearLotes(reporte([filas[0]!], '4,664,498.86')).repetidos).toEqual([]);
    const tres = parsearLotes(
      reporte(['1 10 16 10 CN PARACETAMOL 500 MG, T X1 18-feb-2030 1.000 10.00', '1 10 16 10 CN PARACETAMOL 500 MG, T X1 18-feb-2030 2.000 20.00', '1 10 16 10 CN PARACETAMOL 500 MG, T X1 18-feb-2030 3.000 30.00'], '60.00'),
    );
    expect(tres.repetidos[0]?.cantidades).toEqual([1, 2, 3]);
  });
  it('una fecha de vencimiento imposible no se lee como fila y se avisa', () => {
    const r = parsearLotes(reporte(['1 10 13 3 CN ROSUVASTATINA 10 MG C B1 31-feb-2029 1.000 10.00', filas[1]!], '2,077,668.94'));
    expect(r.filas).toHaveLength(1);
    expect(r.advertencias.join(' ')).toMatch(/no se pudieron leer/);
  });

  it('un reporte sin filas o de otro tipo falla con un mensaje claro', () => {
    expect(() => parsearLotes(reporte([], null))).toThrow(ErrorReporte);
    expect(() => parsearLotes(['Rpt_ExistenciasDespacho'])).toThrow(/Rpt_VenceBodega/);
  });
});
