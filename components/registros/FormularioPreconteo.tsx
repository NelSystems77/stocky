'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import type { Existencia } from '@/lib/db/existencias';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { normalizarCodigo } from '@/lib/domain/codigos';
import { formatearNumero } from '@/lib/domain/formato';
import { PRESENTACIONES_PRECONTEO, validarPreconteo, type EntregaValida } from '@/lib/domain/preconteo';
import { aUnidadesBase, normalizarUD } from '@/lib/domain/unidades';
import { BuscadorProducto } from './BuscadorProducto';

interface Props {
  abierta: boolean;
  alCerrar: () => void;
  existencias: readonly Existencia[];
  alGuardar: (entrega: EntregaValida) => void;
}

type Eleccion = (typeof PRESENTACIONES_PRECONTEO)[number] | 'otra';

export function FormularioPreconteo({ abierta, alCerrar, existencias, alGuardar }: Props) {
  const [consulta, setConsulta] = useState('');
  const [producto, setProducto] = useState<Existencia | null>(null);
  const [fecha, setFecha] = useState(() => hoyCostaRica());
  const [cantidad, setCantidad] = useState('');
  const [eleccion, setEleccion] = useState<Eleccion>(30);
  const [otra, setOtra] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  // La cantidad se dice en la UD del producto (cientos para CN). Sin producto elegido se toma como unidades.
  const ud = producto ? normalizarUD(producto.ud) : 'UN';
  const n = Number(cantidad.replace(',', '.'));
  const enUnidades = producto && Number.isFinite(n) && n > 0 && aUnidadesBase(n, ud) !== n ? formatearNumero(aUnidadesBase(n, ud)) : null;

  function guardar() {
    const presentacion = eleccion === 'otra' ? Number(otra) : eleccion;
    const res = validarPreconteo({ fecha, codigo: producto?.codigo ?? normalizarCodigo(consulta), cantidad: n, ud, presentacion, notas });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    alGuardar(res.valor);
    setConsulta('');
    setProducto(null);
    setCantidad('');
    setEleccion(30);
    setOtra('');
    setNotas('');
    setError(null);
    alCerrar();
  }

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Entrega para preconteo">
      <div className="flex flex-col gap-3">
        <BuscadorProducto existencias={existencias} producto={producto} alElegir={setProducto} consulta={consulta} alCambiarConsulta={setConsulta} />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Fecha de entrega
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Cantidad entregada ({producto ? producto.ud : 'UD'})
            <input
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text"
            />
          </label>
        </div>
        {enUnidades && <p className="-mt-2 text-xs text-text-muted">= {enUnidades} unidades</p>}

        <div className="flex flex-col gap-1 text-xs text-text-muted">
          <span id="presentacion-etiqueta">Se pide precontar de a</span>
          <div role="group" aria-labelledby="presentacion-etiqueta" className="flex gap-2">
            {([...PRESENTACIONES_PRECONTEO, 'otra'] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={eleccion === p}
                onClick={() => setEleccion(p)}
                className={`min-h-11 flex-1 rounded-full px-3 text-sm transition duration-200 ${eleccion === p ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
              >
                {p === 'otra' ? 'Otra' : p}
              </button>
            ))}
          </div>
          {eleccion === 'otra' && (
            <input
              inputMode="numeric"
              aria-label="Presentación (unidades por paquete)"
              placeholder="Unidades por paquete"
              value={otra}
              onChange={(e) => setOtra(e.target.value)}
              className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text"
            />
          )}
        </div>

        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Observaciones
          <textarea value={notas} maxLength={500} rows={2} onChange={(e) => setNotas(e.target.value)} className="rounded-xl bg-surface-2 p-2 text-sm text-text" />
        </label>

        {error && (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variante="fantasma" className="flex-1" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={guardar}>
            Guardar
          </Button>
        </div>
      </div>
    </Hoja>
  );
}
