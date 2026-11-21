'use client';

import { useState } from 'react';
import { BuscadorProducto } from '@/components/registros/BuscadorProducto';
import { Button } from '@/components/ui/Button';
import type { Existencia } from '@/lib/db/existencias';
import { validarAgotadoManual, type AgotadoManualValido, type RegistroAgotado } from '@/lib/domain/agotados';
import type { FechaISO } from '@/lib/domain/types';

interface Props {
  existencias: readonly Existencia[];
  registros: readonly RegistroAgotado[];
  hoy: FechaISO;
  alGuardar: (v: AgotadoManualValido) => void;
}

/** Alta manual de un agotado (RF-3.4): producto, fecha de agotamiento y observación. Queda abierto hasta el próximo reporte con existencia. */
export function FormularioAgotadoManual({ existencias, registros, hoy, alGuardar }: Props) {
  const [producto, setProducto] = useState<Existencia | null>(null);
  const [consulta, setConsulta] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const r = validarAgotadoManual({ codigo: producto?.codigo ?? consulta, fechaAgotado: fecha, notas }, registros, hoy);
    if (!r.ok) return setError(r.error);
    alGuardar(r.valor);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 text-xs text-text-muted">
      <p>Para un producto que se agotó y todavía no aparece en el reporte. Se cierra solo cuando un reporte posterior traiga existencia.</p>
      <BuscadorProducto existencias={existencias} producto={producto} alElegir={setProducto} consulta={consulta} alCambiarConsulta={setConsulta} />
      <label className="flex flex-col gap-1">
        Fecha de agotamiento
        <input
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => setFecha(e.target.value)}
          className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text"
        />
      </label>
      <label className="flex flex-col gap-1">
        Observaciones (opcional)
        <textarea value={notas} maxLength={500} rows={2} onChange={(e) => setNotas(e.target.value)} className="w-full rounded-xl bg-surface-2 p-2 text-sm text-text" />
      </label>
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
      <Button type="submit">Registrar agotado</Button>
    </form>
  );
}
