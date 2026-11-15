'use client';

import { useState } from 'react';
import { Calendario } from '@/components/agenda/Calendario';
import { MisTareas } from '@/components/agenda/MisTareas';
import { Pantalla } from '@/components/layout/Pantalla';
import { HojaTarea } from '@/components/tareas/HojaTarea';
import { useToast } from '@/components/ui/Toast';
import { guardarTarea } from '@/lib/db/tareas';
import type { Tarea } from '@/lib/domain/tareas';
import { useAgenda } from '@/lib/tareas/useAgenda';

type Pestana = 'calendario' | 'tareas';

export default function Agenda() {
  const { uid, tareas, cumplimientos, cargando } = useAgenda();
  const { mostrar } = useToast();
  const [pestana, setPestana] = useState<Pestana>('calendario');
  const [editando, setEditando] = useState<Tarea | null>(null);
  const [abierta, setAbierta] = useState(false);

  function guardar(t: Tarea, mensaje = 'Tarea guardada.') {
    if (!uid) return;
    void guardarTarea(uid, t).catch(() => mostrar('No se pudo guardar la tarea.', { tono: 'error' }));
    mostrar(mensaje, { tono: 'ok' });
  }

  const abrir = (t: Tarea | null) => {
    setEditando(t);
    setAbierta(true);
  };

  return (
    <Pantalla titulo="Agenda">
      <div role="tablist" aria-label="Secciones de la agenda" className="flex gap-2">
        {(
          [
            ['calendario', 'Calendario'],
            ['tareas', 'Mis tareas'],
          ] as const
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`min-h-11 flex-1 rounded-2xl text-sm transition duration-200 ${pestana === id ? 'bg-surface-2 font-semibold text-accent' : 'text-text-muted'}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <p role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando agenda…
        </p>
      ) : pestana === 'calendario' ? (
        <Calendario tareas={tareas} cumplimientos={cumplimientos} />
      ) : (
        <MisTareas
          tareas={tareas}
          alNueva={() => abrir(null)}
          alEditar={abrir}
          alAlternar={(t) => guardar({ ...t, activa: !t.activa }, t.activa ? 'Tarea en pausa.' : 'Tarea reanudada.')}
        />
      )}

      <HojaTarea abierta={abierta} tarea={editando} alCerrar={() => setAbierta(false)} alGuardar={(t) => guardar(t)} />
    </Pantalla>
  );
}
