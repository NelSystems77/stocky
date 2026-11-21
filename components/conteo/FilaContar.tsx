'use client';

import { useState } from 'react';
import { formatearCantidad, formatearDiferencia, leerCantidad, type FilaConteo } from '@/lib/domain/conteo';

interface Props {
  fila: FilaConteo;
  alGuardar: (contado: number, observacion: string) => void;
  alQuitar: () => void;
  alRechazar: () => void;
}

/**
 * Una fila del conteo. La persona escribe unidades sueltas (`20000`) y se ve en la UD del producto (`= 200 CN`).
 * Se guarda al salir del campo o con Enter. Con diferencia: fondo gris, diferencia en negrita y el signo `-` si falta.
 */
export function FilaContar({ fila, alGuardar, alQuitar, alRechazar }: Props) {
  // La fila se vuelve a montar (por su `key`) cuando cambia lo contado, así el campo siempre refleja lo guardado.
  const [texto, setTexto] = useState(fila.contado === null ? '' : String(fila.contado));
  const [nota, setNota] = useState(fila.observacion);
  const escrito = leerCantidad(texto);
  const conDiferencia = fila.estado === 'falta' || fila.estado === 'sobra';

  function confirmar() {
    if (texto.trim() === '') {
      if (fila.contado !== null) alQuitar();
      return;
    }
    if (escrito === null) {
      alRechazar();
      setTexto(fila.contado === null ? '' : String(fila.contado));
      return;
    }
    if (escrito !== fila.contado) alGuardar(escrito, nota);
  }

  return (
    <li className={`flex flex-col gap-2 rounded-2xl p-3 ${conDiferencia ? 'bg-diferencia' : 'bg-surface'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">{fila.codigo}</span>
            {fila.ud && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted">{fila.ud}</span>}
            {fila.fueraDeSifa && <span className="rounded-md bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-info">No está en SIFA</span>}
          </p>
          <p className="truncate text-sm">{fila.descripcion}</p>
          <p className="text-xs text-text-muted">SIFA: {fila.fueraDeSifa ? '—' : formatearCantidad(fila.sifa, fila.ud)}</p>
        </div>
        <div className="shrink-0 text-right">
          {fila.estado === 'sinContar' ? (
            <p className="text-sm text-text-muted">Sin contar</p>
          ) : (
            <p className={`text-lg tabular-nums ${conDiferencia ? 'font-bold' : 'font-semibold text-text-muted'}`}>
              {formatearDiferencia(fila.diferencia, fila.ud)}
            </p>
          )}
          {conDiferencia && <p className="text-[10px] text-text-muted">{fila.estado === 'falta' ? 'Falta' : 'Sobra'}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`contado-${fila.codigo}`}>
          Contado de {fila.codigo}, en unidades sueltas
        </label>
        <input
          id={`contado-${fila.codigo}`}
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          placeholder="Contado (sueltas)"
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="min-h-11 w-40 rounded-xl bg-surface-2 px-3 text-right tabular-nums text-text placeholder:text-text-muted"
        />
        <span className="text-sm text-text-muted tabular-nums">{escrito !== null && texto.trim() !== '' ? `= ${formatearCantidad(escrito, fila.ud)}` : ''}</span>
      </div>

      {fila.contado !== null && (
        <>
          <label className="sr-only" htmlFor={`nota-${fila.codigo}`}>
            Observación de {fila.codigo}
          </label>
          <input
            id={`nota-${fila.codigo}`}
            value={nota}
            maxLength={500}
            placeholder="Observación (opcional)"
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => {
              if (nota !== fila.observacion && fila.contado !== null) alGuardar(fila.contado, nota);
            }}
            className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text placeholder:text-text-muted"
          />
        </>
      )}
    </li>
  );
}
