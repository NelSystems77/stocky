import { describe, expect, it } from 'vitest';
import { siguienteDiaLaborable } from './calendario';
import { ocurrencias, vistaHoy, type Cumplimiento, type Tarea } from './tareas';
import { migrarTareasSugeridas, tareasSugeridas } from './tareasSugeridas';

const tarea = (p: Partial<Tarea> & Pick<Tarea, 'id'>): Tarea => ({
  titulo: p.id,
  recurrencia: { tipo: 'diaria' },
  hora: null,
  prioridad: 'media',
  notas: '',
  activa: true,
  desde: '2026-11-01',
  ...p,
});

describe('ocurrencias', () => {
  it('una tarea diaria ocurre solo en días laborables', () => {
    const r = ocurrencias([tarea({ id: 'a' })], [], '2026-11-12', '2026-11-16'); // jue → lun
    expect(r.map((o) => o.fechaVence)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-16']); // 14 = 2.º sábado
  });
  it('no genera ocurrencias anteriores a su creación', () => {
    const r = ocurrencias([tarea({ id: 'a', desde: '2026-11-13' })], [], '2026-11-10', '2026-11-13');
    expect(r.map((o) => o.fechaVence)).toEqual(['2026-11-13']);
  });
  it('una tarea única aparece en su fecha, aunque sea anterior a «desde»', () => {
    const t = tarea({ id: 'u', recurrencia: { tipo: 'unica', fecha: '2026-11-05' } });
    expect(ocurrencias([t], [], '2026-11-01', '2026-11-30')).toHaveLength(1);
    expect(ocurrencias([t], [], '2026-11-06', '2026-11-30')).toHaveLength(0);
  });
  it('las pausadas no generan nada', () => {
    expect(ocurrencias([tarea({ id: 'a', activa: false })], [], '2026-11-12', '2026-11-13')).toEqual([]);
  });
  it('ordena por fecha, hora (sin hora al final) y prioridad', () => {
    const r = ocurrencias(
      [
        tarea({ id: 'sin-hora', hora: null, prioridad: 'alta' }),
        tarea({ id: 'tarde', hora: '15:00' }),
        tarea({ id: 'temprano', hora: '07:00', prioridad: 'baja' }),
        tarea({ id: 'temprano-alta', hora: '07:00', prioridad: 'alta' }),
      ],
      [],
      '2026-11-12',
      '2026-11-12',
    );
    expect(r.map((o) => o.tareaId)).toEqual(['temprano-alta', 'temprano', 'tarde', 'sin-hora']);
  });
  it('refleja hecha/descartada y mueve la pospuesta a la nueva fecha', () => {
    const cumpl: Cumplimiento[] = [
      { tareaId: 'a', fechaOrigen: '2026-11-12', estado: 'hecha' },
      { tareaId: 'a', fechaOrigen: '2026-11-13', estado: 'pospuesta', fechaProgramada: '2026-11-16' },
    ];
    const r = ocurrencias([tarea({ id: 'a' })], cumpl, '2026-11-12', '2026-11-16');
    expect(r.find((o) => o.fechaOrigen === '2026-11-12')?.estado).toBe('hecha');
    expect(r.find((o) => o.fechaOrigen === '2026-11-13')).toMatchObject({ fechaVence: '2026-11-16', estado: 'pospuesta' });
    expect(r.filter((o) => o.fechaVence === '2026-11-13')).toHaveLength(0);
  });
});

describe('vistaHoy', () => {
  const t = tarea({ id: 'a', desde: '2026-11-09' });
  it('lo no hecho pasa a pendientes de días anteriores', () => {
    const v = vistaHoy([t], [{ tareaId: 'a', fechaOrigen: '2026-11-10', estado: 'hecha' }], '2026-11-12');
    expect(v.hoy.map((o) => o.fechaVence)).toEqual(['2026-11-12']);
    expect(v.atrasadas.map((o) => o.fechaVence)).toEqual(['2026-11-09', '2026-11-11']); // el 10 está hecha
  });
  it('lo descartado desaparece y lo hecho hoy se cuenta aparte', () => {
    const v = vistaHoy(
      [t],
      [
        { tareaId: 'a', fechaOrigen: '2026-11-09', estado: 'descartada' },
        { tareaId: 'a', fechaOrigen: '2026-11-12', estado: 'hecha' },
      ],
      '2026-11-12',
    );
    expect(v.hoy).toEqual([]);
    expect(v.hechasHoy).toHaveLength(1);
    expect(v.atrasadas.map((o) => o.fechaVence)).toEqual(['2026-11-10', '2026-11-11']);
  });
  it('una pospuesta a hoy sale en hoy; una pospuesta a mañana no sale', () => {
    const v = vistaHoy(
      [t],
      [
        { tareaId: 'a', fechaOrigen: '2026-11-11', estado: 'pospuesta', fechaProgramada: '2026-11-12' },
        { tareaId: 'a', fechaOrigen: '2026-11-12', estado: 'pospuesta', fechaProgramada: '2026-11-13' },
      ],
      '2026-11-12',
    );
    expect(v.hoy).toEqual([expect.objectContaining({ fechaOrigen: '2026-11-11', estado: 'pospuesta' })]);
  });
  it('lo más viejo que la ventana deja de mostrarse', () => {
    const vieja = tarea({ id: 'v', recurrencia: { tipo: 'unica', fecha: '2026-09-01' } });
    expect(vistaHoy([vieja], [], '2026-11-12').atrasadas).toEqual([]);
  });
});

describe('siguienteDiaLaborable', () => {
  it('salta fines de semana, el sábado que no es el 2.º y los feriados', () => {
    expect(siguienteDiaLaborable('2026-11-13')).toBe('2026-11-14'); // vie → 2.º sábado
    expect(siguienteDiaLaborable('2026-11-14')).toBe('2026-11-16');
    expect(siguienteDiaLaborable('2026-11-20')).toBe('2026-11-23'); // vie → lun (sáb 21 no es el 2.º)
    expect(siguienteDiaLaborable('2026-11-16', ['2026-11-17'])).toBe('2026-11-18');
  });
});

describe('tareasSugeridas', () => {
  it('el 771 recibe las del PRD con IDs fijos; el 772 ninguna', () => {
    const t = tareasSugeridas('771', '2026-11-12');
    expect(t.map((x) => x.id)).toContain('sug-cargar-reportes');
    expect(t.find((x) => x.id === 'sug-cargar-reportes')).toMatchObject({ hora: '07:00', recurrencia: { tipo: 'tercerJueves' } });
    expect(t.find((x) => x.id === 'sug-cargar-existencias-15')).toMatchObject({ hora: '07:00', recurrencia: { tipo: 'tercerJuevesMas15' } });
    expect(new Set(t.map((x) => x.id)).size).toBe(t.length);
    expect(tareasSugeridas('772', '2026-11-12')).toEqual([]);
  });
});

describe('migrarTareasSugeridas', () => {
  const semanal: Tarea = {
    id: 'sug-cargar-reportes',
    titulo: 'Cargar reportes (lotes, vencimientos y consumos)',
    recurrencia: { tipo: 'diasSemana', dias: [4] },
    hora: '07:00',
    prioridad: 'media',
    notas: '',
    activa: true,
    desde: '2026-11-01',
  };
  it('la semanal sin tocar pasa al tercer jueves, conserva su fecha de inicio y suma la de +15 días', () => {
    const r = migrarTareasSugeridas([semanal], '771', '2026-11-20');
    expect(r.map((t) => [t.id, t.recurrencia.tipo])).toEqual([
      ['sug-cargar-reportes', 'tercerJueves'],
      ['sug-cargar-existencias-15', 'tercerJuevesMas15'],
    ]);
    expect(r[0]?.desde).toBe('2026-11-01');
  });
  it('conserva la pausa', () => {
    expect(migrarTareasSugeridas([{ ...semanal, activa: false }], '771', '2026-11-20').every((t) => !t.activa)).toBe(true);
  });
  it('si la persona la editó, no se toca nada', () => {
    expect(migrarTareasSugeridas([{ ...semanal, hora: '08:30' }], '771', '2026-11-20')).toEqual([]);
    expect(migrarTareasSugeridas([{ ...semanal, titulo: 'Mi carga' }], '771', '2026-11-20')).toEqual([]);
  });
  it('ya migrada (o sin la tarea) no hace nada; el 772 tampoco', () => {
    const nuevas = tareasSugeridas('771', '2026-11-20');
    expect(migrarTareasSugeridas(nuevas, '771', '2026-11-20')).toEqual([]);
    expect(migrarTareasSugeridas([], '771', '2026-11-20')).toEqual([]);
    expect(migrarTareasSugeridas([semanal], '772', '2026-11-20')).toEqual([]);
  });
  it('no duplica la de +15 días si ya existe', () => {
    const quince = tareasSugeridas('771', '2026-11-20').find((t) => t.id === 'sug-cargar-existencias-15')!;
    expect(migrarTareasSugeridas([semanal, quince], '771', '2026-11-20').map((t) => t.id)).toEqual(['sug-cargar-reportes']);
  });
});

