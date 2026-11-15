'use client';

import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { useEstadoSync } from '@/lib/db/sync';

export function SyncIndicator() {
  const { online, pendientes, heredados } = useEstadoSync();
  const hayCola = pendientes > 0 || heredados;
  // Con cambios de una sesión anterior no se conoce el número exacto.
  const cambios = pendientes > 0 ? `${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} por sincronizar` : 'cambios por sincronizar';

  if (!online) {
    return (
      <span role="status" className="flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs text-warning">
        <CloudOff aria-hidden className="size-4" />
        {hayCola ? `Sin conexión · ${cambios}` : 'Sin conexión'}
      </span>
    );
  }
  if (hayCola) {
    return (
      <span role="status" className="flex items-center gap-1.5 rounded-full bg-info/15 px-3 py-1 text-xs text-info">
        <RefreshCw aria-hidden className="size-4 animate-spin" />
        {pendientes > 0 ? `Sincronizando · ${pendientes}` : 'Sincronizando'}
      </span>
    );
  }
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-text-muted">
      <Check aria-hidden className="size-4 text-ok" />
      Sincronizado
    </span>
  );
}
