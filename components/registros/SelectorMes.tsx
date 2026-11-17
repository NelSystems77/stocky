import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** `YYYY-MM` desplazado `delta` meses. */
export function cambiarMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const nombreMes = (mes: string) => format(parseISO(`${mes}-01`), 'MMMM yyyy', { locale: es });

interface Props {
  mes: string;
  /** Último mes al que se puede avanzar (el actual). */
  mesActual: string;
  alCambiar: (mes: string) => void;
}

export function SelectorMes({ mes, mesActual, alCambiar }: Props) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Mes">
      <button type="button" aria-label="Mes anterior" onClick={() => alCambiar(cambiarMes(mes, -1))} className="grid size-11 place-items-center rounded-xl bg-surface-2">
        ‹
      </button>
      <span className="min-w-32 text-center text-sm font-semibold capitalize">{nombreMes(mes)}</span>
      <button
        type="button"
        aria-label="Mes siguiente"
        disabled={mes >= mesActual}
        onClick={() => alCambiar(cambiarMes(mes, 1))}
        className="grid size-11 place-items-center rounded-xl bg-surface-2 disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}
