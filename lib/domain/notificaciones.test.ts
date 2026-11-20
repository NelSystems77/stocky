import { describe, expect, it } from 'vitest';
import {
  AJUSTES_NOTIFICACIONES_INICIALES as TODO,
  DIAS_VIGENCIA_AVISO,
  expiraEnAviso,
  franjaDe,
  planificarAvisos,
} from './notificaciones';
import { programadosSugeridos } from './pedidosEnvios';
import type { Tarea } from './tareas';

const t = (id: string, p: Partial<Tarea> = {}): Tarea => ({
  id,
  titulo: id,
  recurrencia: { tipo: 'diaria' },
  hora: null,
  prioridad: 'media',
  notas: '',
  activa: true,
  desde: '2026-11-09',
  ...p,
});

const base = { cumplimientos: [], hoy: '2026-11-12', ajustes: TODO }; // jueves

describe('franjaDe', () => {
  it('redondea hacia abajo a 5 minutos', () => {
    expect(franjaDe('07:03')).toBe('07:00');
    expect(franjaDe('11:59')).toBe('11:55');
    expect(franjaDe('12:00')).toBe('12:00');
  });
});

describe('planificarAvisos', () => {
  it('resumen de las 7:00 con tareas de hoy y pendientes anteriores', () => {
    const [a] = planificarAvisos({ ...base, franja: '07:00', tareas: [t('a'), t('b')] });
    expect(a?.cuerpo).toBe('2 tareas para hoy y 6 pendientes de días anteriores.'); // 9,10,11 × 2 tareas
    expect(a?.clave).toBe('2026-11-12_resumen-manana');
  });
  it('sin nada que decir no avisa', () => {
    expect(planificarAvisos({ ...base, franja: '07:00', tareas: [] })).toEqual([]);
  });
  it('resumen de las 12:00 lista lo que falta y omite lo ya hecho', () => {
    const avisos = planificarAvisos({
      ...base,
      franja: '12:00',
      tareas: [t('Temperatura PM'), t('Preconteo')],
      cumplimientos: [{ tareaId: 'Preconteo', fechaOrigen: '2026-11-12', estado: 'hecha' }],
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ titulo: 'Te falta por hacer hoy: 1', cuerpo: 'Temperatura PM.' });
  });
  it('recordatorio a la hora de la tarea, dentro de su franja de 5 min', () => {
    const tareas = [t('con-hora', { hora: '09:32' }), t('otra', { hora: '09:40' }), t('sin-hora')];
    const avisos = planificarAvisos({ ...base, franja: '09:30', tareas });
    expect(avisos.map((a) => a.cuerpo)).toEqual(['con-hora']);
    expect(avisos[0]?.titulo).toBe('Recordatorio · 09:32');
  });
  it('no recuerda una tarea que ya se hizo', () => {
    const avisos = planificarAvisos({
      ...base,
      franja: '09:30',
      tareas: [t('x', { hora: '09:30' })],
      cumplimientos: [{ tareaId: 'x', fechaOrigen: '2026-11-12', estado: 'hecha' }],
    });
    expect(avisos).toEqual([]);
  });
  it('respeta lo que la persona silenció', () => {
    const tareas = [t('x', { hora: '07:00' })];
    const silenciado = { resumenManana: false, resumenMediodia: false, recordatorios: false, pedidosEnvios: false };
    expect(planificarAvisos({ ...base, franja: '07:00', tareas, ajustes: silenciado })).toEqual([]);
  });
  it('ningún aviso fuera del calendario laboral', () => {
    const tareas = [t('x', { hora: '07:00' })];
    expect(planificarAvisos({ ...base, hoy: '2026-11-15', franja: '07:00', tareas })).toEqual([]); // domingo
    expect(planificarAvisos({ ...base, hoy: '2026-11-21', franja: '07:00', tareas })).toEqual([]); // sáb (no es el 2.º)
    expect(planificarAvisos({ ...base, franja: '07:00', tareas, feriados: ['2026-11-12'] })).toEqual([]);
    expect(planificarAvisos({ ...base, hoy: '2026-11-14', franja: '07:00', tareas })).not.toEqual([]); // 2.º sábado
  });
});

describe('expiraEnAviso', () => {
  const ahora = new Date('2026-11-12T13:00:00Z');

  it('caduca 14 días después por defecto', () => {
    expect(DIAS_VIGENCIA_AVISO).toBe(14);
    expect(expiraEnAviso(ahora).toISOString()).toBe('2026-11-26T13:00:00.000Z');
  });

  it('acepta otra vigencia y siempre queda en el futuro', () => {
    expect(expiraEnAviso(ahora, 1).toISOString()).toBe('2026-11-13T13:00:00.000Z');
    expect(expiraEnAviso(ahora).getTime()).toBeGreaterThan(ahora.getTime());
  });

  it('no modifica la fecha recibida', () => {
    const copia = ahora.getTime();
    expiraEnAviso(ahora);
    expect(ahora.getTime()).toBe(copia);
  });
});

describe('avisos de pedidos y envíos', () => {
  const programados = programadosSugeridos('2026-11-01');
  const hoyJueves = { ...base, hoy: '2026-11-19', franja: '07:00', tareas: [], programados }; // jueves
  it('el jueves avisa del envío a R del lunes (2 días hábiles antes)', () => {
    const avisos = planificarAvisos(hoyJueves);
    expect(avisos.map((a) => a.titulo)).toEqual(['Preparar envío · Rancho Redondo (R)']);
    expect(avisos[0]?.cuerpo).toBe('Sale el lunes 23.');
  });
  it('el miércoles avisa del pedido de sueros del jueves (1 día hábil antes)', () => {
    const avisos = planificarAvisos({ ...hoyJueves, hoy: '2026-11-18' });
    expect(avisos.map((a) => a.titulo)).toEqual(['Poner en trámite · Pedido de sueros']);
    expect(avisos[0]?.cuerpo).toBe('Toca el jueves 19.');
  });
  it('anticipación 0: avisa el mismo día', () => {
    const p = [{ ...programados[5]!, anticipacion: 0 }]; // sueros, jueves
    const avisos = planificarAvisos({ ...hoyJueves, programados: p });
    expect(avisos.map((a) => a.cuerpo)).toEqual(['Toca hoy.']);
  });
  it('claves distintas por pedido y fecha (no se repiten)', () => {
    const claves = planificarAvisos(hoyJueves).map((a) => a.clave);
    expect(new Set(claves).size).toBe(claves.length);
    expect(claves[0]).toMatch(/^2026-11-19_programado_/);
  });
  it('no avisa lo que ya se marcó', () => {
    const seguimientos = [{ programadoId: 'sug-envio-r', fecha: '2026-11-23', estado: 'enviado' as const }];
    expect(planificarAvisos({ ...hoyJueves, seguimientos })).toEqual([]);
  });
  it('solo a las 7:00', () => {
    expect(planificarAvisos({ ...hoyJueves, franja: '12:00' })).toEqual([]);
  });
  it('respeta que la persona lo silencie', () => {
    expect(planificarAvisos({ ...hoyJueves, ajustes: { ...TODO, pedidosEnvios: false } })).toEqual([]);
  });
  it('sin pedidos ni envíos (772) no hay avisos', () => {
    expect(planificarAvisos({ ...hoyJueves, programados: [] })).toEqual([]);
  });
  it('no avisa en feriado', () => {
    expect(planificarAvisos({ ...hoyJueves, feriados: ['2026-11-19'] })).toEqual([]);
  });
  it('si el envío se traslada por un feriado, avisa para la fecha trasladada', () => {
    // El lunes 23 es feriado: R sale el viernes 20 y se avisa 2 días hábiles antes (miércoles 18).
    const avisos = planificarAvisos({ ...hoyJueves, hoy: '2026-11-18', feriados: ['2026-11-23'] });
    expect(avisos.map((a) => a.cuerpo)).toContain('Sale el viernes 20.');
    // El jueves 19 ya no toca avisar de R (el lunes 23 es feriado); sí del envío a C, cuyo martes 24 cuenta un día hábil menos.
    const jueves = planificarAvisos({ ...hoyJueves, feriados: ['2026-11-23'] }).map((x) => x.titulo);
    expect(jueves).toEqual(['Preparar envío · Cascajal (C)']);
  });
});

