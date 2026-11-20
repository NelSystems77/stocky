'use client';

import { PackageCheck, Pause, Play, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { describirProgramado, type Programado } from '@/lib/domain/pedidosEnvios';

interface Props {
  programados: Programado[];
  alNuevo: () => void;
  alEditar: (p: Programado) => void;
  alAlternar: (p: Programado) => void;
  alSembrar: () => void;
}

export function ListaProgramados({ programados, alNuevo, alEditar, alAlternar, alSembrar }: Props) {
  const lista = programados.toSorted(
    (a, b) => Number(b.activo) - Number(a.activo) || a.clase.localeCompare(b.clase) || a.nombre.localeCompare(b.nombre),
  );
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={alNuevo} className="self-start">
        <Plus aria-hidden className="size-4" />
        Nuevo pedido o envío
      </Button>
      {lista.length === 0 && (
        <Card className="flex flex-col items-start gap-3 text-sm">
          <p className="text-text-muted">
            Aún no hay pedidos ni envíos. Puedes empezar con los envíos a R, C, V y Z, el pedido semanal del 772 y el de sueros.
          </p>
          <Button variante="secundario" onClick={alSembrar}>
            Cargar pedidos y envíos
          </Button>
        </Card>
      )}
      <ul className="flex flex-col gap-2">
        {lista.map((p) => {
          const Icono = p.clase === 'envio' ? Send : PackageCheck;
          return (
            <li key={p.id} className={`flex items-center gap-1 rounded-2xl bg-surface pr-1 ${p.activo ? '' : 'opacity-60'}`}>
              <button type="button" onClick={() => alEditar(p)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left">
                <Icono aria-hidden className="size-5 shrink-0 text-text-muted" />
                <span className="min-w-0">
                  <span className="block truncate">{p.nombre}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {p.clase === 'envio' ? 'Envío' : 'Pedido'} · {describirProgramado(p)} · avisa {p.anticipacion} {p.anticipacion === 1 ? 'día hábil' : 'días hábiles'} antes
                    {p.activo ? '' : ' · En pausa'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => alAlternar(p)}
                aria-label={p.activo ? `Pausar: ${p.nombre}` : `Reanudar: ${p.nombre}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-2"
              >
                {p.activo ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
