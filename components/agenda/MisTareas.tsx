'use client';

import { Pause, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { describirRecurrencia } from '@/lib/domain/recurrenciaTexto';
import type { Tarea } from '@/lib/domain/tareas';

interface Props {
  tareas: Tarea[];
  alNueva: () => void;
  alEditar: (t: Tarea) => void;
  alAlternar: (t: Tarea) => void;
}

export function MisTareas({ tareas, alNueva, alEditar, alAlternar }: Props) {
  const lista = tareas.toSorted((a, b) => Number(b.activa) - Number(a.activa) || a.titulo.localeCompare(b.titulo));
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={alNueva} className="self-start">
        <Plus aria-hidden className="size-4" />
        Nueva tarea
      </Button>
      {lista.length === 0 && <Card className="text-sm text-text-muted">Aún no tienes tareas.</Card>}
      <ul className="flex flex-col gap-2">
        {lista.map((t) => (
          <li key={t.id} className={`flex items-center gap-1 rounded-2xl bg-surface pr-1 ${t.activa ? '' : 'opacity-60'}`}>
            <button type="button" onClick={() => alEditar(t)} className="min-h-14 min-w-0 flex-1 px-4 py-2 text-left">
              <p className="truncate">{t.titulo}</p>
              <p className="truncate text-xs text-text-muted">
                {describirRecurrencia(t.recurrencia)}
                {t.hora ? ` · ${t.hora}` : ''}
                {t.activa ? '' : ' · En pausa'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => alAlternar(t)}
              aria-label={t.activa ? `Pausar: ${t.titulo}` : `Reanudar: ${t.titulo}`}
              className="grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-2"
            >
              {t.activa ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
