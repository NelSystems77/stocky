import { AlertTriangle, FileCheck2, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { Columna, ResultadoReporte } from '@/lib/pdf/tipos';

const ETIQUETA_TIPO = {
  existenciasDespacho: 'Existencias de despacho',
  productosEnDespacho: 'Productos en despacho',
} as const;

const ETIQUETA_COLUMNA: Record<Columna, string> = {
  cuota: 'Cuota',
  cuotaMinima: 'Cuota mín.',
  existencia: 'Existencia',
  consumo: 'Consumo',
};

const FILAS_MUESTRA = 10;
const NUEVOS_MUESTRA = 15;

const num = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString('es-CR', { maximumFractionDigits: 3 }));

interface Props {
  resultado: ResultadoReporte;
  archivo: string;
  nuevos: string[];
  sembrar: boolean;
  catalogoDisponible: boolean;
}

export function VistaPrevia({ resultado, archivo, nuevos, sembrar, catalogoDisponible }: Props) {
  const dudosas = resultado.filas.filter((f) => f.dudosa);
  const despacho = [resultado.despacho.codigo, resultado.despacho.nombre].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <FileCheck2 aria-hidden className="size-5 text-ok" />
          {ETIQUETA_TIPO[resultado.tipo]}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-text-muted">Archivo</dt>
          <dd className="truncate">{archivo}</dd>
          <dt className="text-text-muted">Despacho</dt>
          <dd>{despacho || '—'}</dd>
          <dt className="text-text-muted">Fecha del reporte</dt>
          <dd>{resultado.fechaReporte ?? 'No indicada (se usará hoy)'}</dd>
          <dt className="text-text-muted">Productos leídos</dt>
          <dd>{resultado.filas.length}</dd>
          <dt className="text-text-muted">Códigos nuevos</dt>
          <dd>{sembrar ? 'Primera carga: se crea el catálogo' : nuevos.length}</dd>
        </dl>
      </Card>

      {!catalogoDisponible && (
        <p role="alert" className="rounded-2xl bg-warning/10 p-3 text-sm text-warning">
          No pude revisar el catálogo (sin conexión y sin copia local). Tus existencias se guardan igual; los códigos nuevos
          se registran en la próxima importación.
        </p>
      )}

      {resultado.advertencias.length > 0 && (
        <Card className="flex flex-col gap-2 border border-warning/30">
          <p className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle aria-hidden className="size-5" />
            Revisa antes de guardar
          </p>
          <ul className="list-disc pl-5 text-sm text-text-muted">
            {resultado.advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      {dudosas.length > 0 && (
        <Card className="text-sm">
          <p className="mb-1 font-semibold">{dudosas.length} filas dudosas</p>
          <ul className="flex flex-col gap-1 text-text-muted">
            {dudosas.slice(0, 5).map((f) => (
              <li key={f.codigo}>
                <span className="font-mono text-text">{f.codigo}</span> · {f.nota}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {nuevos.length > 0 && (
        <Card className="text-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <Sparkles aria-hidden className="size-4 text-accent" />
            Códigos nuevos
          </p>
          <ul className="flex flex-col gap-1 text-text-muted">
            {nuevos.slice(0, NUEVOS_MUESTRA).map((c) => (
              <li key={c} className="font-mono text-text">
                {c}
              </li>
            ))}
            {nuevos.length > NUEVOS_MUESTRA && <li>y {nuevos.length - NUEVOS_MUESTRA} más…</li>}
          </ul>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="p-4 pb-2 text-left text-xs text-text-muted">
            Primeras {Math.min(FILAS_MUESTRA, resultado.filas.length)} filas de {resultado.filas.length} (cantidades en la UD del reporte)
          </caption>
          <thead className="text-xs text-text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-2 py-2 font-medium">UD</th>
              <th className="px-2 py-2 font-medium">Descripción</th>
              {resultado.columnas.map((c) => (
                <th key={c} className="px-2 py-2 text-right font-medium">
                  {ETIQUETA_COLUMNA[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultado.filas.slice(0, FILAS_MUESTRA).map((f) => (
              <tr key={f.codigo} className="border-t border-white/5">
                <td className="px-4 py-2 font-mono whitespace-nowrap">{f.codigo}</td>
                <td className="px-2 py-2">{f.ud}</td>
                <td className="max-w-48 truncate px-2 py-2">{f.descripcion}</td>
                {resultado.columnas.map((c) => (
                  <td key={c} className="px-2 py-2 text-right tabular-nums">
                    {num(f[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
