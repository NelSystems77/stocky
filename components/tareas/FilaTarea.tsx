'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Clock, X } from 'lucide-react';
import { useRef } from 'react';
import type { Ocurrencia } from '@/lib/domain/tareas';
import type { FechaISO } from '@/lib/domain/types';

const UMBRAL_DESLIZAR = 90;

interface Props {
  o: Ocurrencia;
  hoy: FechaISO;
  alHecha: () => void;
  alPosponer: () => void;
  alDescartar: () => void;
}

const dia = (f: FechaISO) => format(parseISO(f), "EEE d 'de' MMM", { locale: es });

export function FilaTarea({ o, hoy, alHecha, alPosponer, alDescartar }: Props) {
  const inicioX = useRef<number | null>(null);
  const atrasada = o.fechaVence < hoy;

  const detalle = [
    o.hora,
    atrasada ? `Atrasada · ${dia(o.fechaVence)}` : null,
    o.estado === 'pospuesta' && o.fechaOrigen !== o.fechaVence ? `Pospuesta desde ${dia(o.fechaOrigen)}` : null,
  ].filter(Boolean);

  return (
    <li
      className="flex touch-pan-y items-center gap-2 rounded-2xl bg-surface p-2 pr-1"
      // Celular: deslizar a la derecha completa; a la izquierda pospone.
      onTouchStart={(e) => {
        inicioX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = inicioX.current;
        inicioX.current = null;
        const x1 = e.changedTouches[0]?.clientX;
        if (x0 === null || x1 === undefined) return;
        if (x1 - x0 > UMBRAL_DESLIZAR) alHecha();
        else if (x0 - x1 > UMBRAL_DESLIZAR) alPosponer();
      }}
    >
      <button
        type="button"
        onClick={alHecha}
        aria-label={`Marcar como hecha: ${o.titulo}`}
        className="group grid size-11 shrink-0 place-items-center rounded-full"
      >
        <span className="grid size-7 place-items-center rounded-full border-2 border-text-muted transition duration-200 group-hover:border-accent group-active:bg-accent">
          <Check aria-hidden className="size-4 text-bg opacity-0 group-active:opacity-100" />
        </span>
      </button>

      <div className="min-w-0 flex-1 py-1">
        <p className="flex items-center gap-2">
          <span className="truncate">{o.titulo}</span>
          {o.prioridad === 'alta' && (
            <span className="shrink-0 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">Alta</span>
          )}
        </p>
        {detalle.length > 0 && (
          <p className={`text-xs ${atrasada ? 'text-warning' : 'text-text-muted'}`}>{detalle.join(' · ')}</p>
        )}
        {o.notas && <p className="truncate text-xs text-text-muted">{o.notas}</p>}
      </div>

      <button
        type="button"
        onClick={alPosponer}
        aria-label={`Posponer: ${o.titulo}`}
        className="grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
      >
        <Clock aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        onClick={alDescartar}
        aria-label={`Descartar: ${o.titulo}`}
        className="grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
      >
        <X aria-hidden className="size-5" />
      </button>
    </li>
  );
}
