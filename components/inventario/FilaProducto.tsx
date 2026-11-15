import type { Existencia } from '@/lib/db/existencias';
import { formatearEnUD, formatearNumero, tieneFactor } from '@/lib/domain/formato';
import { estadoStock } from '@/lib/domain/stock';
import { deUnidadesBase } from '@/lib/domain/unidades';

export function FilaProducto({ p }: { p: Existencia }) {
  const estado = estadoStock(p);
  const enUD = (n: number | undefined) => (n === undefined ? '—' : formatearNumero(deUnidadesBase(n, p.ud)));

  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl bg-surface p-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="font-mono text-sm">{p.codigo}</span>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted">{p.ud}</span>
          {estado === 'agotado' && (
            <span className="rounded-md bg-critical/15 px-1.5 py-0.5 text-[10px] font-semibold text-critical">Agotado</span>
          )}
          {estado === 'bajo' && (
            <span className="rounded-md bg-low/15 px-1.5 py-0.5 text-[10px] font-semibold text-low">Bajo</span>
          )}
        </p>
        <p className="truncate text-sm">{p.descripcion}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          Cuota {enUD(p.cuota)} · Mín. {enUD(p.cuotaMinima)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-lg font-semibold tabular-nums ${estado === 'agotado' ? 'text-critical' : ''}`}>
          {p.existencia === undefined ? '—' : formatearEnUD(p.existencia, p.ud)}
        </p>
        {p.existencia !== undefined && p.existencia > 0 && tieneFactor(p.ud) && (
          <p className="text-xs text-text-muted tabular-nums">{formatearNumero(p.existencia)} u</p>
        )}
      </div>
    </li>
  );
}
