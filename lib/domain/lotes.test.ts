import { describe, expect, it } from 'vitest';
import type { FilaLote } from '@/lib/pdf/lotes';
import {
  compararLotes,
  detalleDeCambios,
  idVencidoDeLote,
  cuadrarConExistencias,
  esMedicamento,
  hayCambios,
  idLote,
  lotesDesdeFilas,
  planGuardadoLotes,
  revisarCarga,
  revisarFechaCarga,
  ultimaCargaLotes,
  vencidosConExistencia,
  type Lote,
  type LoteGuardado,
} from './lotes';

const lote = (p: Partial<Lote> = {}): Lote => ({
  codigo: '110-16-0010',
  ud: 'CN',
  descripcion: 'PARACETAMOL',
  lote: 'A1',
  vence: '2028-06-30',
  cantidad: 1000,
  valor: 100,
  ...p,
});

const guardado = (p: Partial<LoteGuardado> = {}): LoteGuardado => {
  const base = lote(p);
  return {
    ...base,
    id: idLote(base.codigo, base.lote, base.vence),
    estado: 'activo',
    cantidadIngresada: base.cantidad,
    fechaIngreso: '2026-10-10',
    ultimaVez: '2026-10-16',
    ...p,
  };
};

const fila = (p: Partial<FilaLote> = {}): FilaLote => ({
  codigo: '110-16-0010',
  ud: 'CN',
  descripcion: 'PARACETAMOL',
  lote: 'A1',
  vence: '2028-06-30',
  existencia: 10,
  valor: 100,
  dudosa: false,
  ...p,
});

describe('lotesDesdeFilas', () => {
  it('convierte a unidades base con la UD (CN = 100)', () => {
    expect(lotesDesdeFilas([fila({ existencia: 2544.36 })])[0]?.cantidad).toBe(254436);
    expect(lotesDesdeFilas([fila({ ud: 'UD', existencia: 5 })])[0]?.cantidad).toBe(5);
  });
  it('suma las filas del mismo lote y vencimiento', () => {
    const r = lotesDesdeFilas([fila({ existencia: 10, valor: 100.1 }), fila({ existencia: 0.5, valor: 5.05 })]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ cantidad: 1050, valor: 105.15 });
  });
  it('el mismo número de lote con otro vencimiento es otro lote', () => {
    expect(lotesDesdeFilas([fila(), fila({ vence: '2028-07-31' })])).toHaveLength(2);
  });
  it('ordena por código, vencimiento y lote', () => {
    const r = lotesDesdeFilas([fila({ vence: '2029-01-01' }), fila({ codigo: '110-13-0003' }), fila({ vence: '2027-01-01', lote: 'Z' })]);
    expect(r.map((l) => `${l.codigo} ${l.vence}`)).toEqual(['110-13-0003 2028-06-30', '110-16-0010 2027-01-01', '110-16-0010 2029-01-01']);
  });
});

describe('idLote y esMedicamento', () => {
  it('no deja barras ni espacios (ID de documento válido)', () => {
    expect(idLote('110-16-0010', 'AB/12 3', '2028-06-30')).toBe('110-16-0010_AB-12-3_2028-06-30');
  });
  it('solo el grupo 1 es medicamento', () => {
    expect(esMedicamento('110-16-0010')).toBe(true);
    expect(esMedicamento('111-17-0014')).toBe(true);
    expect(esMedicamento('227-02-0140')).toBe(false);
    expect(esMedicamento('450-02-0109')).toBe(false);
  });
});

describe('compararLotes', () => {
  it('sin cambios', () => {
    const c = compararLotes([guardado()], [lote()]);
    expect(hayCambios(c)).toBe(false);
    expect(c.sinCambio).toBe(1);
  });
  it('cantidad que baja = consumo; que sube = ingreso o corrección', () => {
    const c = compararLotes([guardado({ cantidad: 1000 }), guardado({ lote: 'B', cantidad: 500 })], [lote({ cantidad: 800 }), lote({ lote: 'B', cantidad: 700 })]);
    expect(c.bajaron).toHaveLength(1);
    expect(c.bajaron[0]).toMatchObject({ antes: 1000, despues: 800 });
    expect(c.subieron[0]).toMatchObject({ antes: 500, despues: 700 });
  });
  it('lote nuevo y lote que salió', () => {
    const c = compararLotes([guardado({ lote: 'VIEJO' })], [lote({ lote: 'NUEVO' })]);
    expect(c.nuevos.map((l) => l.lote)).toEqual(['NUEVO']);
    expect(c.salieron.map((l) => l.lote)).toEqual(['VIEJO']);
    expect(c.vencimiento).toEqual([]);
  });
  it('mismo lote con otra fecha = cambio de vencimiento (no nuevo + salió)', () => {
    const c = compararLotes([guardado({ vence: '2028-06-30' })], [lote({ vence: '2027-06-30', cantidad: 900 })]);
    expect(c.vencimiento).toEqual([
      expect.objectContaining({ lote: 'A1', venceAntes: '2028-06-30', venceDespues: '2027-06-30', cantidadAntes: 1000, cantidadDespues: 900 }),
    ]);
    expect(c.nuevos).toEqual([]);
    expect(c.salieron).toEqual([]);
  });
  it('si hay ambigüedad (dos fechas del mismo lote) no adivina: entradas y salidas', () => {
    const c = compararLotes(
      [guardado({ vence: '2028-06-30' }), guardado({ vence: '2028-07-31' })],
      [lote({ vence: '2027-01-31' }), lote({ vence: '2027-02-28' })],
    );
    expect(c.vencimiento).toEqual([]);
    expect(c.nuevos).toHaveLength(2);
    expect(c.salieron).toHaveLength(2);
  });
  it('lo agotado de cargas anteriores no cuenta como «salió»; si reaparece sale como nuevo', () => {
    const c = compararLotes([guardado({ estado: 'agotado', cantidad: 0 })], [lote()]);
    expect(c.salieron).toEqual([]);
    expect(c.nuevos).toHaveLength(1);
  });
  it('lo gestionado sí se compara', () => {
    expect(compararLotes([guardado({ estado: 'gestionado' })], []).salieron).toHaveLength(1);
  });
});

describe('vencidosConExistencia', () => {
  it('lista lo vencido o que vence hoy y todavía tiene existencia', () => {
    const r = vencidosConExistencia([lote({ vence: '2026-11-19' }), lote({ lote: 'B', vence: '2026-11-20' }), lote({ lote: 'C', vence: '2026-11-21' }), lote({ lote: 'D', vence: '2026-01-01', cantidad: 0 })], '2026-11-20');
    expect(r.map((l) => l.lote)).toEqual(['A1', 'B']);
  });
});

describe('cuadrarConExistencias', () => {
  const existencias = [
    { codigo: '110-16-0010', ud: 'CN', descripcion: 'PARACETAMOL', existencia: 1500 },
    { codigo: '110-13-0003', ud: 'CN', descripcion: 'ROSUVASTATINA', existencia: 200 },
    { codigo: '110-11-0030', ud: 'CN', descripcion: 'ASA', existencia: 80 },
    { codigo: '110-99-9999', ud: 'CN', descripcion: 'AGOTADO', existencia: 0 },
  ];
  it('suma los lotes de cada producto y la compara con SIFA', () => {
    const r = cuadrarConExistencias(
      [lote({ cantidad: 1000 }), lote({ lote: 'B', cantidad: 500 }), lote({ codigo: '110-13-0003', cantidad: 150 }), lote({ codigo: '777-77-7777', cantidad: 5 })],
      existencias,
    );
    expect(r.coinciden).toBe(1);
    expect(r.diferencias).toEqual([{ codigo: '110-13-0003', descripcion: 'ROSUVASTATINA', ud: 'CN', lotes: 150, existencia: 200 }]);
    expect(r.sinLotes.map((x) => x.codigo)).toEqual(['110-11-0030']);
    expect(r.sinExistencia).toEqual(['777-77-7777']);
  });
  it('un producto agotado sin lotes no es «sin lotes»', () => {
    expect(cuadrarConExistencias([], existencias).sinLotes.map((x) => x.codigo)).not.toContain('110-99-9999');
  });
});

describe('revisarFechaCarga', () => {
  it('primera carga o más nueva: sin problema', () => {
    expect(revisarFechaCarga('2026-11-20', null).nivel).toBe('ok');
    expect(revisarFechaCarga('2026-11-20', '2026-10-16').nivel).toBe('ok');
  });
  it('misma fecha: aviso; más vieja: bloqueo', () => {
    expect(revisarFechaCarga('2026-11-20', '2026-11-20').nivel).toBe('aviso');
    expect(revisarFechaCarga('2026-10-01', '2026-11-20')).toMatchObject({ nivel: 'bloqueo' });
  });
  it('sin fecha en el reporte: aviso', () => {
    expect(revisarFechaCarga(null, null).nivel).toBe('aviso');
  });
});

describe('ultimaCargaLotes', () => {
  it('es la fecha más reciente vista', () => {
    expect(ultimaCargaLotes([guardado({ ultimaVez: '2026-09-01' }), guardado({ lote: 'B', ultimaVez: '2026-10-16' })])).toBe('2026-10-16');
    expect(ultimaCargaLotes([])).toBeNull();
  });
});

describe('revisarCarga', () => {
  it('primera carga: no hay anterior, todo es nuevo', () => {
    const r = revisarCarga({ nuevos: [lote(), lote({ codigo: '227-02-0140', lote: 'X' })], anteriores: [], existencias: null, fechaReporte: '2026-11-20', hoy: '2026-11-20' });
    expect(r.hayAnterior).toBe(false);
    expect(r.cambios.nuevos).toHaveLength(2);
    expect(r.cuadre).toBeNull();
    expect(r.productos).toBe(2);
    expect(r.noMedicamentos).toBe(1);
  });
  it('junta cambios, vencidos y cuadre', () => {
    const r = revisarCarga({
      nuevos: [lote({ vence: '2026-11-01', cantidad: 10 })],
      anteriores: [guardado({ vence: '2026-11-01', cantidad: 20 })],
      existencias: [{ codigo: '110-16-0010', ud: 'CN', descripcion: 'P', existencia: 10 }],
      fechaReporte: '2026-11-20',
      hoy: '2026-11-20',
    });
    expect(r.hayAnterior).toBe(true);
    expect(r.cambios.bajaron).toHaveLength(1);
    expect(r.vencidos).toHaveLength(1);
    expect(r.cuadre?.coinciden).toBe(1);
    expect(r.ultimaCarga).toBe('2026-10-16');
  });
});

describe('planGuardadoLotes', () => {
  it('lote nuevo: su ingreso es lo que trae y la fecha es la del reporte', () => {
    const { lotes } = planGuardadoLotes([lote({ cantidad: 700 })], [], '2026-11-20');
    expect(lotes[0]?.datos).toMatchObject({ cantidad: 700, cantidadIngresada: 700, fechaIngreso: '2026-11-20', ultimaVez: '2026-11-20', estado: 'activo', noMedicamento: false });
  });
  it('lote existente que baja: conserva el ingreso original', () => {
    const { lotes } = planGuardadoLotes([lote({ cantidad: 600 })], [guardado({ cantidad: 1000, cantidadIngresada: 1000, fechaIngreso: '2026-10-10' })], '2026-11-20');
    expect(lotes[0]?.datos).toMatchObject({ cantidad: 600, cantidadIngresada: 1000, fechaIngreso: '2026-10-10' });
  });
  it('lote existente que sube: suma lo que subió al ingreso (RF-1.9)', () => {
    const { lotes } = planGuardadoLotes([lote({ cantidad: 1500 })], [guardado({ cantidad: 1000, cantidadIngresada: 1000 })], '2026-11-20');
    expect(lotes[0]?.datos).toMatchObject({ cantidad: 1500, cantidadIngresada: 1500 });
  });
  it('un lote gestionado sigue gestionado', () => {
    expect(planGuardadoLotes([lote()], [guardado({ estado: 'gestionado' })], '2026-11-20').lotes[0]?.datos.estado).toBe('gestionado');
  });
  it('un lote agotado que reaparece vuelve a activo y suma su ingreso', () => {
    const { lotes } = planGuardadoLotes([lote({ cantidad: 300 })], [guardado({ estado: 'agotado', cantidad: 0, cantidadIngresada: 1000 })], '2026-11-20');
    expect(lotes[0]?.datos).toMatchObject({ estado: 'activo', cantidad: 300, cantidadIngresada: 1300 });
  });
  it('lo que ya no aparece queda en 0 y agotado, sin borrarse', () => {
    const { salidas } = planGuardadoLotes([], [guardado({ lote: 'VIEJO' }), guardado({ lote: 'G', estado: 'gestionado' }), guardado({ lote: 'YA', estado: 'agotado', cantidad: 0 })], '2026-11-20');
    expect(salidas.map((s) => [s.id.split('_')[1], s.datos.estado, s.datos.cantidad])).toEqual([
      ['VIEJO', 'agotado', 0],
      ['G', 'gestionado', 0],
    ]);
    expect(salidas[0]?.datos.salioEn).toBe('2026-11-20');
  });
});

describe('vencidos automáticos (RF-2.5) en planGuardadoLotes', () => {
  const FECHA = '2026-11-20';
  it('un lote cuya fecha ya llegó y tiene existencia queda vencido y se registra', () => {
    const { lotes, vencidos } = planGuardadoLotes([lote({ vence: '2026-11-01', cantidad: 300 })], [], FECHA);
    expect(lotes[0]?.datos.estado).toBe('vencido');
    expect(vencidos).toEqual([
      {
        id: idVencidoDeLote(lotes[0]!.id),
        datos: { fecha: FECHA, codigo: '110-16-0010', lote: 'A1', fechaVencimiento: '2026-11-01', cantidad: 300, origen: 'reporte', notas: 'Detectado en el reporte de lotes y vencimientos.' },
      },
    ]);
  });
  it('el que vence hoy también cuenta; el de mañana no', () => {
    expect(planGuardadoLotes([lote({ vence: FECHA })], [], FECHA).vencidos).toHaveLength(1);
    expect(planGuardadoLotes([lote({ vence: '2026-11-21' })], [], FECHA).vencidos).toHaveLength(0);
  });
  it('no lo vuelve a registrar en la carga siguiente (el registro puede haberse editado)', () => {
    const previo = guardado({ vence: '2026-11-01', estado: 'vencido', cantidad: 300 });
    const { lotes, vencidos } = planGuardadoLotes([lote({ vence: '2026-11-01', cantidad: 250 })], [previo], '2026-12-18');
    expect(lotes[0]?.datos.estado).toBe('vencido');
    expect(vencidos).toEqual([]);
  });
  it('un lote gestionado no se registra como vencido', () => {
    const previo = guardado({ vence: '2026-11-01', estado: 'gestionado' });
    const r = planGuardadoLotes([lote({ vence: '2026-11-01' })], [previo], FECHA);
    expect(r.lotes[0]?.datos.estado).toBe('gestionado');
    expect(r.vencidos).toEqual([]);
  });
  it('un lote activo que venció entre cargas se registra en la carga donde se ve vencido', () => {
    const previo = guardado({ vence: '2026-11-15', estado: 'activo' });
    expect(planGuardadoLotes([lote({ vence: '2026-11-15' })], [previo], FECHA).vencidos).toHaveLength(1);
  });
  it('un lote vencido que ya no aparece queda agotado', () => {
    const previo = guardado({ vence: '2026-11-01', estado: 'vencido' });
    expect(planGuardadoLotes([], [previo], FECHA).salidas[0]?.datos.estado).toBe('agotado');
  });
  it('el ID del registro es fijo por lote', () => {
    expect(idVencidoDeLote('110-16-0010_A1_2026-11-01')).toBe('lote-110-16-0010_A1_2026-11-01');
  });
});

describe('detalleDeCambios', () => {
  const c = compararLotes(
    [guardado({ lote: 'BAJA', cantidad: 100 }), guardado({ lote: 'SUBE', cantidad: 100 }), guardado({ lote: 'FECHA', vence: '2028-01-01' }), guardado({ lote: 'SALE' })],
    [lote({ lote: 'BAJA', cantidad: 80 }), lote({ lote: 'SUBE', cantidad: 130 }), lote({ lote: 'FECHA', vence: '2027-01-01' }), lote({ lote: 'NUEVO', cantidad: 50 })],
  );
  it('una fila por cambio, con los críticos primero', () => {
    const d = detalleDeCambios(c, true);
    expect(d.map((x) => [x.tipo, x.lote])).toEqual([
      ['vencimiento', 'FECHA'],
      ['subio', 'SUBE'],
      ['bajo', 'BAJA'],
      ['nuevo', 'NUEVO'],
      ['salio', 'SALE'],
    ]);
  });
  it('lleva las cantidades y fechas antes y después', () => {
    const d = detalleDeCambios(c, true);
    expect(d[0]).toMatchObject({ tipo: 'vencimiento', venceAntes: '2028-01-01', vence: '2027-01-01', antes: 1000, despues: 1000 });
    expect(d.find((x) => x.tipo === 'subio')).toMatchObject({ antes: 100, despues: 130 });
    expect(d.find((x) => x.tipo === 'nuevo')).toMatchObject({ despues: 50 });
    expect(d.find((x) => x.tipo === 'salio')).toMatchObject({ antes: 1000 });
  });
  it('la primera carga no se detalla (todo sería nuevo)', () => {
    expect(detalleDeCambios(compararLotes([], [lote()]), false)).toEqual([]);
  });
});

