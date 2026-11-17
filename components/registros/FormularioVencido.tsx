'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import type { Existencia } from '@/lib/db/existencias';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { normalizarCodigo } from '@/lib/domain/codigos';
import { formatearEnUD, tieneFactor } from '@/lib/domain/formato';
import { validarVencido, type EntradaVencido } from '@/lib/domain/vencidos';
import { BuscadorProducto } from './BuscadorProducto';

interface Props {
  abierta: boolean;
  alCerrar: () => void;
  existencias: readonly Existencia[];
  alGuardar: (entrada: EntradaVencido) => void;
}

export function FormularioVencido({ abierta, alCerrar, existencias, alGuardar }: Props) {
  const [consulta, setConsulta] = useState('');
  const [producto, setProducto] = useState<Existencia | null>(null);
  const [fecha, setFecha] = useState(() => hoyCostaRica());
  const [vence, setVence] = useState('');
  const [lote, setLote] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  const n = Number(cantidad.replace(',', '.'));
  const vistaUD = producto && Number.isFinite(n) && n > 0 && tieneFactor(producto.ud) ? formatearEnUD(n, producto.ud) : null;

  function guardar() {
    const res = validarVencido({ fecha, codigo: producto?.codigo ?? normalizarCodigo(consulta), lote, fechaVencimiento: vence, cantidad: n, notas });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    alGuardar(res.valor);
    setConsulta('');
    setProducto(null);
    setVence('');
    setLote('');
    setCantidad('');
    setNotas('');
    setError(null);
    alCerrar();
  }

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Registrar vencido">
      <div className="flex flex-col gap-3">
        <BuscadorProducto existencias={existencias} producto={producto} alElegir={setProducto} consulta={consulta} alCambiarConsulta={setConsulta} />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Lote
            <input value={lote} maxLength={40} onChange={(e) => setLote(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Venció el
            <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Fecha de registro
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Cantidad (unidades sueltas)
            <input inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
            {vistaUD && <span>= {vistaUD}</span>}
          </label>
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
