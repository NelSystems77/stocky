'use client';

import { useToast } from '@/components/ui/Toast';
import { guardarCumplimiento, restaurarCumplimiento } from '@/lib/db/tareas';
import type { Cumplimiento, Ocurrencia } from '@/lib/domain/tareas';
import type { FechaISO } from '@/lib/domain/types';

/** Acciones sobre una ocurrencia. Todas escriben en local y siguen, y ofrecen «Deshacer». */
export function useAcciones(uid: string | null, cumplimientos: readonly Cumplimiento[]) {
  const { mostrar } = useToast();

  const previoDe = (o: Ocurrencia): Cumplimiento | null =>
    cumplimientos.find((c) => c.tareaId === o.tareaId && c.fechaOrigen === o.fechaOrigen) ?? null;

  function aplicar(o: Ocurrencia, nuevo: Cumplimiento, mensaje: string) {
    if (!uid) return;
    const previo = previoDe(o);
    void guardarCumplimiento(uid, nuevo).catch(() => mostrar('No se pudo guardar el cambio.', { tono: 'error' }));
    mostrar(mensaje, {
      tono: 'ok',
      accion: {
        etiqueta: 'Deshacer',
        alPulsar: () =>
          void restaurarCumplimiento(uid, o.tareaId, o.fechaOrigen, previo).catch(() =>
            mostrar('No se pudo deshacer.', { tono: 'error' }),
          ),
      },
    });
  }

  const base = (o: Ocurrencia) => ({ tareaId: o.tareaId, fechaOrigen: o.fechaOrigen });

  return {
    hecha: (o: Ocurrencia) => {
      const prog = previoDe(o)?.fechaProgramada;
      aplicar(o, { ...base(o), estado: 'hecha', ...(prog ? { fechaProgramada: prog } : {}) }, `Hecha: ${o.titulo}`);
    },
    posponer: (o: Ocurrencia, fecha: FechaISO) =>
      aplicar(o, { ...base(o), estado: 'pospuesta', fechaProgramada: fecha }, `Pospuesta: ${o.titulo}`),
    descartar: (o: Ocurrencia, motivo: string) =>
      aplicar(o, { ...base(o), estado: 'descartada', ...(motivo ? { motivo } : {}) }, `Descartada: ${o.titulo}`),
    /** Vuelve una tarea hecha a pendiente (a su fecha pospuesta, si la tenía). */
    reabrir: (o: Ocurrencia) => {
      const prog = previoDe(o)?.fechaProgramada;
      aplicar(
        o,
        prog ? { ...base(o), estado: 'pospuesta', fechaProgramada: prog } : { ...base(o), estado: 'pospuesta', fechaProgramada: o.fechaOrigen },
        `Reabierta: ${o.titulo}`,
      );
    },
  };
}
