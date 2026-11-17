import { describe, expect, it } from 'vitest';
import type { Ocurrencia } from '@/lib/domain/tareas';
import { generarExcelResumen } from './excel';
import { generarPdfResumen } from './pdf';
import { inicioFinMes, reporteResumenMensual, type DatosMes } from './resumen';

const emisor = { usuario: 'Ana Pérez', unidad: '771', generadoEn: new Date('2026-11-30T18:00:00Z') };

const oc = (titulo: string, estado: Ocurrencia['estado'], fecha = '2026-11-10'): Ocurrencia => ({
  tareaId: titulo,
  fechaOrigen: fecha,
  fechaVence: fecha,
  estado,
  titulo,
  hora: null,
  prioridad: 'media',
  notas: '',
});

const datos: DatosMes = {
  mes: '2026-11',
  hasta: '2026-11-30',
  ocurrencias: [oc('Temperatura AM', 'hecha'), oc('Temperatura AM', 'hecha'), oc('Temperatura AM', 'pendiente'), oc('Preconteo', 'descartada')],
  preconteos: [
    { id: '1', fecha: '2026-11-02', codigo: '110-16-0010', cantidad: 500, presentacion: 30, recibida: 500, notas: '' },
    { id: '2', fecha: '2026-10-28', codigo: '110-16-0010', cantidad: 999, presentacion: 30, recibida: null, notas: '' },
  ],
  traslados: [
    { id: '1', fecha: '2026-11-05', ordenSAP: '5000012345', tipo: 'envio', unidad: 'Hospital', items: [{ codigo: '110-16-0010', cantidad: 100 }], estado: 'enviado', fechaCierre: '2026-11-06', enSAP: true, enSIFA: false, notas: '' },
  ],
  danados: [{ id: '1', fecha: '2026-11-08', codigo: '110-16-0010', lote: 'L1', cantidad: 50, motivo: 'quebrado', notas: '', fotoRuta: null }],
  vencidos: [],
  agotados: [
    { id: '1', codigo: '110-16-0010', fechaAgotado: '2026-11-03', fechaIngreso: '2026-11-12', origen: 'detectado', notas: '' },
    { id: '2', codigo: '110-16-0010', fechaAgotado: '2026-09-01', fechaIngreso: '2026-09-10', origen: 'detectado', notas: '' },
  ],
  descripciones: new Map([['110-16-0010', 'Amoxicilina 500 mg']]),
  uds: new Map([['110-16-0010', 'CN']]),
};

describe('inicioFinMes', () => {
  it('da el primero y el último día, también en febrero', () => {
    expect(inicioFinMes('2026-11')).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' });
    expect(inicioFinMes('2028-02')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });
});

describe('reporteResumenMensual', () => {
  it('incluye solo las secciones elegidas, en el orden del resumen', () => {
    const r = reporteResumenMensual(datos, ['danados', 'tareas'], emisor);
    expect(r.secciones.map((s) => s.titulo)).toEqual(['Tareas', 'Dañados']);
  });
  it('si se eligen todas salen las seis', () => {
    const r = reporteResumenMensual(datos, ['tareas', 'preconteo', 'traslados', 'danados', 'vencidos', 'agotados'], emisor);
    expect(r.secciones).toHaveLength(6);
  });
  it('tareas: cuenta por estado y calcula el cumplimiento', () => {
    const s = reporteResumenMensual(datos, ['tareas'], emisor).secciones[0]!;
    expect(s.filas).toEqual([
      ['Preconteo', 0, 0, 1, 0],
      ['Temperatura AM', 2, 0, 0, 1],
    ]);
    expect(s.resumen[1]).toBe('Cumplimiento: 50 %');
  });
  it('preconteo: solo el mes pedido, con cantidades en la UD del producto', () => {
    const s = reporteResumenMensual(datos, ['preconteo'], emisor).secciones[0]!;
    expect(s.filas).toEqual([['110-16-0010', 'Amoxicilina 500 mg', 'de a 30', '5 CN', '5 CN', 0]]);
  });
  it('traslados: lista la orden SAP y el trámite', () => {
    const s = reporteResumenMensual(datos, ['traslados'], emisor).secciones[0]!;
    expect(s.filas[0]).toEqual(['5000012345', 'Envío', 'Hospital', '5 nov 2026', 'Enviado', 1, 'Sí', 'No']);
    expect(s.resumen).toContain('Trámite SAP/SIFA sin completar: 1');
  });
  it('dañados: cantidad en UD y motivo', () => {
    const s = reporteResumenMensual(datos, ['danados'], emisor).secciones[0]!;
    expect(s.filas[0]).toEqual(['8 nov 2026', '110-16-0010', 'Amoxicilina 500 mg', 'L1', '0,5 CN', 'Quebrado']);
  });
  it('una sección sin registros se conserva con filas y resumen vacíos', () => {
    const s = reporteResumenMensual(datos, ['vencidos'], emisor).secciones[0]!;
    expect(s.titulo).toBe('Vencidos');
    expect(s.filas).toEqual([]);
    expect(s.resumen).toEqual([]);
  });
  it('agotados: solo los que tocan el mes', () => {
    const s = reporteResumenMensual(datos, ['agotados'], emisor).secciones[0]!;
    expect(s.filas).toHaveLength(1);
    expect(s.filas[0]![4]).toBe(9);
  });
  it('nombre de archivo y detalle llevan el mes', () => {
    const r = reporteResumenMensual(datos, ['tareas'], emisor);
    expect(r.nombreArchivo).toBe('resumen_labores_202611');
    expect(r.detalle[0]).toContain('noviembre 2026');
  });
});

describe('generadores', () => {
  const resumen = reporteResumenMensual(datos, ['tareas', 'danados', 'vencidos'], emisor);
  it('PDF con varias secciones empieza con %PDF', async () => {
    const bytes = await generarPdfResumen(resumen);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
  });
  it('Excel con una hoja por sección es un zip válido', async () => {
    const bytes = await generarExcelResumen(resumen);
    expect(new TextDecoder().decode(bytes.slice(0, 2))).toBe('PK');
  });
});
