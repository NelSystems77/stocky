'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { guardarProgramado, guardarSeguimiento, restaurarSeguimiento, suscribirProgramados, suscribirSeguimientos } from '@/lib/db/pedidosEnvios';
import { hoyCostaRica, sumarDias } from '@/lib/domain/calendario';
import {
  siguienteEstado,
  VENTANA_ATRASADOS,
  type OcurrenciaProgramada,
  type Programado,
  type Seguimiento,
} from '@/lib/domain/pedidosEnvios';
import { useFeriados } from '@/lib/tareas/useFeriados';

/** Pedidos y envíos del 771 en vivo. Para otras cuentas no se suscribe a nada (`aplica = false`). */
export function usePedidosEnvios() {
  const { estado } = useAuth();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const aplica = estado.fase === 'listo' && estado.sesion.unidad === '771';
  const feriados = useFeriados();
  const [pedidos, setPedidos] = useState<Programado[] | undefined>(undefined);
  const [envios, setEnvios] = useState<Programado[] | undefined>(undefined);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[] | undefined>(undefined);

  useEffect(() => {
    if (!uid || !aplica) return;
    // Se leen desde antes de la ventana de atrasados y de lo que muestra el calendario del mes anterior.
    const desde = sumarDias(hoyCostaRica(), -Math.max(VENTANA_ATRASADOS, 45));
    const bajas = [
      suscribirProgramados(uid, 'pedido', setPedidos),
      suscribirProgramados(uid, 'envio', setEnvios),
      suscribirSeguimientos(uid, desde, setSeguimientos),
    ];
    return () => bajas.forEach((b) => b());
  }, [uid, aplica]);

  const programados = useMemo(() => [...(envios ?? []), ...(pedidos ?? [])], [envios, pedidos]);
  return {
    uid,
    aplica,
    feriados,
    programados,
    seguimientos: seguimientos ?? [],
    cargando: aplica && (pedidos === undefined || envios === undefined || seguimientos === undefined),
  };
}

/** Avanza una ocurrencia (pendiente → en trámite → enviado) y ofrece «Deshacer». Escribe en local y sigue. */
export function useAvanzar(uid: string | null, seguimientos: readonly Seguimiento[]) {
  const { mostrar } = useToast();
  return (o: OcurrenciaProgramada) => {
    const sig = siguienteEstado(o.clase, o.estado);
    if (!uid || sig === null) return;
    const previo = seguimientos.find((s) => s.programadoId === o.programadoId && s.fecha === o.fecha) ?? null;
    void guardarSeguimiento(uid, { programadoId: o.programadoId, fecha: o.fecha, estado: sig }).catch(() =>
      mostrar('No se pudo guardar el cambio.', { tono: 'error' }),
    );
    mostrar(sig === 'en_tramite' ? `En trámite: ${o.nombre}` : `Enviado: ${o.nombre}`, {
      tono: 'ok',
      accion: {
        etiqueta: 'Deshacer',
        alPulsar: () =>
          void restaurarSeguimiento(uid, o.programadoId, o.fecha, previo).catch(() => mostrar('No se pudo deshacer.', { tono: 'error' })),
      },
    });
  };
}

export function useGuardarProgramado(uid: string | null) {
  const { mostrar } = useToast();
  return (p: Programado, mensaje = 'Guardado.') => {
    if (!uid) return;
    void guardarProgramado(uid, p).catch(() => mostrar('No se pudo guardar.', { tono: 'error' }));
    mostrar(mensaje, { tono: 'ok' });
  };
}
