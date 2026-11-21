import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simula Firestore: guarda los oyentes para dispararlos a mano.
type Oyente = (snap: { docs: { id: string; get: (campo: string) => unknown; data: () => unknown }[] }) => void;
const oyentes: Oyente[] = [];

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ruta: string) => ({ ruta }),
  orderBy: () => ({}),
  limit: () => ({}),
  where: () => ({}),
  query: (c: unknown) => c,
  onSnapshot: (_q: unknown, alCambiar: Oyente) => {
    oyentes.push(alCambiar);
    return () => undefined;
  },
}));
vi.mock('@/lib/firebase', () => ({ firestore: () => ({}) }));

const importacion = (id: string, tipoReporte: string) => ({ id, get: (c: string) => (c === 'tipoReporte' ? tipoReporte : undefined), data: () => ({ tipoReporte }) });

describe('suscribirConsumosRecientes', () => {
  beforeEach(() => {
    oyentes.length = 0;
  });

  it('sin ninguna carga de consumos avisa igual con un mapa vacío (si no, la pantalla de Vencimientos se queda en «Cargando…»)', async () => {
    const { suscribirConsumosRecientes } = await import('./consumos');
    const llamadas: Map<string, unknown>[] = [];
    suscribirConsumosRecientes('u1', (m) => llamadas.push(m));
    // Solo hay reportes de existencias y de lotes, ninguno de «Productos en despacho».
    oyentes[0]!({ docs: [importacion('a', 'existenciasDespacho'), importacion('b', 'lotesVencimientos')] });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.size).toBe(0);
  });

  it('sin ninguna importación tampoco se queda esperando', async () => {
    const { suscribirConsumosRecientes } = await import('./consumos');
    const llamadas: Map<string, unknown>[] = [];
    suscribirConsumosRecientes('u1', (m) => llamadas.push(m));
    oyentes[0]!({ docs: [] });
    expect(llamadas).toHaveLength(1);
  });

  it('no repite el aviso cuando llegan otras importaciones que no son de consumos', async () => {
    const { suscribirConsumosRecientes } = await import('./consumos');
    const llamadas: Map<string, unknown>[] = [];
    suscribirConsumosRecientes('u1', (m) => llamadas.push(m));
    oyentes[0]!({ docs: [importacion('a', 'existenciasDespacho')] });
    oyentes[0]!({ docs: [importacion('b', 'lotesVencimientos'), importacion('a', 'existenciasDespacho')] });
    expect(llamadas).toHaveLength(1);
  });

  it('con una carga de consumos se suscribe a sus consumos', async () => {
    const { suscribirConsumosRecientes } = await import('./consumos');
    const llamadas: Map<string, unknown>[] = [];
    suscribirConsumosRecientes('u1', (m) => llamadas.push(m));
    oyentes[0]!({ docs: [importacion('c1', 'productosEnDespacho')] });
    expect(oyentes).toHaveLength(2); // importaciones + consumos
    oyentes[1]!({ docs: [{ id: 'x', get: () => undefined, data: () => ({ codigo: '110-16-0010', periodo: '2026-11-20', cantidad: 500 }) }] });
    expect(llamadas.at(-1)?.get('110-16-0010')).toEqual([{ periodo: '2026-11-20', cantidad: 500 }]);
  });
});
