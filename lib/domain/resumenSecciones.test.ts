import { describe, expect, it } from 'vitest';
import { normalizarSeleccion, SECCIONES_RESUMEN, seccionesDisponibles, seleccionEfectiva } from './resumenSecciones';

describe('normalizarSeleccion', () => {
  it('sin dato guardado: todas marcadas', () => {
    expect(normalizarSeleccion(undefined)).toEqual([...SECCIONES_RESUMEN]);
    expect(normalizarSeleccion('basura')).toEqual([...SECCIONES_RESUMEN]);
  });
  it('respeta la elección, en el orden del resumen y sin repetidas ni desconocidas', () => {
    expect(normalizarSeleccion(['danados', 'tareas', 'danados', 'inventada'])).toEqual(['tareas', 'danados']);
  });
  it('una lista vacía se respeta (todo desmarcado)', () => {
    expect(normalizarSeleccion([])).toEqual([]);
  });
});

describe('seccionesDisponibles', () => {
  it('el 771 y el superadmin ven todas', () => {
    expect(seccionesDisponibles('todos')).toEqual([...SECCIONES_RESUMEN]);
  });
  it('el 772 sin módulos habilitados solo ve tareas, vencidos y agotados', () => {
    expect(seccionesDisponibles([])).toEqual(['tareas', 'vencidos', 'agotados']);
  });
  it('envíos y pedidos solo con sus módulos', () => {
    expect(seccionesDisponibles([])).not.toContain('envios');
    expect(seccionesDisponibles(['envios'])).toEqual(['tareas', 'vencidos', 'agotados', 'envios']);
    expect(seccionesDisponibles(['pedidos', 'envios'])).toEqual(['tareas', 'vencidos', 'agotados', 'envios', 'pedidos']);
  });
  it('un módulo habilitado agrega su sección', () => {
    expect(seccionesDisponibles(['danados', 'preconteo'])).toEqual(['tareas', 'preconteo', 'danados', 'vencidos', 'agotados']);
  });
});

describe('seleccionEfectiva', () => {
  it('quita lo elegido que ya no está disponible', () => {
    expect(seleccionEfectiva(['tareas', 'danados', 'agotados'], ['tareas', 'agotados'])).toEqual(['tareas', 'agotados']);
  });
});
