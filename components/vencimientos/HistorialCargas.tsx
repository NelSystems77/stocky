'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { leerDetalleCarga, suscribirCargasLotes, type CargaLotes } from '@/lib/db/lotes';
import { formatearEnUD } from '@/lib/domain/formato';
import type { DetalleCambio, TipoDetalleCambio } from '@/lib/domain/lotes';

const fecha = (f: string) => (f ? format(parseISO(f), "d 'de' MMM yyyy", { locale: es }) : '—');

const ETIQUETA: Record<TipoDetalleCambio, string> = {
  vencimiento: 'Cambió el vencimiento',
  subio: 'Cantidad que subió',
  bajo: 'Cantidad que bajó',
  nuevo: 'Lote nuevo',
  salio: 'Salió del reporte',
};
const ORDEN: TipoDetalleCambio[] = ['vencimiento', 'subio', 'bajo', 'nuevo', 'salio'];

function Detalle({ uid, id }: { uid: string; id: string }) {
  const [cambios, setCambios] = useState<DetalleCambio[] | 'error' | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    leerDetalleCarga(uid, id).then(
      (c) => vigente && setCambios(c),
      () => vigente && setCambios('error'),
    );
    return () => {
      vigente = false;
    };
  }, [uid, id]);

  if (cambios === undefined) return <p className="animate-pulse text-sm text-text-muted">Cargando detalle…</p>;
  if (cambios === 'error') return <p className="text-sm text-critical">No se pudo leer el detalle (¿sin conexión?).</p>;
  if (cambios.length === 0) return <p className="text-sm text-text-muted">Esta carga no guardó detalle (fue la primera o no hubo cambios).</p>;

  return (
    <div className="flex flex-col gap-3">
      {ORDEN.map((tipo) => {
        const filas = cambios.filter((c) => c.tipo === tipo);
        if (filas.length === 0) return null;
        return (
          <details key={tipo} open={tipo === 'vencimiento' || tipo === 'subio'} className="text-sm">
            <summary className="min-h-8 cursor-pointer font-semibold">
              {ETIQUETA[tipo]} ({filas.length})
            </summary>
            <ul className="mt-1 flex flex-col gap-1 text-text-muted">
              {filas.map((c, i) => (
                <li key={`${c.codigo}${c.lote}${i}`}>
                  <span className="font-mono text-text">{c.codigo}</span> · lote {c.lote} · {c.descripcion}
                  <br />
                  {tipo === 'vencimiento' && c.venceAntes && (
                    <>
                      {fecha(c.venceAntes)} → <strong className="text-text">{fecha(c.vence)}</strong>
                    </>
                  )}
                  {(tipo === 'subio' || tipo === 'bajo') && c.antes !== undefined && c.despues !== undefined && (
                    <>
                      {formatearEnUD(c.antes, c.ud)} → <strong className="text-text">{formatearEnUD(c.despues, c.ud)}</strong>
                    </>
                  )}
                  {tipo === 'nuevo' && c.despues !== undefined && <>{formatearEnUD(c.despues, c.ud)} · vence {fecha(c.vence)}</>}
                  {tipo === 'salio' && c.antes !== undefined && <>tenía {formatearEnUD(c.antes, c.ud)} · vencía {fecha(c.vence)}</>}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

export function HistorialCargas({ uid }: { uid: string }) {
  const [cargas, setCargas] = useState<CargaLotes[] | undefined>(undefined);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => suscribirCargasLotes(uid, setCargas), [uid]);

  if (cargas === undefined) return <p role="status" className="animate-pulse text-center text-sm text-text-muted">Cargando historial…</p>;
  if (cargas.length === 0) return <Card className="text-sm text-text-muted">Todavía no hay cargas de lotes. Importa el reporte de lotes y vencimientos.</Card>;

  return (
    <ul className="flex flex-col gap-2">
      {cargas.map((c) => (
        <li key={c.id} className="rounded-2xl bg-surface p-3">
          <button type="button" aria-expanded={abierta === c.id} onClick={() => setAbierta(abierta === c.id ? null : c.id)} className="flex min-h-11 w-full flex-col items-start gap-1 text-left">
            <span className="font-semibold">{fecha(c.fecha)}</span>
            <span className="text-xs text-text-muted">
              {c.lotes} lotes · {c.archivo}
            </span>
            {c.cambios && (
              <span className="text-xs text-text-muted">
                {c.cambios.vencimiento > 0 && <span className="text-critical">vencimiento cambió: {c.cambios.vencimiento} · </span>}
                subieron {c.cambios.subieron} · bajaron {c.cambios.bajaron} · nuevos {c.cambios.nuevos} · salieron {c.cambios.salieron}
                {c.cambios.vencidosRegistrados > 0 && <> · vencidos registrados {c.cambios.vencidosRegistrados}</>}
              </span>
            )}
          </button>
          {abierta === c.id && (
            <div className="mt-2 border-t border-white/5 pt-2">
              <Detalle uid={uid} id={c.id} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
