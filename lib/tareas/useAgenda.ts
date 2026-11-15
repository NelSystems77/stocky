'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { hoyCostaRica, sumarDias } from '@/lib/domain/calendario';
import { VENTANA_ATRAS, type Cumplimiento, type Tarea } from '@/lib/domain/tareas';
import { suscribirCumplimientos, suscribirTareas } from '@/lib/db/tareas';
import { useFeriados } from './useFeriados';

/** Tareas y cumplimientos en vivo. `cargando` es `true` hasta que llegan ambos. */
export function useAgenda() {
  const { estado } = useAuth();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const feriados = useFeriados();
  const [tareas, setTareas] = useState<Tarea[] | undefined>(undefined);
  const [cumplimientos, setCumplimientos] = useState<Cumplimiento[] | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    // Los cumplimientos se leen desde el doble de la ventana: cubren pospuestas que cruzan la ventana.
    const desde = sumarDias(hoyCostaRica(), -VENTANA_ATRAS * 2);
    const bajas = [suscribirTareas(uid, setTareas), suscribirCumplimientos(uid, desde, setCumplimientos)];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  return { uid, feriados, tareas: tareas ?? [], cumplimientos: cumplimientos ?? [], cargando: tareas === undefined || cumplimientos === undefined };
}
