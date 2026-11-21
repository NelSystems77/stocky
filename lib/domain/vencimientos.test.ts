import { describe, expect, it } from 'vitest';
import { idLote, type LoteGuardado } from './lotes';
import {
  analizarVencimientos,
  contarUrgentes,
  evaluarVencimientos,
  ingresosSinSumar,
  normalizarUmbralesVencimiento,
  proyectarLotes,
  resumirVencimientos,
  simularFEFO,
  UMBRALES_VENCIMIENTO_INICIALES,
  validarUmbralesVencimiento,
  type ExistenciaReal,
  type LoteVista,
} from './vencimientos';

// Hoy = viernes 20-nov-2026. Días hábiles siguientes: lun 23 (1), mar 24 (2), mié 25 (3), jue 26 (4), vie 27 (5), lun 30 (6),
// 1-dic (7), 2 (8), 3 (9), 4 (10)… El sábado 14-nov fue el segundo sábado (hábil); el 21 y el 28 no.
const HOY = '2026-11-20';

const guardado = (p: Partial<LoteGuardado> = {}): LoteGuardado => {
  const base = { codigo: '110-16-0010', ud: 'CN', descripcion: 'PARACETAMOL', lote: 'A', vence: '2028-01-31', cantidad: 1000, valor: 0, ...p };
  return {
    ...base,
    id: idLote(base.codigo, base.lote, base.vence),
    estado: 'activo',
    cantidadIngresada: base.cantidad,
    fechaIngreso: '2026-10-10',
    ultimaVez: HOY,
    ...p,
  };
};
const vista = (p: Partial<LoteGuardado> = {}): LoteVista => {
  const g = guardado(p);
  return { ...g, cantidadReal: g.cantidad, proyectado: false };
};
const sinConsumo = new Map<string, number | null>();
const consumo = (c: number | null, codigo = '110-16-0010') => new Map<string, number | null>([[codigo, c]]);

describe('simularFEFO', () => {
  const l = (id: string, vence: string, cantidad: number) => ({ id, vence, cantidad });
  it('sin consumo no se consume nada', () => {
    const r = simularFEFO([l('a', '2026-12-04', 100)], null, HOY, null);
    expect(r.restante.get('a')).toBe(100);
    expect(r.coberturaAcumulada.get('a')).toBeNull();
  });
  it('alcanza a consumirse antes de vencer: no sobra nada', () => {
    expect(simularFEFO([l('a', '2026-12-04', 100)], 10, HOY, null).restante.get('a')).toBe(0); // 10 hábiles × 10 = 100
  });
  it('no alcanza: sobra lo que no se consume en los días hábiles que quedan', () => {
    expect(simularFEFO([l('a', '2026-11-27', 100)], 10, HOY, null).restante.get('a')).toBe(50); // 5 hábiles × 10
  });
  it('consume primero lo que vence antes', () => {
    const r = simularFEFO([l('b', '2026-12-04', 100), l('a', '2026-11-27', 30)], 10, HOY, null);
    expect(r.restante.get('a')).toBe(0); // 3 días
    expect(r.restante.get('b')).toBe(30); // quedan 7 días hábiles (hasta el 4-dic = 10) → 70 de 100
    expect(r.coberturaAcumulada.get('a')).toBe(3);
    expect(r.coberturaAcumulada.get('b')).toBe(13);
  });
  it('si el lote que vence antes se pierde con sobrante, el siguiente no recupera esos días', () => {
    const r = simularFEFO([l('a', '2026-11-27', 100), l('b', '2026-12-04', 100)], 10, HOY, null);
    expect(r.restante.get('a')).toBe(50);
    expect(r.restante.get('b')).toBe(50); // solo quedan 5 días hábiles (del 27-nov al 4-dic)
  });
  it('un lote ya vencido no se consume', () => {
    expect(simularFEFO([l('a', '2026-11-19', 100)], 10, HOY, null).restante.get('a')).toBe(100);
  });
  it('con horizonte solo cuenta esos días', () => {
    expect(simularFEFO([l('a', '2027-06-30', 1000)], 10, HOY, 3).restante.get('a')).toBe(970);
  });
  it('los feriados no son días de consumo', () => {
    expect(simularFEFO([l('a', '2026-11-27', 100)], 10, HOY, null, ['2026-11-24']).restante.get('a')).toBe(60); // 4 hábiles
  });
});

describe('analizarVencimientos', () => {
  const analizar = (lotes: LoteVista[], consumos = sinConsumo) => analizarVencimientos({ lotes, consumos, hoy: HOY });

  it('vencido: la fecha llegó y todavía hay existencia', () => {
    const [a] = analizar([vista({ vence: '2026-11-19' })]);
    expect(a?.nivel).toBe('vencido');
    expect(a?.diasParaVencer).toBe(-1);
    expect(analizar([vista({ vence: HOY })])[0]?.nivel).toBe('vencido'); // vence hoy
  });
  it('A2: 30 días o menos = alta; 90 o menos = media; más lejos, nada', () => {
    const r = analizar([vista({ lote: 'a', vence: '2026-12-20' }), vista({ lote: 'm', vence: '2027-01-15' }), vista({ lote: 'n', vence: '2027-06-01' })]);
    expect(r.map((x) => [x.lote.lote, x.nivel, x.a2])).toEqual([
      ['a', 'alta', 'alta'],
      ['m', 'media', 'media'],
      ['n', null, null],
    ]);
  });
  it('A2 en los límites: exactamente 30 y 90 días', () => {
    expect(analizar([vista({ vence: '2026-12-20' })])[0]?.a2).toBe('alta'); // 30 días
    expect(analizar([vista({ vence: '2026-12-21' })])[0]?.a2).toBe('media'); // 31 días
    expect(analizar([vista({ vence: '2027-02-18' })])[0]?.a2).toBe('media'); // 90 días
    expect(analizar([vista({ vence: '2027-02-19' })])[0]?.a2).toBeNull(); // 91 días
  });
  it('A1: el lote no se consumirá antes de vencer (alta aunque falte mucho)', () => {
    // 100 unidades/día hábil → en 40 hábiles (≈ 2 meses) se consumen 4 000; el lote tiene 20 000 y vence en ~2 meses.
    const [a] = analizar([vista({ vence: '2027-01-20', cantidad: 20000 })], consumo(100));
    expect(a?.a1).toMatchObject({ coberturaDias: 200 });
    expect(a?.a1?.excedente).toBeGreaterThan(14000);
    expect(a?.nivel).toBe('alta');
    expect(a?.sinConsumo).toBe(false);
  });
  it('A1 no salta si el lote se consume a tiempo', () => {
    const [a] = analizar([vista({ vence: '2027-06-30', cantidad: 1000 })], consumo(100));
    expect(a?.a1).toBeNull();
    expect(a?.nivel).toBeNull();
  });
  it('A1 considera el orden: el lote que vence antes consume primero y empuja al otro', () => {
    // 10/día. El lote A (vence 4-dic, 10 hábiles) tiene 100 → se consume justo. B (vence 11-dic) tiene 100 y le quedan 5 días hábiles.
    const r = analizar([vista({ lote: 'B', vence: '2026-12-11', cantidad: 100 }), vista({ lote: 'A', vence: '2026-12-04', cantidad: 100 })], consumo(10));
    const b = r.find((x) => x.lote.lote === 'B');
    expect(r.find((x) => x.lote.lote === 'A')?.a1).toBeNull();
    expect(b?.a1?.excedente).toBe(50);
    expect(b?.a1?.coberturaDias).toBe(20);
  });
  it('sin consumo no se evalúa A1: solo A2, y se indica', () => {
    const [a] = analizar([vista({ vence: '2027-01-15', cantidad: 99999 })]);
    expect(a?.a1).toBeNull();
    expect(a?.sinConsumo).toBe(true);
    expect(a?.nivel).toBe('media');
    expect(analizar([vista()], consumo(0))[0]?.sinConsumo).toBe(true);
  });
  it('no alertan los gestionados, los agotados ni los de cantidad 0', () => {
    const r = analizar([vista({ estado: 'gestionado', vence: '2026-12-01' }), vista({ lote: 'x', estado: 'agotado', cantidad: 0 }), vista({ lote: 'y', cantidad: 0 })]);
    expect(r).toEqual([]);
  });
  it('los no medicamentos también alertan (condones, etiquetas…)', () => {
    const r = analizar([vista({ codigo: '227-02-0140', vence: '2026-12-15' })]);
    expect(r[0]?.nivel).toBe('alta');
  });
  it('ordena vencidos, altas, medias y luego lo que vence antes', () => {
    const r = analizar([
      vista({ lote: 'm', vence: '2027-01-15' }),
      vista({ lote: 'v', vence: '2026-11-01' }),
      vista({ lote: 'a2', vence: '2026-12-18' }),
      vista({ lote: 'a1', vence: '2026-12-05' }),
    ]);
    expect(r.map((x) => x.lote.lote)).toEqual(['v', 'a1', 'a2', 'm']);
  });
  it('un lote vencido en la lista no marca A1 ni A2 (ya es vencido)', () => {
    const [a] = analizar([vista({ vence: '2026-11-01' })], consumo(10));
    expect(a).toMatchObject({ nivel: 'vencido', a1: null, a2: null });
  });
});

describe('resumirVencimientos y contarUrgentes', () => {
  it('cuenta por nivel y los urgentes son vencidos + altas', () => {
    const r = resumirVencimientos(
      analizarVencimientos({
        lotes: [vista({ lote: 'v', vence: '2026-11-01' }), vista({ lote: 'a', vence: '2026-12-10' }), vista({ lote: 'm', vence: '2027-01-15' }), vista({ lote: 'n', vence: '2028-01-01' })],
        consumos: sinConsumo,
        hoy: HOY,
      }),
    );
    expect(r).toMatchObject({ vencidos: 1, alta: 1, media: 1, a1: 0, sinConsumo: 4 });
    expect(contarUrgentes(r)).toBe(2);
  });
});

describe('proyectarLotes (RF-2.6)', () => {
  const sinReales = new Map<string, ExistenciaReal>();
  const proyectar = (lotes: LoteGuardado[], consumos = consumo(10), existencias = sinReales) => proyectarLotes({ lotes, consumos, existencias, hoy: HOY });
  const cant = (r: ReturnType<typeof proyectar>, lote: string) => r.lotes.find((l) => l.lote === lote)?.cantidad;

  it('resta el consumo diario de los días hábiles desde la carga (el 14-nov, segundo sábado, cuenta)', () => {
    // Carga del 13-nov (viernes): hábiles siguientes hasta el 20 = 14 (2.º sábado), 16, 17, 18, 19, 20 → 6 días × 10.
    const r = proyectar([guardado({ ultimaVez: '2026-11-13', cantidad: 1000 })]);
    expect(cant(r, 'A')).toBe(940);
    expect(r.lotes[0]).toMatchObject({ proyectado: true, cantidadReal: 1000 });
  });
  it('consume primero el lote que vence antes', () => {
    const r = proyectar([guardado({ lote: 'tarde', vence: '2028-06-30', ultimaVez: '2026-11-13', cantidad: 500 }), guardado({ lote: 'pronto', vence: '2027-01-31', ultimaVez: '2026-11-13', cantidad: 40 })]);
    expect(cant(r, 'pronto')).toBe(0);
    expect(cant(r, 'tarde')).toBe(480); // 60 consumidos: 40 del que vence antes y 20 del otro
  });
  it('si la carga es de hoy no se proyecta nada', () => {
    const r = proyectar([guardado({ ultimaVez: HOY })]);
    expect(cant(r, 'A')).toBe(1000);
    expect(r.lotes[0]?.proyectado).toBe(false);
  });
  it('sin consumo no se proyecta', () => {
    const r = proyectar([guardado({ ultimaVez: '2026-11-13' })], sinConsumo);
    expect(cant(r, 'A')).toBe(1000);
    expect(r.lotes[0]?.proyectado).toBe(false);
  });
  it('un lote gestionado o agotado no se proyecta', () => {
    const r = proyectar([guardado({ lote: 'G', estado: 'gestionado', ultimaVez: '2026-11-13' }), guardado({ lote: 'X', estado: 'agotado', cantidad: 0, ultimaVez: '2026-11-13' })]);
    expect(r.lotes.every((l) => !l.proyectado)).toBe(true);
  });
  it('ajusta a la existencia real (menor que la proyectada) descontando de los lotes que vencen antes', () => {
    // Proyectado al 17-nov (14, 16, 17 = 3 días): 970. Real 920 → diferencia 50, que se descuenta del lote que vence antes.
    const lotes = [guardado({ lote: 'pronto', vence: '2027-01-31', ultimaVez: '2026-11-13', cantidad: 100 }), guardado({ lote: 'tarde', vence: '2028-06-30', ultimaVez: '2026-11-13', cantidad: 900 })];
    const r = proyectar(lotes, consumo(10), new Map([['110-16-0010', { existencia: 920, fecha: '2026-11-17' }]]));
    // Al 17: pronto 70 → ajuste −50 → 20; luego 18, 19, 20 (3 días × 10): pronto 0 y tarde 900 − 10 = 890.
    expect(r.ajustados.get('110-16-0010')).toBe(50);
    expect(cant(r, 'pronto')).toBe(0);
    expect(cant(r, 'tarde')).toBe(890);
    expect(r.excesoReal.size).toBe(0);
  });
  it('existencia real mayor que la proyectada: no inventa lote, avisa', () => {
    const r = proyectar([guardado({ ultimaVez: '2026-11-13', cantidad: 1000 })], consumo(10), new Map([['110-16-0010', { existencia: 2000, fecha: '2026-11-17' }]]));
    expect(r.excesoReal.has('110-16-0010')).toBe(true);
    expect(cant(r, 'A')).toBe(940); // proyección normal hasta hoy
  });
  it('un reporte de existencias anterior o igual a la carga no ajusta', () => {
    const r = proyectar([guardado({ ultimaVez: '2026-11-13', cantidad: 1000 })], consumo(10), new Map([['110-16-0010', { existencia: 500, fecha: '2026-11-13' }]]));
    expect(r.ajustados.size).toBe(0);
    expect(cant(r, 'A')).toBe(940);
  });
  it('sin consumo pero con existencia real posterior: sí ajusta', () => {
    const r = proyectar([guardado({ ultimaVez: '2026-11-13', cantidad: 1000 })], sinConsumo, new Map([['110-16-0010', { existencia: 900, fecha: '2026-11-17' }]]));
    expect(cant(r, 'A')).toBe(900);
  });
  it('devuelve todos los lotes, también los que no se proyectan', () => {
    expect(proyectar([guardado({ lote: 'A', ultimaVez: '2026-11-13' }), guardado({ lote: 'B', estado: 'gestionado' })]).lotes).toHaveLength(2);
  });
  it('un producto no afecta a otro', () => {
    const r = proyectar(
      [guardado({ ultimaVez: '2026-11-13' }), guardado({ codigo: '110-13-0003', lote: 'Z', ultimaVez: '2026-11-13', cantidad: 500 })],
      consumo(10),
    );
    expect(cant(r, 'Z')).toBe(500);
  });
});

describe('umbrales editables', () => {
  it('por defecto 30 y 90', () => expect(UMBRALES_VENCIMIENTO_INICIALES).toEqual({ alta: 30, media: 90 }));
  it('valida enteros, rangos y que media sea mayor que alta', () => {
    expect(validarUmbralesVencimiento(30, 90).ok).toBe(true);
    expect(validarUmbralesVencimiento(1, 2).ok).toBe(true);
    expect(validarUmbralesVencimiento(365, 730).ok).toBe(true);
    expect(validarUmbralesVencimiento(0, 90).ok).toBe(false);
    expect(validarUmbralesVencimiento(366, 700).ok).toBe(false);
    expect(validarUmbralesVencimiento(30, 731).ok).toBe(false);
    expect(validarUmbralesVencimiento(30, 30).ok).toBe(false);
    expect(validarUmbralesVencimiento(60, 30)).toMatchObject({ ok: false, error: 'Prioridad media debe ser mayor que prioridad alta.' });
    expect(validarUmbralesVencimiento(30.5, 90).ok).toBe(false);
    expect(validarUmbralesVencimiento(Number.NaN, 90).ok).toBe(false);
  });
  it('lee lo guardado y vuelve a 30/90 si falta o es inválido', () => {
    expect(normalizarUmbralesVencimiento({ alta: 15, media: 60 })).toEqual({ alta: 15, media: 60 });
    expect(normalizarUmbralesVencimiento(undefined)).toEqual({ alta: 30, media: 90 });
    expect(normalizarUmbralesVencimiento({ alta: 60, media: 30 })).toEqual({ alta: 30, media: 90 });
    expect(normalizarUmbralesVencimiento({ alta: '15', media: 60 })).toEqual({ alta: 30, media: 90 });
    expect(normalizarUmbralesVencimiento('basura')).toEqual({ alta: 30, media: 90 });
  });
  it('cambian el nivel de A2', () => {
    const lotes = [vista({ lote: 'x', vence: '2027-01-10' })]; // 51 días
    const con = (umbrales: { alta: number; media: number }) => evaluarVencimientos({ lotes, consumos: sinConsumo, existencias: new Map(), hoy: HOY, umbrales }).alertas[0]?.nivel;
    expect(con({ alta: 30, media: 90 })).toBe('media');
    expect(con({ alta: 60, media: 120 })).toBe('alta');
    expect(con({ alta: 15, media: 45 })).toBeNull();
  });
});

describe('evaluarVencimientos', () => {
  it('proyecta y luego alerta sobre lo proyectado', () => {
    // 13-nov: 1 000; 10/día → hoy 940. Vence el 27-nov (5 hábiles): consumirá 50 → sobran 890 → A1.
    const r = evaluarVencimientos({ lotes: [guardado({ ultimaVez: '2026-11-13', vence: '2026-11-27' })], consumos: consumo(10), existencias: new Map(), hoy: HOY });
    expect(r.lotes[0]?.cantidad).toBe(940);
    expect(r.alertas[0]?.a1?.excedente).toBe(890);
    expect(r.resumen).toMatchObject({ alta: 1, a1: 1 });
  });
});

describe('ingresosSinSumar', () => {
  it('lista los segundos sábados entre la última carga y hoy', () => {
    expect(ingresosSinSumar('2026-11-13', '2026-11-20')).toEqual(['2026-11-14']);
    expect(ingresosSinSumar('2026-10-16', '2026-11-20')).toEqual(['2026-11-14']);
    expect(ingresosSinSumar('2026-10-01', '2026-12-20')).toEqual(['2026-10-10', '2026-11-14', '2026-12-12']);
  });
  it('no cuenta el día de la carga y sí el de hoy', () => {
    expect(ingresosSinSumar('2026-11-14', '2026-11-20')).toEqual([]);
    expect(ingresosSinSumar('2026-11-13', '2026-11-14')).toEqual(['2026-11-14']);
  });
  it('sin carga previa o carga de hoy: nada', () => {
    expect(ingresosSinSumar(null, '2026-11-20')).toEqual([]);
    expect(ingresosSinSumar('2026-11-20', '2026-11-20')).toEqual([]);
  });
});

