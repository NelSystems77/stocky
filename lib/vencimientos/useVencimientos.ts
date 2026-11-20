'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import { suscribirLotes } from '@/lib/db/lotes';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { ultimaCargaLotes, type LoteGuardado } from '@/lib/domain/lotes';
import {
  analizarVencimientos,
  proyectarLotes,
  resumirVencimientos,
  type AlertaLote,
  type ExistenciaReal,
  type LoteVista,
  type ResumenVencimientos,
} from '@/lib/domain/vencimientos';
import { useRiesgo } from '@/lib/riesgo/useRiesgo';
import { useFeriados } from '@/lib/tareas/useFeriados';

export interface EstadoVencimientos {
  uid: string | null;
  /** `true` hasta que llegan los lotes, las existencias y los consumos. */
  cargando: boolean;
  lotes: LoteGuardado[];
  /** Todos los lotes con la cantidad vigente (proyectada si pasó tiempo desde la última carga). */
  vista: LoteVista[];
  /** Alertas de los lotes con existencia, de la más urgente a la menos. */
  alertas: AlertaLote[];
  resumen: ResumenVencimientos;
  /** Fecha del último reporte de lotes cargado. */
  ultimaCarga: string | null;
  excesoReal: Set<string>;
  ajustados: Map<string, number>;
  existencias: Existencia[];
  hoy: string;
}

/**
 * Lotes con su proyección (RF-2.6) y alertas A1/A2, en vivo. El consumo diario sale del mismo análisis de riesgo
 * (media móvil de las últimas 4 cargas de consumo); la existencia real, del último reporte de existencias.
 */
export function useVencimientos(): EstadoVencimientos {
  const { estado } = useAuth();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const feriados = useFeriados();
  const [lotes, setLotes] = useState<LoteGuardado[] | undefined>(undefined);
  const [existencias, setExistencias] = useState<Existencia[] | undefined>(undefined);
  const { riesgos, hayConsumos } = useRiesgo(existencias);

  useEffect(() => {
    if (!uid) return;
    const bajas = [suscribirLotes(uid, setLotes), suscribirExistencias(uid, setExistencias)];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  const hoy = hoyCostaRica();

  return useMemo(() => {
    const cargando = lotes === undefined || existencias === undefined || hayConsumos === undefined;
    const consumos = new Map<string, number | null>();
    for (const [codigo, r] of riesgos) consumos.set(codigo, r.consumoDiario);
    const reales = new Map<string, ExistenciaReal>();
    for (const e of existencias ?? []) {
      if (e.existencia !== undefined) reales.set(e.codigo, { existencia: e.existencia, fecha: hoyCostaRica(e.actualizadoEn.toDate()) });
    }
    const guardados = lotes ?? [];
    const { lotes: vista, excesoReal, ajustados } = proyectarLotes({ lotes: guardados, consumos, existencias: reales, hoy, feriados });
    const alertas = analizarVencimientos({ lotes: vista, consumos, hoy, feriados });
    return {
      uid,
      cargando,
      lotes: guardados,
      vista,
      alertas,
      resumen: resumirVencimientos(alertas),
      ultimaCarga: ultimaCargaLotes(guardados),
      excesoReal,
      ajustados,
      existencias: existencias ?? [],
      hoy,
    };
  }, [uid, lotes, existencias, riesgos, hayConsumos, feriados, hoy]);
}
