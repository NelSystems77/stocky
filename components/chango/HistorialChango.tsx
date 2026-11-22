'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TextoRespuesta } from './TextoRespuesta';
import { suscribirHistorialChango } from '@/lib/db/changoHistorial';
import { agruparHistorialPorDia, DIAS_HISTORIAL_CHANGO, type EntradaHistorial } from '@/lib/domain/historialChango';

const hora = new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica', hour: 'numeric', minute: '2-digit' });

/** Consultas anteriores a Chango (solo lectura). Cada una caduca sola a los 90 días. */
export function HistorialChango({ uid, puedePreguntar, alPreguntarDeNuevo }: { uid: string; puedePreguntar: boolean; alPreguntarDeNuevo: (pregunta: string) => void }) {
  const [lista, setLista] = useState<EntradaHistorial[] | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => suscribirHistorialChango(uid, setLista), [uid]);
  const grupos = useMemo(() => agruparHistorialPorDia(lista ?? []), [lista]);

  if (lista === null) return <p className="text-text-muted">Cargando historial…</p>;
  if (lista.length === 0) {
    return <p className="text-text-muted">Todavía no hay consultas guardadas. Las preguntas que le hagas a Chango aparecerán aquí.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">Se guardan {DIAS_HISTORIAL_CHANGO} días y luego se borran solas. Mostrando las últimas consultas.</p>
      {grupos.map((g) => (
        <section key={g.dia} aria-label={g.dia} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-text-muted first-letter:uppercase">{format(parseISO(g.dia), "EEEE d 'de' MMMM yyyy", { locale: es })}</h3>
          <ul className="flex flex-col gap-2">
            {g.entradas.map((e) => {
              const abiertaEsta = abierta === e.id;
              return (
                <li key={e.id} className="rounded-2xl bg-surface">
                  <button
                    type="button"
                    aria-expanded={abiertaEsta}
                    onClick={() => setAbierta(abiertaEsta ? null : e.id)}
                    className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left"
                  >
                    <span className="flex-1">
                      <span className="block">{e.pregunta}</span>
                      <span className="text-[11px] text-text-muted">{hora.format(e.fecha)}</span>
                    </span>
                    <ChevronDown aria-hidden className={`mt-1 size-4 shrink-0 text-text-muted transition-transform duration-200 ${abiertaEsta ? 'rotate-180' : ''}`} />
                  </button>
                  {abiertaEsta && (
                    <div className="flex flex-col gap-2 border-t border-white/5 px-3 py-2">
                      <TextoRespuesta texto={e.respuesta} />
                      <button
                        type="button"
                        disabled={!puedePreguntar}
                        onClick={() => alPreguntarDeNuevo(e.pregunta)}
                        className="flex min-h-11 items-center gap-2 self-start rounded-xl bg-surface-2 px-3 text-sm text-accent disabled:opacity-50"
                      >
                        <RotateCcw aria-hidden className="size-4" />
                        Preguntar de nuevo
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
