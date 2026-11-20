'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, PackageCheck, Send } from 'lucide-react';
import { ETIQUETA_ESTADO, etiquetaAccion, type OcurrenciaProgramada } from '@/lib/domain/pedidosEnvios';
import type { FechaISO } from '@/lib/domain/types';

const dia = (f: FechaISO) => format(parseISO(f), "EEE d 'de' MMM", { locale: es });

interface Props {
  o: OcurrenciaProgramada;
  hoy: FechaISO;
  /** Solo para los próximos: ya toca preparar. */
  preparar?: boolean;
  alAvanzar: () => void;
}

export function FilaPedidoEnvio({ o, hoy, preparar = false, alAvanzar }: Props) {
  const accion = etiquetaAccion(o.clase, o.estado);
  const atrasado = o.fecha < hoy;
  const Icono = o.clase === 'envio' ? Send : PackageCheck;
  const detalle = [
    o.clase === 'envio' ? 'Envío' : 'Pedido',
    atrasado ? `Atrasado · ${dia(o.fecha)}` : o.fecha === hoy ? 'Hoy' : dia(o.fecha),
    o.estado === 'en_tramite' ? ETIQUETA_ESTADO.en_tramite : null,
    preparar ? 'Hay que preparar' : null,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-2 rounded-2xl bg-surface p-2 pl-3">
      <Icono aria-hidden className={`size-5 shrink-0 ${atrasado ? 'text-warning' : preparar ? 'text-info' : 'text-text-muted'}`} />
      <div className="min-w-0 flex-1 py-1">
        <p className="truncate">{o.nombre}</p>
        <p className={`truncate text-xs ${atrasado ? 'text-warning' : 'text-text-muted'}`}>{detalle.join(' · ')}</p>
      </div>
      {accion && (
        <button
          type="button"
          onClick={alAvanzar}
          aria-label={`${accion}: ${o.nombre}, ${dia(o.fecha)}`}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-surface-2 px-3 text-sm font-semibold text-accent transition duration-200 hover:brightness-125"
        >
          <Check aria-hidden className="size-4" />
          {accion}
        </button>
      )}
    </li>
  );
}
