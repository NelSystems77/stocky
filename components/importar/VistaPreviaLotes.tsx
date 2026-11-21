import { AlertTriangle, CheckCircle2, FileCheck2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { formatearEnUD } from '@/lib/domain/formato';
import { type Lote, type RevisionLotes } from '@/lib/domain/lotes';
import type { ResultadoLotes } from '@/lib/pdf/lotes';

const FILAS_MUESTRA = 10;
const LIMITE_LISTA = 60;

const colones = (n: number) => `₡${n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Tono = 'normal' | 'aviso' | 'critico';
const COLOR: Record<Tono, string> = { normal: '', aviso: 'border border-warning/30', critico: 'border border-critical/40' };
const TEXTO: Record<Tono, string> = { normal: 'text-text', aviso: 'text-warning', critico: 'text-critical' };

/** Bloque plegable con su conteo; los que piden atención nacen abiertos. */
function Detalle({ titulo, cantidad, tono = 'normal', abierto = false, nota, children }: { titulo: string; cantidad: number; tono?: Tono; abierto?: boolean; nota?: string; children: ReactNode }) {
  if (cantidad === 0) return null;
  return (
    <details open={abierto} className={`rounded-2xl bg-surface p-4 text-sm ${COLOR[tono]}`}>
      <summary className={`min-h-8 cursor-pointer font-semibold ${TEXTO[tono]}`}>
        {titulo} ({cantidad})
      </summary>
      {nota && <p className="mt-2 text-xs text-text-muted">{nota}</p>}
      <div className="mt-2 overflow-x-auto">{children}</div>
      {cantidad > LIMITE_LISTA && <p className="mt-2 text-xs text-text-muted">Se muestran los primeros {LIMITE_LISTA}.</p>}
    </details>
  );
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: ReactNode[][] }) {
  return (
    <table className="w-full min-w-[30rem] text-left text-sm">
      <thead className="text-xs text-text-muted">
        <tr>
          {columnas.map((c, i) => (
            <th key={c} className={`py-1 pr-3 font-medium ${i >= 2 ? 'text-right' : ''}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.slice(0, LIMITE_LISTA).map((f, i) => (
          <tr key={i} className="border-t border-white/5">
            {f.map((c, j) => (
              <td key={j} className={`py-1.5 pr-3 ${j === 0 ? 'font-mono whitespace-nowrap' : ''} ${j >= 2 ? 'text-right tabular-nums' : ''}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const cant = (n: number, ud: string) => formatearEnUD(n, ud);

interface Props {
  resultado: ResultadoLotes;
  archivo: string;
  lotes: Lote[];
  revision: RevisionLotes;
}

export function VistaPreviaLotes({ resultado, archivo, lotes, revision }: Props) {
  const { cambios, cuadre } = revision;
  const dudosas = resultado.filas.filter((f) => f.dudosa);
  const despacho = [resultado.despacho.codigo, resultado.despacho.nombre].filter(Boolean).join(' ');
  const total = resultado.totalDeclarado;
  const avisos = [...(revision.fecha.mensaje ? [revision.fecha.mensaje] : []), ...resultado.advertencias];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <FileCheck2 aria-hidden className="size-5 text-ok" />
          Lotes y vencimientos
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-text-muted">Archivo</dt>
          <dd className="truncate">{archivo}</dd>
          <dt className="text-text-muted">Despacho</dt>
          <dd>{despacho || '—'}</dd>
          <dt className="text-text-muted">Fecha del reporte</dt>
          <dd>{resultado.fechaReporte ?? 'No indicada (se usará hoy)'}</dd>
          <dt className="text-text-muted">Carga anterior</dt>
          <dd>{revision.hayAnterior ? (revision.ultimaCarga ?? '—') : 'Ninguna: es la primera carga'}</dd>
          <dt className="text-text-muted">Filas leídas</dt>
          <dd>
            {resultado.filas.length} → {lotes.length} lotes de {revision.productos} productos
          </dd>
          <dt className="text-text-muted">No medicamentos</dt>
          <dd>{revision.noMedicamentos === 0 ? 'Ninguno' : `${revision.noMedicamentos} lotes (condones, etiquetas, etc.): se guardan marcados`}</dd>
        </dl>
      </Card>

      <Card className={`flex items-start gap-3 text-sm ${resultado.cuadra === false ? 'border border-critical/40' : ''}`}>
        {resultado.cuadra === true ? (
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-ok" />
        ) : resultado.cuadra === false ? (
          <XCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-critical" />
        ) : (
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        )}
        <div>
          <p className="font-semibold">
            {resultado.cuadra === true ? 'El valor cuadra con el reporte' : resultado.cuadra === false ? 'El valor NO cuadra: no se puede guardar' : 'No se pudo cuadrar el valor'}
          </p>
          <p className="text-text-muted">
            Filas leídas: {colones(resultado.sumaValor)}
            {total !== null && <> · Total general del reporte: {colones(total)}</>}
          </p>
          {resultado.cuadra === false && <p className="mt-1 text-critical">Falta o sobra alguna fila: revisa el PDF antes de volver a intentar.</p>}
        </div>
      </Card>

      {avisos.length > 0 && (
        <Card className="flex flex-col gap-2 border border-warning/30">
          <p className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle aria-hidden className="size-5" />
            Revisa antes de guardar
          </p>
          <ul className="list-disc pl-5 text-sm text-text-muted">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Cambios contra la carga anterior</h2>
        {!revision.hayAnterior ? (
          <Card className="text-sm text-text-muted">Primera carga: los {lotes.length} lotes se guardan como nuevos. Revisa la tabla de abajo contra el PDF.</Card>
        ) : (
          <Card className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <p>Sin cambio: <strong>{cambios.sinCambio}</strong></p>
            <p>Bajaron (consumo): <strong>{cambios.bajaron.length}</strong></p>
            <p className={cambios.subieron.length ? 'text-warning' : ''}>Subieron: <strong>{cambios.subieron.length}</strong></p>
            <p className={cambios.vencimiento.length ? 'text-critical' : ''}>Cambió el vencimiento: <strong>{cambios.vencimiento.length}</strong></p>
            <p>Lotes nuevos: <strong>{cambios.nuevos.length}</strong></p>
            <p>Salieron: <strong>{cambios.salieron.length}</strong></p>
          </Card>
        )}

        <Detalle
          titulo="Cambió la fecha de vencimiento"
          cantidad={cambios.vencimiento.length}
          tono="critico"
          abierto
          nota="Mismo producto y número de lote con otra fecha. Verifica que no sea un error de lectura o de digitación en SIFA."
        >
          <Tabla
            columnas={['Código', 'Lote', 'Antes', 'Ahora', 'Cantidad']}
            filas={cambios.vencimiento.map((c) => [c.codigo, c.lote, c.venceAntes, c.venceDespues, `${cant(c.cantidadAntes, c.ud)} → ${cant(c.cantidadDespues, c.ud)}`])}
          />
        </Detalle>

        <Detalle
          titulo="Cantidad que SUBIÓ"
          cantidad={cambios.subieron.length}
          tono="aviso"
          abierto
          nota="Una existencia solo debería subir con un ingreso (normalmente el segundo sábado) o una corrección. Confirma que sea real."
        >
          <Tabla columnas={['Código', 'Lote', 'Antes', 'Ahora']} filas={cambios.subieron.map((c) => [c.lote.codigo, c.lote.lote, cant(c.antes, c.lote.ud), cant(c.despues, c.lote.ud)])} />
        </Detalle>

        <Detalle
          titulo="Lotes vencidos con existencia"
          cantidad={revision.vencidos.length}
          tono="critico"
          abierto
          nota="Meta: cero vencidos. Estos lotes ya cumplieron su fecha y todavía figuran con existencia."
        >
          <Tabla columnas={['Código', 'Lote', 'Venció', 'Existencia']} filas={revision.vencidos.map((l) => [l.codigo, l.lote, l.vence, cant(l.cantidad, l.ud)])} />
        </Detalle>

        <Detalle titulo="Lotes que salieron del reporte" cantidad={cambios.salieron.length} nota="Tenían existencia en la carga anterior y ya no aparecen: se marcan como agotados (el historial se conserva).">
          <Tabla columnas={['Código', 'Lote', 'Vencía', 'Tenía']} filas={cambios.salieron.map((l) => [l.codigo, l.lote, l.vence, cant(l.cantidad, l.ud)])} />
        </Detalle>

        <Detalle titulo="Lotes nuevos" cantidad={cambios.nuevos.length} nota={revision.hayAnterior ? 'Ingresos recientes o lotes que reaparecen.' : undefined}>
          <Tabla columnas={['Código', 'Lote', 'Vence', 'Existencia']} filas={cambios.nuevos.map((l) => [l.codigo, l.lote, l.vence, cant(l.cantidad, l.ud)])} />
        </Detalle>

        <Detalle titulo="Cantidad que bajó" cantidad={cambios.bajaron.length} nota="Es lo esperado por el consumo.">
          <Tabla columnas={['Código', 'Lote', 'Antes', 'Ahora']} filas={cambios.bajaron.map((c) => [c.lote.codigo, c.lote.lote, cant(c.antes, c.lote.ud), cant(c.despues, c.lote.ud)])} />
        </Detalle>
      </div>

      {cuadre ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Cuadre con las existencias de SIFA</h2>
          <Card className="text-sm text-text-muted">
            Suma de lotes contra el último reporte de existencias guardado: coinciden <strong className="text-text">{cuadre.coinciden}</strong>, difieren{' '}
            <strong className={cuadre.diferencias.length ? 'text-warning' : 'text-text'}>{cuadre.diferencias.length}</strong>. Solo son comparables si ambos reportes son de la misma fecha.
          </Card>
          <Detalle titulo="La suma de lotes no coincide con la existencia" cantidad={cuadre.diferencias.length} tono="aviso">
            <Tabla
              columnas={['Código', 'Descripción', 'Lotes', 'Existencia']}
              filas={cuadre.diferencias.map((d) => [d.codigo, d.descripcion, cant(d.lotes, d.ud), cant(d.existencia, d.ud)])}
            />
          </Detalle>
          <Detalle titulo="Con existencia pero sin ningún lote en este reporte" cantidad={cuadre.sinLotes.length} tono="aviso">
            <Tabla columnas={['Código', 'Descripción', 'Existencia']} filas={cuadre.sinLotes.map((d) => [d.codigo, d.descripcion, cant(d.existencia, d.ud)])} />
          </Detalle>
        </div>
      ) : (
        <Card className="text-sm text-text-muted">No hay existencias de SIFA guardadas para cuadrar: carga primero el reporte de existencias de despacho si quieres esta comparación.</Card>
      )}

      {dudosas.length > 0 && (
        <Card className="text-sm">
          <p className="mb-1 font-semibold">{dudosas.length} filas dudosas</p>
          <p className="mb-2 text-xs text-text-muted">La descripción venía partida en dos líneas: confirma el producto y el lote contra el PDF.</p>
          <ul className="flex flex-col gap-1 text-text-muted">
            {dudosas.slice(0, 15).map((f) => (
              <li key={`${f.codigo}${f.lote}${f.vence}`}>
                <span className="font-mono text-text">{f.codigo}</span> · lote {f.lote} · {f.descripcion}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="p-4 pb-2 text-left text-xs text-text-muted">
            Primeras {Math.min(FILAS_MUESTRA, lotes.length)} de {lotes.length} lotes (en la UD del producto)
          </caption>
          <thead className="text-xs text-text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-2 py-2 font-medium">Descripción</th>
              <th className="px-2 py-2 font-medium">Lote</th>
              <th className="px-2 py-2 font-medium">Vence</th>
              <th className="px-2 py-2 text-right font-medium">Existencia</th>
            </tr>
          </thead>
          <tbody>
            {lotes.slice(0, FILAS_MUESTRA).map((l) => (
              <tr key={`${l.codigo}${l.lote}${l.vence}`} className="border-t border-white/5">
                <td className="px-4 py-2 font-mono whitespace-nowrap">{l.codigo}</td>
                <td className="max-w-40 truncate px-2 py-2">{l.descripcion}</td>
                <td className="px-2 py-2 font-mono">{l.lote}</td>
                <td className="px-2 py-2 whitespace-nowrap">{l.vence}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cant(l.cantidad, l.ud)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
