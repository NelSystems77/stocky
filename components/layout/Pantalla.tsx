import type { ReactNode } from 'react';

export function Pantalla({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      {children}
    </section>
  );
}

export function EnConstruccion({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <Pantalla titulo={titulo}>
      <div className="rounded-2xl bg-surface p-6 text-center text-sm text-text-muted">
        Esta sección llega en la {fase}.
      </div>
    </Pantalla>
  );
}
