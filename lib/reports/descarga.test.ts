import { describe, expect, it } from 'vitest';
import { decidirEntrega, generarArchivo, puedeCompartirArchivo } from './descarga';
import type { DatosReporte } from './tipos';

const datos: DatosReporte = {
  titulo: 'Prueba',
  usuario: 'Ana',
  unidad: '771',
  generadoEn: new Date('2026-11-21T18:00:00Z'),
  detalle: [],
  columnas: ['Código', 'Descripción'],
  filas: [['110-16-0010', 'PARACETAMOL']],
  resumen: [],
  nombreArchivo: 'prueba_20261121',
};

describe('generarArchivo', () => {
  it('el PDF lleva su nombre, su tipo y empieza como un PDF', async () => {
    const a = await generarArchivo(datos, 'pdf');
    expect(a.nombre).toBe('prueba_20261121.pdf');
    expect(a.blob.type).toBe('application/pdf');
    expect(new TextDecoder().decode(new Uint8Array(await a.blob.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
  });
  it('el Excel lleva su nombre y su tipo', async () => {
    const a = await generarArchivo(datos, 'xlsx');
    expect(a.nombre).toBe('prueba_20261121.xlsx');
    expect(a.blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(a.blob.size).toBeGreaterThan(100);
  });
});

describe('decidirEntrega', () => {
  it('celular (sin ratón) con menú de compartir: botones, sin descarga automática', () => {
    expect(decidirEntrega(true, false)).toEqual({ compartir: true, descargaAutomatica: false });
  });
  it('celular sin menú de compartir: solo Abrir y Descargar', () => {
    expect(decidirEntrega(false, false)).toEqual({ compartir: false, descargaAutomatica: false });
  });
  it('computadora: se descarga sola, y ofrece compartir si el navegador puede', () => {
    expect(decidirEntrega(false, true)).toEqual({ compartir: false, descargaAutomatica: true });
    expect(decidirEntrega(true, true)).toEqual({ compartir: true, descargaAutomatica: true });
  });
});

describe('puedeCompartirArchivo', () => {
  it('sin menú de compartir del navegador (como en estas pruebas) devuelve falso en vez de fallar', async () => {
    expect(puedeCompartirArchivo(await generarArchivo(datos, 'pdf'))).toBe(false);
  });
});
