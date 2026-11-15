'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { suscribirUsuario } from '@/lib/db/usuario';
import type { FechaISO } from '@/lib/domain/types';

const SIN_FERIADOS: readonly FechaISO[] = [];

/** Feriados del usuario en vivo (`ajustes.feriados`). Vacío mientras carga o si la cuenta no tiene. */
export function useFeriados(): readonly FechaISO[] {
  const { estado } = useAuth();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const [feriados, setFeriados] = useState<readonly FechaISO[]>(SIN_FERIADOS);

  useEffect(() => {
    if (!uid) return;
    return suscribirUsuario(uid, (d) => setFeriados(d.feriados));
  }, [uid]);

  return feriados;
}
