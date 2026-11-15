'use client';

import { CheckCircle2, Plus, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { guardarTarea, sembrarTareas } from '@/lib/db/tareas';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { vistaHoy, type Ocurrencia, type Tarea } from '@/lib/domain/tareas';
import { tareasSugeridas } from '@/lib/domain/tareasSugeridas';
import { useAcciones } from '@/lib/tareas/useAcciones';
import { FERIADOS, useAgenda } from '@/lib/tareas/useAgenda';
import { FilaTarea } from './FilaTarea';
import { HojaDescartar, HojaPosponer } from './HojasAccion';
import { HojaTarea } from './HojaTarea';

export function SeccionTareasHoy() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const { uid, tareas, cumplimientos, cargando } = useAgenda();
  const acciones = useAcciones(uid, cumplimientos);
  const hoy = hoyCostaRica();
  const unidad = estado.fase === 'listo' ? estado.sesion.unidad : null;

  const [posponiendo, setPosponiendo] = useState<Ocurrencia | null>(null);
  const [descartando, setDescartando] = useState<Ocurrencia | null>(null);
  const [creando, setCreando] = useState(false);

  const vista = useMemo(() => vistaHoy(tareas, cumplimientos, hoy, FERIADOS), [tareas, cumplimientos, hoy]);
  const sugeridas = tareasSugeridas(unidad, hoy);

  function guardar(t: Tarea) {
    if (!uid) return;
    void guardarTarea(uid, t).catch(() => mostrar('No se pudo guardar la tarea.', { tono: 'error' }));
    mostrar('Tarea guardada.', { tono: 'ok' });
  }

  function sembrar() {
    if (!uid) return;
    void sembrarTareas(uid, sugeridas).catch(() => mostrar('No se pudieron cargar las tareas.', { tono: 'error' }));
    mostrar('Tareas sugeridas cargadas. Puedes editarlas o pausarlas en Agenda.', { tono: 'ok' });
  }

  const fila = (o: Ocurrencia) => (
    <FilaTarea
      key={`${o.tareaId}_${o.fechaOrigen}`}
      o={o}
      hoy={hoy}
      alHecha={() => acciones.hecha(o)}
      alPosponer={() => setPosponiendo(o)}
      alDescartar={() => setDescartando(o)}
    />
  );

  return (
    <>
      <section aria-label="Tareas de hoy" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tareas de hoy</h2>
          <button
            type="button"
            onClick={() => setCreando(true)}
            aria-label="Nueva tarea"
            className="grid size-11 place-items-center rounded-full bg-surface-2 text-accent"
          >
            <Plus aria-hidden className="size-5" />
          </button>
        </div>

        {cargando && (
          <Card role="status" className="animate-pulse text-sm text-text-muted">
            Cargando tareas…
          </Card>
        )}

        {!cargando && tareas.length === 0 && (
          <Card className="flex flex-col items-start gap-3">
            <p className="font-semibold">Aún no tienes tareas</p>
            <p className="text-sm text-text-muted">
              {sugeridas.length > 0
                ? 'Puedes empezar con las tareas del día a día del almacén (temperatura, preconteo, carga de reportes…) y ajustarlas después.'
                : 'Crea tu primera tarea con el botón +.'}
            </p>
            <div className="flex gap-2">
              {sugeridas.length > 0 && <Button onClick={sembrar}>Cargar tareas sugeridas</Button>}
              <Button variante="secundario" onClick={() => setCreando(true)}>
                Crear tarea
              </Button>
            </div>
          </Card>
        )}

        {!cargando && tareas.length > 0 && vista.hoy.length === 0 && (
          <Card className="flex items-center gap-2 text-sm text-text-muted">
            <CheckCircle2 aria-hidden className="size-5 text-ok" />
            No tienes tareas pendientes para hoy.
          </Card>
        )}

        {vista.hoy.length > 0 && <ul className="flex flex-col gap-2">{vista.hoy.map(fila)}</ul>}

        {vista.hechasHoy.length > 0 && (
          <details className="rounded-2xl bg-surface p-3 text-sm">
            <summary className="min-h-8 cursor-pointer text-text-muted">Hechas hoy ({vista.hechasHoy.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {vista.hechasHoy.map((o) => (
                <li key={`${o.tareaId}_${o.fechaOrigen}`} className="flex items-center justify-between gap-2">
                  <span className="truncate text-text-muted line-through">{o.titulo}</span>
                  <button
                    type="button"
                    onClick={() => acciones.reabrir(o)}
                    aria-label={`Reabrir: ${o.titulo}`}
                    className="grid size-11 place-items-center rounded-full text-text-muted hover:bg-surface-2"
                  >
                    <Undo2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {vista.atrasadas.length > 0 && (
        <section aria-label="Pendientes de días anteriores" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-warning">Pendientes de días anteriores ({vista.atrasadas.length})</h2>
          <ul className="flex flex-col gap-2">{vista.atrasadas.map(fila)}</ul>
        </section>
      )}

      <HojaPosponer ocurrencia={posponiendo} hoy={hoy} alCerrar={() => setPosponiendo(null)} alElegir={acciones.posponer} />
      <HojaDescartar ocurrencia={descartando} alCerrar={() => setDescartando(null)} alConfirmar={acciones.descartar} />
      <HojaTarea abierta={creando} tarea={null} alCerrar={() => setCreando(false)} alGuardar={guardar} />
    </>
  );
}
