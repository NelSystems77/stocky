'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { suscribirConsumosRecientes } from '@/lib/db/consumos';
import type { Existencia } from '@/lib/db/existencias';
import { suscribirUsuario } from '@/lib/db/usuario';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { analizarRiesgo, MARGEN_RIESGO_INICIAL, type AnalisisRiesgo, type ConsumoImportado } from '@/lib/domain/riesgo';
import type { FechaISO } from '@/lib/domain/types';

export interface EstadoRiesgo {
  /** Riesgo por código de producto. */
  riesgos: Map<string, AnalisisRiesgo>;
  /** `undefined` mientras carga; `false` si no hay ninguna carga del reporte «Productos en despacho». */
  hayConsumos: boolean | undefined;
}

/** Riesgo de agotamiento (A3/A4) de cada producto, en vivo, con los feriados y el margen del usuario. */
export function useRiesgo(existencias: readonly Existencia[] | undefined): EstadoRiesgo {
  const { estado } = useAuth();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const [consumos, setConsumos] = useState<Map<string, ConsumoImportado[]> | undefined>(undefined);
  const [ajustes, setAjustes] = useState<{ feriados: readonly FechaISO[]; margen: number }>({ feriados: [], margen: MARGEN_RIESGO_INICIAL });

  useEffect(() => {
    if (!uid) return;
    const bajas = [
      suscribirConsumosRecientes(uid, setConsumos),
      suscribirUsuario(uid, (d) => setAjustes({ feriados: d.feriados, margen: d.margenRiesgo })),
    ];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  return useMemo(() => {
    const riesgos = new Map<string, AnalisisRiesgo>();
    if (!existencias || !consumos) return { riesgos, hayConsumos: undefined };
    for (const e of existencias) {
      if (e.existencia === undefined) continue;
      riesgos.set(
        e.codigo,
        analizarRiesgo({
          existencia: e.existencia,
          consumos: consumos.get(e.codigo) ?? [],
          fechaExistencia: hoyCostaRica(e.actualizadoEn.toDate()),
          feriados: ajustes.feriados,
          margen: ajustes.margen,
        }),
      );
    }
    return { riesgos, hayConsumos: consumos.size > 0 };
  }, [existencias, consumos, ajustes]);
}
