import { waitForPendingWrites } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { firestore } from '@/lib/firebase';

export interface EstadoSync {
  online: boolean;
  /** Escrituras de esta sesión aún sin confirmar por el servidor (se pueden contar). */
  pendientes: number;
  /** Hay cambios en cola de una sesión anterior (la página se recargó sin conexión): no se pueden contar. */
  heredados: boolean;
}

let estado: EstadoSync = { online: true, pendientes: 0, heredados: false };
const oyentes = new Set<() => void>();
const SERVIDOR: EstadoSync = { online: true, pendientes: 0, heredados: false };

function cambiar(parcial: Partial<EstadoSync>): void {
  estado = { ...estado, ...parcial };
  oyentes.forEach((o) => o());
}

const alConectar = () => cambiar({ online: true });
const alDesconectar = () => cambiar({ online: false });

let revisado = false;

/**
 * Tras recargar, los cambios hechos sin conexión siguen en la cola local de Firestore pero el contador en memoria
 * se reinició. `waitForPendingWrites` se cumple de inmediato si no hay nada en cola; si tarda, hay cambios heredados.
 */
function revisarHeredados(): void {
  if (revisado) return;
  revisado = true;
  try {
    let resuelto = false;
    void waitForPendingWrites(firestore()).then(() => {
      resuelto = true;
      cambiar({ heredados: false });
    });
    setTimeout(() => {
      if (!resuelto) cambiar({ heredados: true });
    }, 500);
  } catch {
    // Sin configuración de Firebase: no hay nada que revisar.
  }
}

function suscribir(oyente: () => void): () => void {
  if (oyentes.size === 0) {
    revisarHeredados();
    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);
    estado = { ...estado, online: navigator.onLine };
  }
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) {
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
    }
  };
}

/**
 * Envuelve la promesa de una escritura de Firestore. Sin conexión la promesa queda abierta
 * hasta que el servidor confirme, así que sirve para contar los cambios por sincronizar.
 * Nunca se espera en la UI: se escribe y se sigue.
 */
export function registrarEscritura<T>(escritura: Promise<T>): Promise<T> {
  cambiar({ pendientes: estado.pendientes + 1 });
  return escritura.finally(() => cambiar({ pendientes: estado.pendientes - 1 }));
}

export function useEstadoSync(): EstadoSync {
  return useSyncExternalStore(suscribir, () => estado, () => SERVIDOR);
}
