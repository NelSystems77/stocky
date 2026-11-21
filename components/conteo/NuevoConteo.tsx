'use client';

import { X } from 'lucide-react';
import { useDeferredValue, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Existencia } from '@/lib/db/existencias';
import { coincide } from '@/lib/domain/busqueda';

interface Props {
  existencias: readonly Existencia[];
  /** `codigos` solo cuando el alcance es una lista. */
  alIniciar: (alcance: 'todos' | 'lista', codigos?: ReadonlySet<string>) => void;
}

const MAX_RESULTADOS = 8;

/** Contenido de la hoja «Nuevo conteo»: contar todos los productos o una lista que se arma buscando. */
export function NuevoConteo({ existencias, alIniciar }: Props) {
  const idBuscar = useId();
  const [alcance, setAlcance] = useState<'todos' | 'lista'>('todos');
  const [consulta, setConsulta] = useState('');
  const [elegidos, setElegidos] = useState<Existencia[]>([]);
  const buscar = useDeferredValue(consulta);

  const resultados = useMemo(() => {
    if (buscar.trim().length < 2) return [];
    const ya = new Set(elegidos.map((e) => e.codigo));
    return existencias.filter((p) => !ya.has(p.codigo) && coincide(buscar, p.codigo, p.descripcion)).slice(0, MAX_RESULTADOS);
  }, [existencias, buscar, elegidos]);

  const puedeIniciar = alcance === 'todos' ? existencias.length > 0 : elegidos.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Al iniciar, Stocky congela la existencia que dice SIFA (del último reporte importado). Si importas otro reporte después, este conteo no cambia.
      </p>

      <div role="group" aria-label="Qué contar" className="grid grid-cols-2 gap-2">
        {(
          [
            ['todos', `Todos los productos (${existencias.length})`],
            ['lista', 'Una lista que elijo'],
          ] as const
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            aria-pressed={alcance === id}
            onClick={() => setAlcance(id)}
            className={`min-h-11 rounded-2xl px-3 text-sm transition duration-200 ${alcance === id ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {alcance === 'lista' && (
        <div className="flex flex-col gap-2">
          <label htmlFor={idBuscar} className="text-xs text-text-muted">
            Agregar productos (código o nombre)
          </label>
          <input
            id={idBuscar}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
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
                      setElegidos((l) => [...l, p]);
                      setConsulta('');
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
          {elegidos.length > 0 && (
            <ul aria-label="Productos de la lista" className="flex flex-wrap gap-2">
              {elegidos.map((p) => (
                <li key={p.codigo} className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-xs">
                  <span className="font-mono">{p.codigo}</span>
                  <button
                    type="button"
                    aria-label={`Quitar ${p.codigo}`}
                    onClick={() => setElegidos((l) => l.filter((x) => x.codigo !== p.codigo))}
                    className="grid size-8 place-items-center rounded-full text-text-muted"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button
        disabled={!puedeIniciar}
        onClick={() => alIniciar(alcance, alcance === 'lista' ? new Set(elegidos.map((e) => e.codigo)) : undefined)}
      >
        {alcance === 'todos' ? 'Iniciar conteo' : `Iniciar con ${elegidos.length} producto${elegidos.length === 1 ? '' : 's'}`}
      </Button>
    </div>
  );
}
