import Link from 'next/link';
import type { ComponentType } from 'react';

export type Tono = 'critical' | 'warning' | 'low' | 'info' | 'ok';

const COLOR: Record<Tono, string> = {
  critical: 'text-critical',
  warning: 'text-warning',
  low: 'text-low',
  info: 'text-info',
  ok: 'text-ok',
};

interface Props {
  href: string;
  etiqueta: string;
  /** `null` = aún no hay datos (se muestra un guion y sin color de alerta). */
  valor: number | null;
  tono: Tono;
  icono: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** Línea opcional bajo la etiqueta (p. ej. «al día (hace 3 días)»). */
  detalle?: string;
}

export function ChipAlerta({ href, etiqueta, valor, tono, icono: Icono, detalle }: Props) {
  const activo = valor !== null && valor > 0;
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-col gap-1 rounded-2xl bg-surface-2 p-3 transition duration-200 hover:brightness-125"
    >
      <Icono aria-hidden className={`size-5 ${activo ? COLOR[tono] : 'text-text-muted'}`} />
      <span className={`text-3xl font-semibold leading-none ${activo ? COLOR[tono] : 'text-text-muted'}`}>
        {valor ?? '—'}
      </span>
      <span className="text-xs text-text-muted">{etiqueta}</span>
      {detalle && <span className="text-[11px] text-text-muted">{detalle}</span>}
    </Link>
  );
}
