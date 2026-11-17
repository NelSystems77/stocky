'use client';

import { X } from 'lucide-react';
import { useDeferredValue, useId, useMemo } from 'react';
import type { Existencia } from '@/lib/db/existencias';
import { coincide } from '@/lib/domain/busqueda';

interface Props {
  existencias: readonly Existencia[];
  producto: Existencia | null;
  alElegir: (p: Existencia | null) => void;
  /** Texto del buscador; también sirve para escribir un código que no está en el último reporte. */
  consulta: string;
  alCambiarConsulta: (texto: string) => void;
}

const MAX_RESULTADOS = 6;

/** Busca entre los productos del último reporte importado (código o nombre) y permite elegir uno. */
export function BuscadorProducto({ existencias, producto, alElegir, consulta, alCambiarConsulta }: Props) {
  const id = useId();
  const buscar = useDeferredValue(consulta);
  const resultados = useMemo(() => {
    if (producto || buscar.trim().length < 2) return [];
    return existencias.filter((p) => coincide(buscar, p.codigo, p.descripcion)).slice(0, MAX_RESULTADOS);
  }, [existencias, buscar, producto]);

  return (
    <div className="flex flex-col gap-1 text-xs text-text-muted">
      <label htmlFor={id}>Producto (código o nombre)</label>
      {producto ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-2 text-text">
          <span className="min-w-0">
            <span className="block font-mono text-xs">{producto.codigo}</span>
            <span className="block truncate text-sm">{producto.descripcion}</span>
          </span>
          <button type="button" aria-label="Quitar producto" onClick={() => alElegir(null)} className="grid size-11 shrink-0 place-items-center rounded-xl">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            value={consulta}
            onChange={(e) => alCambiarConsulta(e.target.value)}
            autoComplete="off"
            className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text"
          />
          {resultados.length > 0 && (
            <ul className="flex flex-col gap-1">
              {resultados.map((p) => (
                <li key={p.codigo}>
                  <button
                    type="button"
                    onClick={() => {
                      alElegir(p);
                      alCambiarConsulta('');
                    }}
                    className="flex min-h-11 w-full flex-col rounded-xl bg-surface-2 px-3 py-1 text-left"
                  >
                    <span className="font-mono text-xs text-text-muted">
                      {p.codigo} · {p.ud}
                    </span>
                    <span className="truncate text-sm text-text">{p.descripcion}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p>Si no está en el último reporte, escribe el código completo.</p>
        </>
      )}
    </div>
  );
}
