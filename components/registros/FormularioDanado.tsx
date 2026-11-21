'use client';

import { Camera } from 'lucide-react';
import { useState } from 'react';
import { BuscadorProducto } from './BuscadorProducto';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import type { Existencia } from '@/lib/db/existencias';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { normalizarCodigo } from '@/lib/domain/codigos';
import { ETIQUETA_MOTIVO, MOTIVOS_DANADO, validarDanado, type EntradaDanado, type MotivoDanado, type RegistroDanado } from '@/lib/domain/danados';
import { formatearEnUD, tieneFactor } from '@/lib/domain/formato';

interface Props {
  abierta: boolean;
  alCerrar: () => void;
  existencias: readonly Existencia[];
  alGuardar: (entrada: EntradaDanado, foto: File | null) => void;
  /** Si viene, el formulario edita ese dañado en lugar de crear uno nuevo. */
  inicial?: RegistroDanado;
}

export function FormularioDanado({ abierta, alCerrar, existencias, alGuardar, inicial }: Props) {
  // Al editar, el formulario se monta con los datos del registro (la pantalla le pone `key` por registro).
  const encontrado = inicial ? (existencias.find((e) => e.codigo === inicial.codigo) ?? null) : null;
  const [consulta, setConsulta] = useState(inicial && !encontrado ? inicial.codigo : '');
  const [producto, setProducto] = useState<Existencia | null>(encontrado);
  const [fecha, setFecha] = useState(() => inicial?.fecha ?? hoyCostaRica());
  const [lote, setLote] = useState(inicial?.lote ?? '');
  const [cantidad, setCantidad] = useState(inicial ? String(inicial.cantidad) : '');
  const [motivo, setMotivo] = useState<MotivoDanado>(inicial?.motivo ?? 'quebrado');
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo={inicial ? 'Editar dañado' : 'Registrar dañado'}>
      <div className="flex flex-col gap-3">
        <BuscadorProducto existencias={existencias} producto={producto} alElegir={setProducto} consulta={consulta} alCambiarConsulta={setConsulta} />

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
            {foto ? foto.name : inicial?.fotoRuta ? 'Cambiar foto (opcional)' : 'Agregar foto (opcional)'}
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
