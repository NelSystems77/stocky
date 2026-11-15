'use client';

import { Bot, X } from 'lucide-react';
import { useState } from 'react';

/** Botón flotante de Chango IA. El panel de chat llega en la fase de IA; por ahora solo avisa. */
export function BotonChango() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      {abierto && (
        <div
          role="dialog"
          aria-label="Chango IA"
          className="fixed right-4 bottom-36 z-40 w-72 rounded-2xl bg-surface-2 p-4 shadow-xl lg:bottom-24"
        >
          <p className="font-semibold text-accent">Chango IA</p>
          <p className="mt-1 text-sm text-text-muted">Chango todavía se está preparando. Pronto podrás preguntarle por tu inventario.</p>
        </div>
      )}
      <button
        type="button"
        aria-label={abierto ? 'Cerrar Chango IA' : 'Abrir Chango IA'}
        onClick={() => setAbierto((v) => !v)}
        className="fixed right-4 bottom-20 z-40 grid size-14 place-items-center rounded-full bg-accent text-bg shadow-lg transition duration-200 hover:brightness-110 lg:bottom-6"
      >
        {abierto ? <X aria-hidden className="size-6" /> : <Bot aria-hidden className="size-6" />}
      </button>
    </>
  );
}
