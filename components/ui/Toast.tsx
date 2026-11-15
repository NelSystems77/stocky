'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Tono = 'ok' | 'error' | 'info';
interface Aviso {
  id: number;
  mensaje: string;
  tono: Tono;
  accion?: { etiqueta: string; alPulsar: () => void };
}

interface Contexto {
  mostrar: (mensaje: string, opciones?: { tono?: Tono; accion?: Aviso['accion'] }) => void;
}

const ToastContext = createContext<Contexto | null>(null);
const DURACION_MS = 6000;
const COLOR: Record<Tono, string> = { ok: 'text-ok', error: 'text-critical', info: 'text-info' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const cerrar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const mostrar = useCallback<Contexto['mostrar']>(
    (mensaje, opciones) => {
      const id = Date.now() + Math.random();
      setAvisos((a) => [...a.slice(-1), { id, mensaje, tono: opciones?.tono ?? 'info', accion: opciones?.accion }]);
      setTimeout(() => cerrar(id), DURACION_MS);
    },
    [cerrar],
  );
  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-36 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {avisos.map((a) => (
          <div key={a.id} role="status" className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm shadow-xl">
            <span className={COLOR[a.tono]}>{a.mensaje}</span>
            {a.accion && (
              <button
                type="button"
                className="min-h-11 font-semibold text-accent"
                onClick={() => {
                  a.accion?.alPulsar();
                  cerrar(a.id);
                }}
              >
                {a.accion.etiqueta}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Contexto {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  return ctx;
}
