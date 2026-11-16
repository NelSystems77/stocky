'use client';

import { Camera, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import type { Existencia } from '@/lib/db/existencias';
import { coincide } from '@/lib/domain/busqueda';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { normalizarCodigo } from '@/lib/domain/codigos';
import { ETIQUETA_MOTIVO, MOTIVOS_DANADO, validarDanado, type EntradaDanado, type MotivoDanado } from '@/lib/domain/danados';
import { formatearEnUD, tieneFactor } from '@/lib/domain/formato';

interface Props {
  abierta: boolean;
  alCerrar: () => void;
  existencias: readonly Existencia[];
  alGuardar: (entrada: EntradaDanado, foto: File | null) => void;
}

const MAX_RESULTADOS = 6;

export function FormularioDanado({ abierta, alCerrar, existencias, alGuardar }: Props) {
  const [consulta, setConsulta] = useState('');
  const [producto, setProducto] = useState<Existencia | null>(null);
  const [fecha, setFecha] = useState(() => hoyCostaRica());
  const [lote, setLote] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState<MotivoDanado>('quebrado');
  const [notas, setNotas] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buscar = useDeferredValue(consulta);

  const resultados = useMemo(() => {
    if (producto || buscar.trim().length < 2) return [];
    return existencias.filter((p) => coincide(buscar, p.codigo, p.descripcion)).slice(0, MAX_RESULTADOS);
  }, [existencias, buscar, producto]);

  const n = Number(cantidad.replace(',', '.'));
  const vistaUD = producto && Number.isFinite(n) && n > 0 && tieneFactor(producto.ud) ? formatearEnUD(n, producto.ud) : null;

  function guardar() {
    const codigo = producto?.codigo ?? normalizarCodigo(consulta);
    const res = validarDanado({ fecha, codigo, lote, cantidad: n, motivo, notas });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    alGuardar(res.valor, foto);
    setConsulta('');
    setProducto(null);
    setLote('');
    setCantidad('');
    setNotas('');
    setFoto(null);
    setError(null);
    alCerrar();
  }

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Registrar dañado">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-xs text-text-muted">
          <label htmlFor="danado-producto">Producto (código o nombre)</label>
          {producto ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-2 text-text">
              <span className="min-w-0">
                <span className="block font-mono text-xs">{producto.codigo}</span>
                <span className="block truncate text-sm">{producto.descripcion}</span>
              </span>
              <button type="button" aria-label="Quitar producto" onClick={() => setProducto(null)} className="grid size-11 shrink-0 place-items-center rounded-xl">
                <X aria-hidden className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <input
                id="danado-producto"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                autoComplete="off"
                className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text"
              />
              {resultados.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {resultados.map((p) => (
                    <li key={p.codigo}>
                      <button
                        type="button"
                        onClick={() => {
                          setProducto(p);
                          setConsulta('');
                        }}
                        className="flex min-h-11 w-full flex-col rounded-xl bg-surface-2 px-3 py-1 text-left"
                      >
                        <span className="font-mono text-xs text-text-muted">{p.codigo}</span>
                        <span className="truncate text-sm text-text">{p.descripcion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p>Si no está en el último reporte, escribe el código completo.</p>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Lote
            <input value={lote} maxLength={40} onChange={(e) => setLote(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Cantidad (unidades sueltas)
          <input
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text"
          />
          {vistaUD && <span>= {vistaUD}</span>}
        </label>

        <div role="group" aria-label="Motivo" className="flex gap-2">
          {MOTIVOS_DANADO.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={motivo === m}
              onClick={() => setMotivo(m)}
              className={`min-h-11 flex-1 rounded-full px-3 text-sm transition duration-200 ${motivo === m ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
            >
              {ETIQUETA_MOTIVO[m]}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Observaciones
          <textarea value={notas} maxLength={500} rows={2} onChange={(e) => setNotas(e.target.value)} className="rounded-xl bg-surface-2 p-2 text-sm text-text" />
        </label>

        <div className="flex flex-col gap-1 text-xs text-text-muted">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-3 text-sm text-text">
            <Camera aria-hidden className="size-4" />
            {foto ? foto.name : 'Agregar foto (opcional)'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          </label>
          <p>La foto se sube cuando hay conexión.</p>
        </div>

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
