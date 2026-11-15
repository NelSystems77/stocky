'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import { siguienteDiaLaborable } from '@/lib/domain/calendario';
import type { Ocurrencia } from '@/lib/domain/tareas';
import type { FechaISO } from '@/lib/domain/types';
import { useFeriados } from '@/lib/tareas/useFeriados';

const larga = (f: FechaISO) => format(parseISO(f), "EEEE d 'de' MMMM", { locale: es });

interface PosponerProps {
  ocurrencia: Ocurrencia | null;
  hoy: FechaISO;
  alCerrar: () => void;
  alElegir: (o: Ocurrencia, fecha: FechaISO) => void;
}

export function HojaPosponer({ ocurrencia, hoy, alCerrar, alElegir }: PosponerProps) {
  const feriados = useFeriados();
  const manana = siguienteDiaLaborable(hoy, feriados);
  const [fecha, setFecha] = useState<FechaISO>('');

  function elegir(f: FechaISO) {
    if (ocurrencia) alElegir(ocurrencia, f);
    setFecha('');
    alCerrar();
  }

  return (
    <Hoja abierta={ocurrencia !== null} alCerrar={alCerrar} titulo={`Posponer: ${ocurrencia?.titulo ?? ''}`}>
      <Button variante="secundario" onClick={() => elegir(manana)}>
        Próximo día laboral · <span className="first-letter:uppercase">{larga(manana)}</span>
      </Button>
      <label className="flex flex-col gap-1 text-sm">
        Elegir otra fecha
        <input
          type="date"
          min={manana}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="min-h-11 rounded-2xl bg-surface-2 px-4 text-text"
        />
      </label>
      <Button disabled={!fecha} onClick={() => elegir(fecha)}>
        Posponer a esa fecha
      </Button>
    </Hoja>
  );
}

interface DescartarProps {
  ocurrencia: Ocurrencia | null;
  alCerrar: () => void;
  alConfirmar: (o: Ocurrencia, motivo: string) => void;
}

export function HojaDescartar({ ocurrencia, alCerrar, alConfirmar }: DescartarProps) {
  const [motivo, setMotivo] = useState('');

  function confirmar() {
    if (ocurrencia) alConfirmar(ocurrencia, motivo.trim());
    setMotivo('');
    alCerrar();
  }

  return (
    <Hoja abierta={ocurrencia !== null} alCerrar={alCerrar} titulo={`Descartar: ${ocurrencia?.titulo ?? ''}`}>
      <p className="text-sm text-text-muted">Se quita de tus pendientes. Si solo no la hiciste hoy, mejor pospónla.</p>
      <label className="flex flex-col gap-1 text-sm">
        Motivo (opcional)
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={300}
          rows={2}
          className="rounded-2xl bg-surface-2 p-3 text-text"
        />
      </label>
      <div className="flex gap-3">
        <Button variante="secundario" className="flex-1" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={confirmar}>
          Descartar
        </Button>
      </div>
    </Hoja>
  );
}
