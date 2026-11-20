'use client';

import { useState } from 'react';
import { Calendario } from '@/components/agenda/Calendario';
import { MisTareas } from '@/components/agenda/MisTareas';
import { HojaProgramado } from '@/components/pedidos/HojaProgramado';
import { ListaProgramados } from '@/components/pedidos/ListaProgramados';
import { Pantalla } from '@/components/layout/Pantalla';
import { HojaTarea } from '@/components/tareas/HojaTarea';
import { useToast } from '@/components/ui/Toast';
import { sembrarProgramados } from '@/lib/db/pedidosEnvios';
import { guardarTarea } from '@/lib/db/tareas';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { programadosSugeridos, type Programado } from '@/lib/domain/pedidosEnvios';
import type { Tarea } from '@/lib/domain/tareas';
import { useGuardarProgramado, usePedidosEnvios } from '@/lib/pedidos/usePedidosEnvios';
import { useAgenda } from '@/lib/tareas/useAgenda';

type Pestana = 'calendario' | 'tareas' | 'pedidos';

export default function Agenda() {
  const { uid, tareas, cumplimientos, cargando } = useAgenda();
  const { mostrar } = useToast();
  const [pestana, setPestana] = useState<Pestana>('calendario');
  const [editando, setEditando] = useState<Tarea | null>(null);
  const [abierta, setAbierta] = useState(false);
  const pe = usePedidosEnvios();
  const guardarProg = useGuardarProgramado(uid);
  const [editandoProg, setEditandoProg] = useState<Programado | null>(null);
  const [abiertaProg, setAbiertaProg] = useState(false);

  function guardar(t: Tarea, mensaje = 'Tarea guardada.') {
    if (!uid) return;
    void guardarTarea(uid, t).catch(() => mostrar('No se pudo guardar la tarea.', { tono: 'error' }));
    mostrar(mensaje, { tono: 'ok' });
  }

  const abrir = (t: Tarea | null) => {
    setEditando(t);
    setAbierta(true);
  };

  const abrirProg = (p: Programado | null) => {
    setEditandoProg(p);
    setAbiertaProg(true);
  };

  function sembrarProg() {
    if (!uid) return;
    void sembrarProgramados(uid, programadosSugeridos(hoyCostaRica())).catch(() => mostrar('No se pudieron cargar.', { tono: 'error' }));
    mostrar('Pedidos y envíos cargados.', { tono: 'ok' });
  }

  const pestanas: readonly (readonly [Pestana, string])[] = [
    ['calendario', 'Calendario'],
    ['tareas', 'Mis tareas'],
    ...(pe.aplica ? ([['pedidos', 'Pedidos y envíos']] as const) : []),
  ];

  return (
    <Pantalla titulo="Agenda">
      <div role="tablist" aria-label="Secciones de la agenda" className="flex gap-2">
        {pestanas.map(([id, etiqueta]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`min-h-11 flex-1 rounded-2xl px-1 text-sm transition duration-200 ${pestana === id ? 'bg-surface-2 font-semibold text-accent' : 'text-text-muted'}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {cargando || pe.cargando ? (
        <p role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando agenda…
        </p>
      ) : pestana === 'calendario' ? (
        <Calendario tareas={tareas} cumplimientos={cumplimientos} programados={pe.programados} seguimientos={pe.seguimientos} />
      ) : pestana === 'pedidos' ? (
        <ListaProgramados
          programados={pe.programados}
          alNuevo={() => abrirProg(null)}
          alEditar={abrirProg}
          alAlternar={(p) => guardarProg({ ...p, activo: !p.activo }, p.activo ? 'En pausa.' : 'Reanudado.')}
          alSembrar={sembrarProg}
        />
      ) : (
        <MisTareas
          tareas={tareas}
          alNueva={() => abrir(null)}
          alEditar={abrir}
          alAlternar={(t) => guardar({ ...t, activa: !t.activa }, t.activa ? 'Tarea en pausa.' : 'Tarea reanudada.')}
        />
      )}

      <HojaProgramado abierta={abiertaProg} programado={editandoProg} alCerrar={() => setAbiertaProg(false)} alGuardar={(p) => guardarProg(p)} />
      <HojaTarea abierta={abierta} tarea={editando} alCerrar={() => setAbierta(false)} alGuardar={(t) => guardar(t)} />
    </Pantalla>
  );
}
