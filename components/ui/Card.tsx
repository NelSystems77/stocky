import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div {...resto} className={`rounded-2xl bg-surface p-4 ${className}`} />;
}
