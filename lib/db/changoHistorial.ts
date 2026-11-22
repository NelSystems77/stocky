import { collection, limit, onSnapshot, orderBy, query, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import { MAX_HISTORIAL_CHANGO, ordenarHistorial, type EntradaHistorial } from '@/lib/domain/historialChango';
import { firestore } from '@/lib/firebase';

const HistorialDoc = z.object({
  pregunta: z.string(),
  respuesta: z.string(),
  modelo: z.string(),
  fecha: z.instanceof(Timestamp),
});

/**
 * Consultas guardadas por la Cloud Function (`usuarios/{uid}/changoIA`), las más recientes primero. Solo lectura:
 * el cliente no escribe ni borra; cada registro caduca solo a los 90 días (política TTL sobre `expiraEn`).
 * Los documentos inválidos se omiten.
 */
export function suscribirHistorialChango(uid: string, alCambiar: (lista: EntradaHistorial[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(firestore(), `usuarios/${uid}/changoIA`), orderBy('fecha', 'desc'), limit(MAX_HISTORIAL_CHANGO)),
    (snap) => {
      const lista: EntradaHistorial[] = [];
      for (const d of snap.docs) {
        const r = HistorialDoc.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, pregunta: r.data.pregunta, respuesta: r.data.respuesta, modelo: r.data.modelo, fecha: r.data.fecha.toDate() });
      }
      alCambiar(ordenarHistorial(lista));
    },
    () => alCambiar([]),
  );
}
