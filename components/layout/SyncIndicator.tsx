'use client';

import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { useEstadoSync } from '@/lib/db/sync';

export function SyncIndicator() {
  const { online, pendientes } = useEstadoSync();
  const cambios = `${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} por sincronizar`;

  if (!online) {
    return (
      <span role="status" className="flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs text-warning">
        <CloudOff aria-hidden className="size-4" />
        Sin conexión · {cambios}
      </span>
    );
  }
  if (pendientes > 0) {
    return (
      <span role="status" className="flex items-center gap-1.5 rounded-full bg-info/15 px-3 py-1 text-xs text-info">
        <RefreshCw aria-hidden className="size-4 animate-spin" />
        Sincronizando · {pendientes}
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
