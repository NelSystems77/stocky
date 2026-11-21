'use client';

import { Download, ExternalLink, FileSpreadsheet, FileText, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import {
  compartirArchivo,
  decidirEntrega,
  descargarDesdeUrl,
  generarArchivo,
  puedeCompartirArchivo,
  type ArchivoReporte,
  type FormatoReporte,
} from '@/lib/reports/descarga';
import type { DatosReporte, DatosResumen } from '@/lib/reports/tipos';

interface Props {
  /** Arma el reporte con los datos actuales; se llama al pulsar, no antes. */
  armar: () => DatosReporte | DatosResumen | null;
  deshabilitado?: boolean;
}

/** Un archivo ya generado y su enlace local (para abrirlo o descargarlo). */
interface Listo {
  archivo: ArchivoReporte;
  url: string;
  compartir: boolean;
}

/**
 * Botones PDF y Excel. El archivo se genera en el dispositivo (funciona sin conexión). Al terminar quedan en pantalla
 * «Guardar / Compartir», «Abrir» y «Descargar»: en el celular cada uno se toca con un gesto directo, que es lo que
 * Safari exige para guardar o abrir un archivo. En computadora, además, se descarga solo.
 */
export function BotonesExportar({ armar, deshabilitado }: Props) {
  const { mostrar } = useToast();
  const [generando, setGenerando] = useState<FormatoReporte | null>(null);
  const [listo, setListo] = useState<Listo | null>(null);

  // El enlace local se libera al cambiar de archivo o al salir de la pantalla.
  useEffect(() => () => (listo ? URL.revokeObjectURL(listo.url) : undefined), [listo]);

  async function exportar(formato: FormatoReporte) {
    const datos = armar();
    if (!datos) {
      mostrar('Elige el período del reporte.', { tono: 'error' });
      return;
    }
    setGenerando(formato);
    try {
      const archivo = await generarArchivo(datos, formato);
      const url = URL.createObjectURL(archivo.blob);
      const entrega = decidirEntrega(puedeCompartirArchivo(archivo), typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches);
      setListo({ archivo, url, compartir: entrega.compartir });
      if (entrega.descargaAutomatica) descargarDesdeUrl(url, archivo.nombre);
      mostrar(formato === 'pdf' ? 'PDF generado.' : 'Excel generado.', { tono: 'ok' });
    } catch {
      mostrar('No se pudo generar el archivo. Inténtalo de nuevo.', { tono: 'error' });
    } finally {
      setGenerando(null);
    }
  }

  async function compartir() {
    if (!listo) return;
    try {
      await compartirArchivo(listo.archivo);
    } catch {
      mostrar('No se pudo abrir el menú de compartir. Usa «Abrir» o «Descargar».', { tono: 'error' });
    }
  }

  return (
    <div className="flex flex-col gap-2">
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

      {listo && (
        <div role="status" className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
          <p>
            Archivo listo: <span className="break-all font-mono text-xs">{listo.archivo.nombre}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {listo.compartir && (
              <Button onClick={() => void compartir()}>
                <Share2 aria-hidden className="size-4" />
                Guardar / Compartir
              </Button>
            )}
            <Button variante="secundario" onClick={() => window.open(listo.url, '_blank', 'noopener')}>
              <ExternalLink aria-hidden className="size-4" />
              Abrir
            </Button>
            <Button variante="secundario" onClick={() => descargarDesdeUrl(listo.url, listo.archivo.nombre)}>
              <Download aria-hidden className="size-4" />
              Descargar
            </Button>
          </div>
          {listo.compartir && <p className="text-xs text-text-muted">«Guardar / Compartir» te deja guardarlo en Archivos o enviarlo por WhatsApp o correo.</p>}
        </div>
      )}
    </div>
  );
}
