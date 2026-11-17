'use client';

import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PanelChango } from './PanelChango';

/** Botón flotante de Chango IA; abre el panel de chat (hoja inferior en celular, panel lateral en PC). */
export function BotonChango() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  return (
    <>
      {abierto && <PanelChango alCerrar={() => setAbierto(false)} />}
      {!abierto && (
        <button
          type="button"
          aria-label="Abrir Chango IA"
          aria-expanded={false}
          onClick={() => setAbierto(true)}
          className="fixed right-4 bottom-20 z-50 grid size-14 place-items-center rounded-full bg-accent text-bg shadow-lg transition duration-200 hover:brightness-110 lg:bottom-6"
        >
          <Bot aria-hidden className="size-6" />
        </button>
      )}
    </>
  );
}
