'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCheck, Undo2 } from 'lucide-react';
import { formatearEnUD } from '@/lib/domain/formato';
import { esMedicamento } from '@/lib/domain/lotes';
import type { AlertaLote, LoteVista, NivelVencimiento } from '@/lib/domain/vencimientos';

const fecha = (f: string) => format(parseISO(f), 'd MMM yyyy', { locale: es });

const INSIGNIA: Record<NivelVencimiento, { texto: string; clase: string }> = {
  vencido: { texto: 'Vencido', clase: 'bg-critical/15 text-critical' },
  alta: { texto: 'Prioridad alta', clase: 'bg-warning/15 text-warning' },
  media: { texto: 'Prioridad media', clase: 'bg-low/15 text-low' },
};

function cuando(dias: number): string {
  if (dias < 0) return `venció hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias < 60) return `vence en ${dias} días`;
  const meses = Math.round(dias / 30.4);
  return `vence en ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

interface Props {
  lote: LoteVista;
  /** `null` para lotes sin alerta o gestionados. */
  alerta: AlertaLote | null;
  hoy: string;
  alGestionar: () => void;
  alReabrir: () => void;
}

export function FilaLote({ lote, alerta, hoy, alGestionar, alReabrir }: Props) {
  const gestionado = lote.estado === 'gestionado';
  const dias = alerta?.diasParaVencer ?? Math.round((Date.parse(lote.vence) - Date.parse(hoy)) / 86_400_000);
  const insignia = alerta?.nivel ? INSIGNIA[alerta.nivel] : null;
  const unidades = (n: number) => formatearEnUD(n, lote.ud);

  return (
    <li className={`flex flex-col gap-2 rounded-2xl bg-surface p-3 ${gestionado ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">{lote.codigo}</span>
        {insignia && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${insignia.clase}`}>{insignia.texto}</span>}
        {alerta?.a1 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">No se consumirá a tiempo</span>}
        {gestionado && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">Gestionado</span>}
        {!esMedicamento(lote.codigo) && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">No medicamento</span>}
      </div>
      <p className="truncate text-sm">{lote.descripcion}</p>
      <p className="text-sm text-text-muted">
        Lote <span className="font-mono text-text">{lote.lote}</span> · {fecha(lote.vence)} ({cuando(dias)})
      </p>
      <p className="text-sm">
        <span className="font-semibold tabular-nums">
          {lote.proyectado ? '≈ ' : ''}
          {unidades(lote.cantidad)}
        </span>
        {lote.proyectado && <span className="text-xs text-text-muted"> · proyectado; el reporte del {fecha(lote.ultimaVez)} decía {unidades(lote.cantidadReal)}</span>}
      </p>
      {alerta?.a1 && (
        <p className="rounded-xl bg-warning/10 p-2 text-xs text-warning">
          A1: al ritmo de consumo no se agota antes de vencer; sobran ≈ {unidades(alerta.a1.excedente)}. Sugerencia: trasladar el excedente a otra unidad o priorizar su despacho.
        </p>
      )}
      {gestionado && lote.gestion && (
        <p className="text-xs text-text-muted">
          {lote.gestion.motivo} · {fecha(lote.gestion.fecha)}
        </p>
      )}
      <div className="flex justify-end">
        {gestionado ? (
          <button type="button" onClick={alReabrir} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-surface-2 px-4 text-sm font-semibold">
            <Undo2 aria-hidden className="size-4" />
            Reabrir
          </button>
        ) : (
          <button
            type="button"
            onClick={alGestionar}
            aria-label={`Gestionar lote ${lote.lote} de ${lote.descripcion}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-surface-2 px-4 text-sm font-semibold text-accent"
          >
            <CheckCheck aria-hidden className="size-4" />
            Gestionar
          </button>
        )}
      </div>
    </li>
  );
}
