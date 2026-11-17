'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import type { Existencia } from '@/lib/db/existencias';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { normalizarCodigo } from '@/lib/domain/codigos';
import { formatearNumero } from '@/lib/domain/formato';
import { ETIQUETA_TIPO_TRASLADO, validarTraslado, type TipoTraslado, type TrasladoValido } from '@/lib/domain/traslados';
import { aUnidadesBase, normalizarUD } from '@/lib/domain/unidades';
import { BuscadorProducto } from './BuscadorProducto';

interface Props {
  abierta: boolean;
  alCerrar: () => void;
  existencias: readonly Existencia[];
  alGuardar: (t: TrasladoValido) => void;
}

interface Linea {
  codigo: string;
  ud: string;
  cantidad: number;
  descripcion: string;
}

export function FormularioTraslado({ abierta, alCerrar, existencias, alGuardar }: Props) {
  const [orden, setOrden] = useState('');
  const [tipo, setTipo] = useState<TipoTraslado>('envio');
  const [unidad, setUnidad] = useState('');
  const [fecha, setFecha] = useState(() => hoyCostaRica());
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [consulta, setConsulta] = useState('');
  const [producto, setProducto] = useState<Existencia | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ud = producto ? normalizarUD(producto.ud) : 'UN';
  const n = Number(cantidad.replace(',', '.'));

  function agregarLinea() {
    const codigo = producto?.codigo ?? normalizarCodigo(consulta);
    if (!codigo || !Number.isFinite(n) || n <= 0) {
      setError('Elige un producto y escribe una cantidad mayor que 0.');
      return;
    }
    setLineas((l) => [...l, { codigo, ud, cantidad: n, descripcion: producto?.descripcion ?? '' }]);
    setProducto(null);
    setConsulta('');
    setCantidad('');
    setError(null);
  }

  function guardar() {
    const res = validarTraslado({ fecha, ordenSAP: orden, tipo, unidad, items: lineas.map(({ codigo, cantidad: c, ud: u }) => ({ codigo, cantidad: c, ud: u })), notas });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    alGuardar(res.valor);
    setOrden('');
    setUnidad('');
    setNotas('');
    setLineas([]);
    setProducto(null);
    setConsulta('');
    setCantidad('');
    setError(null);
    alCerrar();
  }

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Registrar traslado">
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Tipo de traslado" className="flex gap-2">
          {(['envio', 'recepcion'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`min-h-11 flex-1 rounded-full px-3 text-sm transition duration-200 ${tipo === t ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
            >
              {ETIQUETA_TIPO_TRASLADO[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Orden SAP (empieza con 50000)
            <input inputMode="numeric" value={orden} onChange={(e) => setOrden(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 font-mono text-sm text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-text-muted">
          {tipo === 'envio' ? 'Unidad de destino' : 'Unidad de origen'}
          <input
            list="unidades-traslado"
            value={unidad}
            maxLength={80}
            onChange={(e) => setUnidad(e.target.value)}
            placeholder="Hospital, área de salud u otra"
            className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text"
          />
          <datalist id="unidades-traslado">
            <option value="Hospital" />
            <option value="Área de Salud" />
          </datalist>
        </label>

        <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
          <h3 className="text-sm font-semibold">Productos ({lineas.length})</h3>
          {lineas.length > 0 && (
            <ul className="flex flex-col gap-1">
              {lineas.map((l, i) => (
                <li key={`${l.codigo}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-1 text-sm">
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-text-muted">{l.codigo}</span>
                    <span className="block truncate">{l.descripcion || 'Producto fuera del último reporte'}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold">
                    {formatearNumero(l.cantidad)} {l.ud === 'UN' ? 'u.' : l.ud}
                  </span>
                  <button type="button" aria-label={`Quitar ${l.codigo}`} onClick={() => setLineas((x) => x.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center rounded-xl">
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <BuscadorProducto existencias={existencias} producto={producto} alElegir={setProducto} consulta={consulta} alCambiarConsulta={setConsulta} />
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Cantidad ({producto ? producto.ud : 'UD'})
            <input inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="min-h-11 rounded-xl bg-surface px-3 text-sm text-text" />
            {producto && Number.isFinite(n) && n > 0 && aUnidadesBase(n, ud) !== n && <span>= {formatearNumero(aUnidadesBase(n, ud))} unidades</span>}
          </label>
          <Button variante="secundario" onClick={agregarLinea}>
            <Plus aria-hidden className="size-4" />
            Agregar producto
          </Button>
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
