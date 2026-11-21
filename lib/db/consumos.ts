import { collection, limit, onSnapshot, orderBy, query, where, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import { hoyCostaRica } from '@/lib/domain/calendario';
import type { ConsumoImportado } from '@/lib/domain/riesgo';
import { firestore } from '@/lib/firebase';

/** Cuántas cargas de consumo se leen (la media móvil usa las últimas 4). */
const CARGAS = 4;
/** Importaciones recientes que se revisan para encontrar esas cargas (también hay reportes de existencias). */
const REVISAR = 16;

const ConsumoSchema = z.object({
  codigo: z.string(),
  periodo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cantidad: z.number().finite(),
});

/**
 * Consumos de las últimas 4 cargas del reporte «Productos en despacho», agrupados por código.
 * Solo se leen esas cargas (no todo el historial) para cuidar las lecturas de Firestore.
 */
export function suscribirConsumosRecientes(uid: string, alCambiar: (porCodigo: Map<string, ConsumoImportado[]>) => void): Unsubscribe {
  const base = `usuarios/${uid}`;
  let bajaConsumos: Unsubscribe | undefined;
  // `null` = todavía no se avisó nunca: así, sin ninguna carga de consumos (clave vacía) también se avisa la primera vez.
  let clave: string | null = null;

  const bajaImportaciones = onSnapshot(
    query(collection(firestore(), `${base}/importaciones`), orderBy('fechaReporte', 'desc'), limit(REVISAR)),
    (snap) => {
      const ids = snap.docs
        .filter((d) => d.get('tipoReporte') === 'productosEnDespacho')
        .slice(0, CARGAS)
        .map((d) => d.id);
      if (ids.join(',') === clave) return;
      clave = ids.join(',');
      bajaConsumos?.();
      bajaConsumos = undefined;
      if (ids.length === 0) return alCambiar(new Map());
      bajaConsumos = onSnapshot(
        query(collection(firestore(), `${base}/consumos`), where('importacionId', 'in', ids)),
        (s) => {
          const mapa = new Map<string, ConsumoImportado[]>();
          for (const d of s.docs) {
            const r = ConsumoSchema.safeParse(d.data());
            if (r.success) mapa.set(r.data.codigo, [...(mapa.get(r.data.codigo) ?? []), { periodo: r.data.periodo, cantidad: r.data.cantidad }]);
          }
          alCambiar(mapa);
        },
        () => alCambiar(new Map()),
      );
    },
    () => alCambiar(new Map()),
  );

  return () => {
    bajaImportaciones();
    bajaConsumos?.();
  };
}

/**
 * Fecha del reporte «Productos en despacho» más reciente (`null` si nunca se cargó), para la alerta A8.
 * Usa la misma consulta que las cargas de consumo (sin índice nuevo): importaciones recientes filtradas aquí.
 */
export function suscribirUltimaCargaConsumos(uid: string, alCambiar: (fecha: string | null) => void): Unsubscribe {
  return onSnapshot(
    query(collection(firestore(), `usuarios/${uid}/importaciones`), orderBy('fechaReporte', 'desc'), limit(REVISAR)),
    (snap) => {
      const d = snap.docs.find((x) => x.get('tipoReporte') === 'productosEnDespacho');
      const f = d?.get('fechaReporte') as { toDate?: () => Date } | undefined;
      alCambiar(f?.toDate ? hoyCostaRica(f.toDate()) : null);
    },
    () => alCambiar(null),
  );
}
