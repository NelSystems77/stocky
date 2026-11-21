'use client';

import { useMemo, useState } from 'react';
import { formatearNumero } from '@/lib/domain/formato';
import { ETIQUETA_OMITIDO, type MotivoOmitido, type OmitidoAldi } from '@/lib/domain/pedidoAldi';
import { deUnidadesBase } from '@/lib/domain/unidades';

const PAGINA = 50;
const ORDEN: MotivoOmitido[] = ['sinCuota', 'yaCubierto', 'sinMovimiento', 'sinExistencia'];

const EXPLICACION: Record<MotivoOmitido, string> = {
  sinCuota: 'SIFA los trae sin cuota o con cuota 0: no hay un tope hasta el cual reponer, así que no entran al pedido.',
  yaCubierto: 'Su existencia ya llega al objetivo (la cuota o el consumo × factor): no hace falta pedir.',
  sinMovimiento: 'Tienen consumo cargado pero en cero: no se mueven, no se pide.',
  sinExistencia: 'Tienen cuota pero el reporte no trae su existencia: no se pide a ciegas.',
};

/** Lista desplegable de lo que no entró al pedido, por motivo, para comprobar que debe quedar fuera. */
export function OmitidosAldi({ omitidos }: { omitidos: readonly OmitidoAldi[] }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoOmitido>('sinCuota');
  const [visibles, setVisibles] = useState(PAGINA);

  const cuentas = useMemo(() => {
    const c: Record<MotivoOmitido, number> = { sinCuota: 0, yaCubierto: 0, sinMovimiento: 0, sinExistencia: 0 };
    for (const o of omitidos) c[o.motivo]++;
    return c;
  }, [omitidos]);
  const lista = useMemo(() => omitidos.filter((o) => o.motivo === motivo), [omitidos, motivo]);

  if (omitidos.length === 0) return null;
  const chips = ORDEN.filter((m) => cuentas[m] > 0);
  const actual = cuentas[motivo] > 0 ? motivo : (chips[0] ?? motivo);

  return (
    <section aria-label="Productos omitidos" className="rounded-2xl bg-surface p-3">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-semibold"
      >
        <span>Ver los {omitidos.length} productos que no entraron</span>
        <span aria-hidden className="text-text-muted">
          {abierto ? '▲' : '▼'}
        </span>
      </button>

      {abierto && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Motivo">
            {chips.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={actual === m}
                onClick={() => {
                  setMotivo(m);
                  setVisibles(PAGINA);
                }}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm transition duration-200 ${actual === m ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
              >
                {ETIQUETA_OMITIDO[m]} ({cuentas[m]})
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted">{EXPLICACION[actual]}</p>
          <ul className="flex flex-col gap-1">
            {(actual === motivo ? lista : omitidos.filter((o) => o.motivo === actual)).slice(0, visibles).map((o) => (
              <li key={o.codigo} className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs">{o.codigo}</span>
                  {o.ud && <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">{o.ud}</span>}
                </span>
                <span className="truncate text-sm">{o.descripcion}</span>
                <span className="text-xs text-text-muted">
                  Cuota {o.cuota === undefined ? '—' : formatearNumero(deUnidadesBase(o.cuota, o.ud))} · hay {o.existencia === undefined ? '—' : formatearNumero(deUnidadesBase(o.existencia, o.ud))}
                </span>
              </li>
            ))}
          </ul>
          {cuentas[actual] > visibles && (
            <button type="button" onClick={() => setVisibles((v) => v + PAGINA)} className="min-h-11 rounded-2xl bg-surface-2 text-sm font-semibold">
              Mostrar más ({cuentas[actual] - visibles})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
