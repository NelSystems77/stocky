import { describe, expect, it } from 'vitest';
import {
  contarPendientes,
  describirProgramado,
  etiquetaAccion,
  ocurreProgramacion,
  ocurrenciasProgramadas,
  programadosSugeridos,
  restarDiasHabiles,
  siguienteEstado,
  validarProgramado,
  vistaPedidosEnvios,
  type Programacion,
  type Programado,
  type Seguimiento,
} from './pedidosEnvios';

// Noviembre 2026: lunes 16, 23, 30 · jueves 5, 12, 19, 26 · el 20 es viernes.
const sug = programadosSugeridos('2026-11-01');
const porId = (id: string): Programado => {
  const p = sug.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('último día de la semana del mes', () => {
  const ultimoJueves = { tipo: 'ultimoDiaSemana', dia: 4 } as const;
  it('solo el último jueves', () => {
    expect(ocurreProgramacion(ultimoJueves, '2026-11-26')).toBe(true);
    expect(ocurreProgramacion(ultimoJueves, '2026-11-19')).toBe(false);
    expect(ocurreProgramacion(ultimoJueves, '2026-12-31')).toBe(true); // diciembre tiene cinco jueves
    expect(ocurreProgramacion(ultimoJueves, '2026-12-24')).toBe(false);
  });
  it('no ocurre si es feriado', () => {
    expect(ocurreProgramacion(ultimoJueves, '2026-11-26', ['2026-11-26'])).toBe(false);
  });
  it('delegan las demás programaciones a las recurrencias de tareas', () => {
    expect(ocurreProgramacion({ tipo: 'diasSemana', dias: [2] }, '2026-11-17')).toBe(true);
  });
});

describe('restar días hábiles', () => {
  it('0 deja la fecha', () => expect(restarDiasHabiles('2026-11-23', 0)).toBe('2026-11-23'));
  it('2 antes del lunes = jueves anterior (se salta el fin de semana)', () => {
    expect(restarDiasHabiles('2026-11-23', 2)).toBe('2026-11-19');
  });
  it('un feriado no cuenta', () => {
    expect(restarDiasHabiles('2026-11-23', 2, ['2026-11-20'])).toBe('2026-11-18');
  });
  it('el segundo sábado sí es hábil', () => {
    expect(restarDiasHabiles('2026-11-16', 1)).toBe('2026-11-14');
  });
});

describe('calendario confirmado (2026-11-20)', () => {
  const dia = (id: string, f: string) => ocurrenciasProgramadas([porId(id)], [], f, f).length === 1;
  it('R: lunes y último jueves', () => {
    expect(dia('sug-envio-r', '2026-11-23')).toBe(true);
    expect(dia('sug-envio-r', '2026-11-26')).toBe(true);
    expect(dia('sug-envio-r', '2026-11-19')).toBe(false);
  });
  it('C martes', () => expect(dia('sug-envio-c', '2026-11-24')).toBe(true));
  it('V, Z y pedido 772 miércoles', () => {
    for (const id of ['sug-envio-v', 'sug-envio-z', 'sug-pedido-772']) expect(dia(id, '2026-11-25')).toBe(true);
    expect(dia('sug-envio-v', '2026-11-26')).toBe(false);
  });
  it('sueros jueves', () => expect(dia('sug-pedido-sueros', '2026-11-19')).toBe(true));
  it('en una semana: orden por fecha, y envíos antes que pedidos el mismo día', () => {
    const o = ocurrenciasProgramadas(sug, [], '2026-11-23', '2026-11-26');
    expect(o.map((x) => `${x.fecha} ${x.nombre}`)).toEqual([
      '2026-11-23 Envío a Rancho Redondo (R)',
      '2026-11-24 Envío a Cascajal (C)',
      '2026-11-25 Envío a Vista de Mar (V)',
      '2026-11-25 Envío a Zetillal (Z)',
      '2026-11-25 Pedido semanal 772',
      '2026-11-26 Envío a Rancho Redondo (R)',
      '2026-11-26 Pedido de sueros',
    ]);
  });
  it('el aviso del envío a R del lunes cae el jueves anterior', () => {
    const [r] = ocurrenciasProgramadas([porId('sug-envio-r')], [], '2026-11-23', '2026-11-23');
    expect(r?.fechaAviso).toBe('2026-11-19');
  });
});

describe('ocurrencias', () => {
  it('un programado pausado no genera nada', () => {
    expect(ocurrenciasProgramadas([{ ...porId('sug-envio-c'), activo: false }], [], '2026-11-01', '2026-11-30')).toEqual([]);
  });
  it('no genera antes de `desde`', () => {
    expect(ocurrenciasProgramadas([{ ...porId('sug-envio-c'), desde: '2026-11-25' }], [], '2026-11-01', '2026-11-30').map((o) => o.fecha)).toEqual([]);
  });
  it('un feriado omite esa fecha', () => {
    expect(ocurrenciasProgramadas([porId('sug-envio-c')], [], '2026-11-24', '2026-11-24', ['2026-11-24'])).toEqual([]);
  });
  it('dos recurrencias que coinciden cuentan una vez', () => {
    const p: Programado = { ...porId('sug-envio-r'), recurrencias: [{ tipo: 'diasSemana', dias: [4] }, { tipo: 'ultimoDiaSemana', dia: 4 }] };
    expect(ocurrenciasProgramadas([p], [], '2026-11-26', '2026-11-26')).toHaveLength(1);
  });
  it('toma el estado del seguimiento', () => {
    const seg: Seguimiento[] = [{ programadoId: 'sug-pedido-sueros', fecha: '2026-11-19', estado: 'en_tramite' }];
    expect(ocurrenciasProgramadas([porId('sug-pedido-sueros')], seg, '2026-11-19', '2026-11-19')[0]?.estado).toBe('en_tramite');
  });
});

describe('vista de Hoy', () => {
  // Miércoles 25 de noviembre.
  const desdeLunes = programadosSugeridos('2026-11-23'); // no hay lo anterior al lunes 23
  const v = vistaPedidosEnvios(desdeLunes, [], '2026-11-25');
  it('hoy: lo del miércoles', () => expect(v.hoy.map((o) => o.nombre)).toHaveLength(3));
  it('atrasados: lo no cerrado de días anteriores (hasta 7 días)', () => {
    expect(v.atrasados.map((o) => o.fecha)).toEqual(['2026-11-23', '2026-11-24']);
  });
  it('próximos: los 7 días siguientes; el jueves 26 con «preparar» según su aviso', () => {
    expect(v.proximos.filter((o) => o.fecha === '2026-11-26').map((o) => o.nombre).sort()).toEqual(['Envío a Rancho Redondo (R)', 'Pedido de sueros']);
    const r = v.proximos.find((o) => o.programadoId === 'sug-envio-r');
    expect(r?.fechaAviso).toBe('2026-11-24'); // 2 días hábiles antes
    expect(r?.preparar).toBe(true);
    expect(v.proximos.find((o) => o.programadoId === 'sug-pedido-sueros')?.fechaAviso).toBe('2026-11-25');
  });
  it('lo enviado sale de hoy y de atrasados y aparece en cerrados', () => {
    const seg: Seguimiento[] = [
      { programadoId: 'sug-envio-c', fecha: '2026-11-24', estado: 'enviado' },
      { programadoId: 'sug-pedido-772', fecha: '2026-11-25', estado: 'enviado' },
    ];
    const v2 = vistaPedidosEnvios(desdeLunes, seg, '2026-11-25');
    expect(v2.atrasados.map((o) => o.programadoId)).toEqual(['sug-envio-r']);
    expect(v2.hoy.map((o) => o.programadoId)).not.toContain('sug-pedido-772');
    expect(v2.cerradosHoy.map((o) => o.programadoId)).toEqual(['sug-pedido-772']);
  });
  it('un pedido en trámite sigue abierto', () => {
    const seg: Seguimiento[] = [{ programadoId: 'sug-pedido-772', fecha: '2026-11-25', estado: 'en_tramite' }];
    expect(vistaPedidosEnvios(desdeLunes, seg, '2026-11-25').hoy.map((o) => o.programadoId)).toContain('sug-pedido-772');
  });
  it('cuenta lo que requiere atención ya', () => {
    expect(contarPendientes(v)).toBe(3 + 2 + 2); // hoy + atrasados + próximos que ya toca preparar (R y sueros)
  });
});

describe('estados', () => {
  it('un envío pasa directo de pendiente a enviado', () => {
    expect(siguienteEstado('envio', 'pendiente')).toBe('enviado');
    expect(etiquetaAccion('envio', 'pendiente')).toBe('Marcar enviado');
  });
  it('un pedido pasa por trámite y luego enviado', () => {
    expect(siguienteEstado('pedido', 'pendiente')).toBe('en_tramite');
    expect(siguienteEstado('pedido', 'en_tramite')).toBe('enviado');
    expect(etiquetaAccion('pedido', 'pendiente')).toBe('Poner en trámite');
  });
  it('lo enviado ya no avanza', () => {
    expect(siguienteEstado('pedido', 'enviado')).toBeNull();
    expect(etiquetaAccion('envio', 'enviado')).toBeNull();
  });
});

describe('texto y validación', () => {
  it('describe R con sus dos periodicidades', () => {
    expect(describirProgramado(porId('sug-envio-r'))).toBe('los lunes y el último jueves del mes');
  });
  it('valida', () => {
    const ok = { nombre: 'Rayos X', recurrencias: [{ tipo: 'diasSemana', dias: [2] }] as Programacion[], anticipacion: 1 };
    expect(validarProgramado(ok)).toEqual({ ok: true });
    expect(validarProgramado({ ...ok, recurrencias: [], nombre: ' ' }).ok).toBe(false);
    expect(validarProgramado({ ...ok, recurrencias: [], anticipacion: 1 })).toEqual({ ok: false, error: 'Elige cuándo se repite.' });
    expect(validarProgramado({ ...ok, recurrencias: ok.recurrencias, anticipacion: -1 }).ok).toBe(false);
    expect(validarProgramado({ ...ok, recurrencias: ok.recurrencias, anticipacion: 1.5 }).ok).toBe(false);
  });
  it('los precargados tienen id fijo y todos son válidos', () => {
    expect(sug.map((p) => p.id)).toEqual(programadosSugeridos('2030-01-01').map((p) => p.id));
    for (const p of sug) expect(validarProgramado(p).ok).toBe(true);
  });
});
