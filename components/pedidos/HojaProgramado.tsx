'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import { hoyCostaRica } from '@/lib/domain/calendario';
import {
  ANTICIPACION_ENVIO,
  ANTICIPACION_MAX,
  ANTICIPACION_PEDIDO,
  validarProgramado,
  type ClaseProgramado,
  type Programacion,
  type Programado,
} from '@/lib/domain/pedidosEnvios';
import type { DiaSemana } from '@/lib/domain/types';

const DIAS = [
  [1, 'L', 'lunes'],
  [2, 'M', 'martes'],
  [3, 'Mi', 'miércoles'],
  [4, 'J', 'jueves'],
  [5, 'V', 'viernes'],
] as const;

/** Lo que el formulario sabe editar; el resto de periodicidades de un programado se conservan tal cual. */
interface Estado {
  nombre: string;
  clase: ClaseProgramado;
  dias: number[];
  ultimo: boolean;
  ultimoDia: number;
  anticipacion: number;
  notas: string;
  otras: Programacion[];
}

function inicial(p: Programado | null): Estado {
  const otras: Programacion[] = [];
  let dias: number[] = [];
  let ultimo = false;
  let ultimoDia = 4;
  for (const r of p?.recurrencias ?? []) {
    if (r.tipo === 'diasSemana') dias = [...dias, ...r.dias];
    else if (r.tipo === 'ultimoDiaSemana') {
      ultimo = true;
      ultimoDia = r.dia;
    } else otras.push(r);
  }
  return {
    nombre: p?.nombre ?? '',
    clase: p?.clase ?? 'envio',
    dias: [...new Set(dias)],
    ultimo,
    ultimoDia,
    anticipacion: p?.anticipacion ?? ANTICIPACION_ENVIO,
    notas: p?.notas ?? '',
    otras,
  };
}

function aRecurrencias(e: Estado): Programacion[] {
  return [
    ...(e.dias.length > 0 ? [{ tipo: 'diasSemana', dias: e.dias.toSorted((a, b) => a - b) as DiaSemana[] } as const] : []),
    ...(e.ultimo ? [{ tipo: 'ultimoDiaSemana', dia: e.ultimoDia as DiaSemana } as const] : []),
    ...e.otras,
  ];
}

interface Props {
  abierta: boolean;
  /** `null` = nuevo. */
  programado: Programado | null;
  alCerrar: () => void;
  alGuardar: (p: Programado) => void;
}

export function HojaProgramado({ abierta, programado, alCerrar, alGuardar }: Props) {
  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo={programado ? 'Editar' : 'Nuevo pedido o envío'}>
      <Formulario programado={programado} alCerrar={alCerrar} alGuardar={alGuardar} />
    </Hoja>
  );
}

function Formulario({ programado, alCerrar, alGuardar }: Omit<Props, 'abierta'>) {
  const [e, setE] = useState<Estado>(() => inicial(programado));
  const [error, setError] = useState<string | null>(null);
  const campo = 'min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-text placeholder:text-text-muted';
  const cambiar = (parcial: Partial<Estado>) => setE((a) => ({ ...a, ...parcial }));
  const alternar = (n: number) => cambiar({ dias: e.dias.includes(n) ? e.dias.filter((x) => x !== n) : [...e.dias, n] });

  function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    const recurrencias = aRecurrencias(e);
    const r = validarProgramado({ nombre: e.nombre, recurrencias, anticipacion: e.anticipacion });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    alGuardar({
      id: programado?.id ?? crypto.randomUUID(),
      clase: programado?.clase ?? e.clase,
      nombre: e.nombre.trim(),
      recurrencias,
      anticipacion: e.anticipacion,
      activo: programado?.activo ?? true,
      desde: programado?.desde ?? hoyCostaRica(),
      notas: e.notas.trim(),
    });
    alCerrar();
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {!programado && (
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1">Qué es</legend>
          <div className="flex gap-2">
            {(
              [
                ['envio', 'Envío a un puesto', ANTICIPACION_ENVIO],
                ['pedido', 'Pedido', ANTICIPACION_PEDIDO],
              ] as const
            ).map(([v, etiqueta, antic]) => (
              <button
                key={v}
                type="button"
                aria-pressed={e.clase === v}
                onClick={() => cambiar({ clase: v, anticipacion: antic })}
                className={`min-h-11 flex-1 rounded-full text-sm transition duration-200 ${e.clase === v ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Nombre
        <input autoFocus className={campo} value={e.nombre} maxLength={100} placeholder="Ej. Pedido de rayos X" onChange={(ev) => cambiar({ nombre: ev.target.value })} />
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">Cada semana, los días</legend>
        <div className="flex gap-2">
          {DIAS.map(([n, corto, largo]) => {
            const activo = e.dias.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={activo}
                aria-label={largo}
                onClick={() => alternar(n)}
                className={`size-11 rounded-full text-sm transition duration-200 ${activo ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
              >
                {corto}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 text-sm">
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-[#2DD4BF]" checked={e.ultimo} onChange={(ev) => cambiar({ ultimo: ev.target.checked })} />
          Además, el último día de la semana elegido de cada mes
        </label>
        {e.ultimo && (
          <label className="flex flex-col gap-1">
            Día
            <select className={campo} value={e.ultimoDia} onChange={(ev) => cambiar({ ultimoDia: Number(ev.target.value) })}>
              {DIAS.map(([n, , largo]) => (
                <option key={n} value={n}>
                  Último {largo} del mes
                </option>
              ))}
            </select>
          </label>
        )}
        {e.otras.length > 0 && <p className="text-xs text-text-muted">Se conservan otras periodicidades que ya tenía.</p>}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Avisar con (días hábiles de anticipación)
        <input
          type="number"
          min={0}
          max={ANTICIPACION_MAX}
          inputMode="numeric"
          className={campo}
          value={Number.isNaN(e.anticipacion) ? '' : e.anticipacion}
          onChange={(ev) => cambiar({ anticipacion: ev.target.value === '' ? Number.NaN : Number(ev.target.value) })}
        />
        <span className="text-xs text-text-muted">0 = el mismo día. No cuenta fines de semana ni feriados.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Notas (opcional)
        <textarea rows={2} maxLength={500} className="rounded-2xl bg-surface-2 p-3 text-text" value={e.notas} onChange={(ev) => cambiar({ notas: ev.target.value })} />
      </label>

      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variante="secundario" className="flex-1" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1">
          Guardar
        </Button>
      </div>
    </form>
  );
}
