'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  abierta: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
}

/** Hoja inferior en celular y diálogo centrado en PC. Usa `<dialog>`: foco atrapado y Escape incluidos. */
export function Hoja({ abierta, alCerrar, titulo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface p-5 text-text backdrop:bg-black/60 lg:m-auto lg:max-w-lg lg:rounded-3xl"
    >
      {abierta && (
        <div className="flex flex-col gap-4">
          <h2 id={idTitulo} className="text-lg font-semibold">
            {titulo}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
