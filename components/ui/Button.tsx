import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma';

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-accent text-bg hover:brightness-110',
  secundario: 'bg-surface-2 text-text hover:brightness-125',
  fantasma: 'text-text-muted hover:text-text hover:bg-surface-2',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

export function Button({ variante = 'primario', className = '', ...resto }: Props) {
  return (
    <button
      {...resto}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
    />
  );
}
