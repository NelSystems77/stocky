import { useSyncExternalStore } from 'react';

export interface EstadoSync {
  online: boolean;
  /** Escrituras locales aún sin confirmar por el servidor. */
  pendientes: number;
}

let estado: EstadoSync = { online: true, pendientes: 0 };
const oyentes = new Set<() => void>();
const SERVIDOR: EstadoSync = { online: true, pendientes: 0 };

function cambiar(parcial: Partial<EstadoSync>): void {
  estado = { ...estado, ...parcial };
  oyentes.forEach((o) => o());
}

const alConectar = () => cambiar({ online: true });
const alDesconectar = () => cambiar({ online: false });

function suscribir(oyente: () => void): () => void {
  if (oyentes.size === 0) {
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
