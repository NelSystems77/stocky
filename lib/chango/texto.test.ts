import { describe, expect, it } from 'vitest';
import { parsearRespuesta, trocear } from './texto';

describe('trocear', () => {
  it('separa la negrita del texto normal', () => {
    expect(trocear('Quedan **3 días** de cobertura')).toEqual([
      { texto: 'Quedan ', negrita: false },
      { texto: '3 días', negrita: true },
      { texto: ' de cobertura', negrita: false },
    ]);
  });
  it('una marca sin cerrar queda como texto', () => {
    expect(trocear('algo **sin cerrar')).toEqual([
      { texto: 'algo ', negrita: false },
      { texto: '**sin cerrar', negrita: false },
    ]);
  });
  it('texto sin marcas', () => {
    expect(trocear('hola')).toEqual([{ texto: 'hola', negrita: false }]);
  });
});

describe('parsearRespuesta', () => {
  it('párrafos y listas con viñetas, sin líneas vacías', () => {
    const b = parsearRespuesta('Resumen:\n\n- **A** falta\n* B bajo\n\nFin');
    expect(b).toHaveLength(3);
    expect(b[0]).toEqual({ tipo: 'parrafo', trozos: [{ texto: 'Resumen:', negrita: false }] });
    expect(b[1]?.tipo).toBe('lista');
    expect(b[1]?.tipo === 'lista' && b[1].items).toHaveLength(2);
    expect(b[2]).toEqual({ tipo: 'parrafo', trozos: [{ texto: 'Fin', negrita: false }] });
  });
  it('quita los # de los títulos y no interpreta HTML', () => {
    const b = parsearRespuesta('## Título\n<b>x</b>');
    expect(b[0]).toEqual({ tipo: 'parrafo', trozos: [{ texto: 'Título', negrita: false }] });
    expect(b[1]).toEqual({ tipo: 'parrafo', trozos: [{ texto: '<b>x</b>', negrita: false }] });
  });
  it('texto vacío no genera bloques', () => {
    expect(parsearRespuesta('')).toEqual([]);
  });
});
