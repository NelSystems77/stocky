'use client';

import { useEffect, useState } from 'react';
import { suscribirUsuario } from '@/lib/db/usuario';
import { useAuth } from './AuthProvider';

/**
 * Módulos que el 771 habilitó a la cuenta (`modulosHabilitados`). Solo se lee para la farmacia 772:
 * el 771 y el superadmin ven todo y no necesitan la lista.
 */
export function useModulosHabilitados(): readonly string[] {
  const { estado } = useAuth();
  const uid = estado.fase === 'listo' && estado.sesion.unidad === '772' && estado.sesion.rol !== 'superadmin' ? estado.sesion.uid : null;
  const [modulos, setModulos] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!uid) return;
    return suscribirUsuario(uid, (d) => setModulos(d.modulosHabilitados));
  }, [uid]);

  return uid ? modulos : [];
}
