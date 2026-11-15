'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { descargarReporte, type FormatoReporte } from '@/lib/reports/descarga';
import type { DatosReporte } from '@/lib/reports/tipos';

interface Props {
  /** Arma el reporte con los datos actuales; se llama al pulsar, no antes. */
  armar: () => DatosReporte | null;
  deshabilitado?: boolean;
}

/** Botones PDF y Excel. El archivo se genera en el dispositivo (funciona sin conexión). */
export function BotonesExportar({ armar, deshabilitado }: Props) {
  const { mostrar } = useToast();
  const [generando, setGenerando] = useState<FormatoReporte | null>(null);

  async function exportar(formato: FormatoReporte) {
    const datos = armar();
    if (!datos) {
      mostrar('Elige el período del reporte.', { tono: 'error' });
      return;
    }
    setGenerando(formato);
    try {
      await descargarReporte(datos, formato);
      mostrar(formato === 'pdf' ? 'PDF generado.' : 'Excel generado.', { tono: 'ok' });
    } catch {
      mostrar('No se pudo generar el archivo. Inténtalo de nuevo.', { tono: 'error' });
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variante="secundario" disabled={deshabilitado || generando !== null} onClick={() => void exportar('pdf')}>
        <FileText aria-hidden className="mr-2 inline size-4" />
        {generando === 'pdf' ? 'Generando…' : 'PDF'}
      </Button>
      <Button variante="secundario" disabled={deshabilitado || generando !== null} onClick={() => void exportar('xlsx')}>
        <FileSpreadsheet aria-hidden className="mr-2 inline size-4" />
        {generando === 'xlsx' ? 'Generando…' : 'Excel'}
      </Button>
    </div>
  );
}
