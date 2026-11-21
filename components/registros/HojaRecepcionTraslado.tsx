'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import { formatearDiferencia } from '@/lib/domain/conteo';
import { formatearEnUD, formatearNumero } from '@/lib/domain/formato';
import { aplicarRecepcion, type ItemTraslado, type RegistroTraslado } from '@/lib/domain/traslados';
import { aUnidadesBase, normalizarUD } from '@/lib/domain/unidades';

interface Props {
  registro: RegistroTraslado | null;
  /** UD y nombre según el último reporte (sin él, unidades sueltas). */
  udDe: (codigo: string) => string | undefined;
  nombre: (codigo: string) => string;
  alCerrar: () => void;
  /** `items` ya trae lo recibido de cada producto. */
  alRecibir: (t: RegistroTraslado, items: ItemTraslado[]) => void;
}

/** Recibir un traslado: por defecto llegó todo; si no, se anota cuánto llegó de cada producto y se ve la diferencia. */
export function HojaRecepcionTraslado({ registro, udDe, nombre, alCerrar, alRecibir }: Props) {
  return (
    <Hoja abierta={registro !== null} alCerrar={alCerrar} titulo="Recibir traslado">
      {registro && <Contenido key={registro.id} registro={registro} udDe={udDe} nombre={nombre} alRecibir={alRecibir} />}
    </Hoja>
  );
}

function Contenido({ registro, udDe, nombre, alRecibir }: Omit<Props, 'registro' | 'alCerrar'> & { registro: RegistroTraslado }) {
  // Lo que escribió la persona por producto, en la UD del producto; vacío = llegó completo.
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const ud = (codigo: string) => normalizarUD(udDe(codigo) ?? 'UN');
  const aBase = (codigo: string): number | null => {
    const v = valores[codigo];
    if (v === undefined || v.trim() === '') return null;
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? aUnidadesBase(n, ud(codigo)) : Number.NaN;
  };

  function recibir(completo: boolean) {
    const recibidas = new Map<string, number>();
    if (!completo) {
      for (const i of registro.items) {
        const b = aBase(i.codigo);
        if (b !== null) recibidas.set(i.codigo, b);
      }
    }
    const r = aplicarRecepcion(registro.items, recibidas);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    alRecibir(registro, r.valor);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">
        Orden <span className="font-mono text-text">{registro.ordenSAP}</span> desde {registro.unidad}. ¿Llegó todo lo que dice la orden?
      </p>
      <Button onClick={() => recibir(true)}>Llegó todo</Button>

      <div className="flex flex-col gap-2 border-t border-surface-2 pt-3">
        <p className="text-xs text-text-muted">Si no, anota cuánto llegó de cada producto (deja en blanco lo que llegó completo).</p>
        <ul className="flex flex-col gap-2">
          {registro.items.map((i) => {
            const u = udDe(i.codigo);
            const b = aBase(i.codigo);
            const dif = b === null || Number.isNaN(b) ? null : b - i.cantidad;
            return (
              <li key={i.codigo} className="flex flex-col gap-1 rounded-2xl bg-surface-2 p-3">
                <span className="font-mono text-xs text-text-muted">{i.codigo}</span>
                <span className="text-sm">{nombre(i.codigo)}</span>
                <span className="text-xs text-text-muted">Esperado: {u ? formatearEnUD(i.cantidad, u) : `${formatearNumero(i.cantidad)} u.`}</span>
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="sr-only">Llegó de {i.codigo}</span>
                  <input
                    inputMode="decimal"
                    placeholder={`Llegó (${u ?? 'unidades'})`}
                    value={valores[i.codigo] ?? ''}
                    onChange={(e) => setValores((v) => ({ ...v, [i.codigo]: e.target.value }))}
                    className="min-h-11 w-40 rounded-xl bg-surface px-3 text-right text-sm text-text tabular-nums placeholder:text-text-muted"
                  />
                  {dif !== null && dif !== 0 && <span className="font-bold text-text">{formatearDiferencia(dif, u ?? '')}</span>}
                </label>
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        )}
        <Button variante="secundario" onClick={() => recibir(false)}>
          Registrar con lo que llegó
        </Button>
      </div>
    </div>
  );
}
