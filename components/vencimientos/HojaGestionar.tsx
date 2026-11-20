'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import { formatearEnUD } from '@/lib/domain/formato';
import type { LoteVista } from '@/lib/domain/vencimientos';

/** Motivos del RF-2.4: el lote ya se atendió fuera de Stocky (trasladado, consumido o dado de baja en SIFA). */
export const MOTIVOS_GESTION = ['Trasladado a otra unidad', 'Consumido', 'Dado de baja en SIFA', 'Otro'] as const;

interface Props {
  lote: LoteVista | null;
  alCerrar: () => void;
  alConfirmar: (lote: LoteVista, motivo: string) => void;
}

export function HojaGestionar({ lote, alCerrar, alConfirmar }: Props) {
  return (
    <Hoja abierta={lote !== null} alCerrar={alCerrar} titulo="Gestionar lote">
      {lote && <Formulario lote={lote} alCerrar={alCerrar} alConfirmar={alConfirmar} />}
    </Hoja>
  );
}

function Formulario({ lote, alCerrar, alConfirmar }: { lote: LoteVista; alCerrar: () => void; alConfirmar: Props['alConfirmar'] }) {
  const [motivo, setMotivo] = useState<(typeof MOTIVOS_GESTION)[number]>(MOTIVOS_GESTION[0]);
  const [nota, setNota] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        <span className="font-mono text-text">{lote.codigo}</span> · {lote.descripcion}
        <br />
        Lote <span className="font-mono text-text">{lote.lote}</span> · {formatearEnUD(lote.cantidad, lote.ud)}
      </p>
      <p className="text-sm text-text-muted">Un lote gestionado deja de alertar. El trámite real se hace en SIFA.</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">¿Qué se hizo?</legend>
        {MOTIVOS_GESTION.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={motivo === m}
            onClick={() => setMotivo(m)}
            className={`min-h-11 rounded-2xl px-4 text-left text-sm transition duration-200 ${motivo === m ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text'}`}
          >
            {m}
          </button>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Nota (opcional)
        <input
          className="min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-text placeholder:text-text-muted"
          value={nota}
          maxLength={150}
          placeholder="Ej. traslado a la farmacia, orden 50000…"
          onChange={(e) => setNota(e.target.value)}
        />
      </label>
      <div className="flex gap-3">
        <Button type="button" variante="secundario" className="flex-1" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={() => {
            alConfirmar(lote, nota.trim() ? `${motivo}: ${nota.trim()}` : motivo);
            alCerrar();
          }}
        >
          Gestionar
        </Button>
      </div>
    </div>
  );
}
