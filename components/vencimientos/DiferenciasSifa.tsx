import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { formatearEnUD, formatearNumero } from '@/lib/domain/formato';
import type { DiferenciasSifa } from '@/lib/domain/lotes';

const fecha = (f: string) => format(parseISO(f), "d 'de' MMM yyyy", { locale: es });

function Bloque({ titulo, nota, cantidad, children }: { titulo: string; nota: string; cantidad: number; children: ReactNode }) {
  if (cantidad === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-warning/30 bg-surface p-4 text-sm">
      <h2 className="font-semibold text-warning">
        {titulo} ({cantidad})
      </h2>
      <p className="text-xs text-text-muted">{nota}</p>
      {children}
    </section>
  );
}

/**
 * Diferencias permanentes entre la suma de lotes (último reporte de lotes) y la existencia de SIFA (último reporte de
 * existencias). Solo se comparan si ambos son de la misma fecha.
 */
export function DiferenciasSifa({ sifa, hayLotes }: { sifa: DiferenciasSifa; hayLotes: boolean }) {
  if (!hayLotes || sifa.fechaExistencias === null) {
    return (
      <Card className="flex items-start gap-3 text-sm text-text-muted">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>
          Para comparar hacen falta los dos reportes del mismo día: el de <strong className="text-text">existencias de despacho</strong> y el de{' '}
          <strong className="text-text">lotes y vencimientos</strong>.{' '}
          <Link href="/importar/" className="text-accent">
            Importar reporte
          </Link>
        </p>
      </Card>
    );
  }

  if (!sifa.comparable || !sifa.cuadre || sifa.fechaLotes === null) {
    return (
      <Card className="flex items-start gap-3 text-sm">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-info" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Los reportes no son de la misma fecha</p>
          <p className="text-text-muted">
            Existencias: {fecha(sifa.fechaExistencias)} · Lotes: {sifa.fechaLotes ? fecha(sifa.fechaLotes) : '—'}. Entre un reporte y otro hay consumo e ingresos, así que la diferencia no significaría un error. Carga los dos reportes del mismo día para compararlos.
          </p>
        </div>
      </Card>
    );
  }

  const { cuadre } = sifa;
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex items-start gap-3 text-sm">
        {sifa.total === 0 ? <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-ok" /> : <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />}
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{sifa.total === 0 ? 'Los lotes cuadran con las existencias de SIFA' : `${sifa.total} ${sifa.total === 1 ? 'producto por revisar' : 'productos por revisar'}`}</p>
          <p className="text-text-muted">
            Reportes del {fecha(sifa.fechaLotes)}. Coinciden {cuadre.coinciden} productos. La diferencia está en SIFA (un reporte no suma lo que dice el otro): revisa allí si falta registrar un lote o hay un lote mal cargado.
          </p>
        </div>
      </Card>

      <Bloque
        titulo="La suma de lotes no coincide con la existencia"
        cantidad={cuadre.diferencias.length}
        nota="Diferencia = lotes − existencia. Negativa: hay existencia sin lote registrado."
      >
        <ul className="flex flex-col gap-2">
          {cuadre.diferencias.map((d) => {
            const dif = d.lotes - d.existencia;
            return (
              <li key={d.codigo} className="rounded-xl bg-surface-2 p-3">
                <p>
                  <span className="font-mono">{d.codigo}</span> · {d.descripcion}
                </p>
                <p className="text-xs text-text-muted">
                  Lotes {formatearEnUD(d.lotes, d.ud)} · Existencia {formatearEnUD(d.existencia, d.ud)} ·{' '}
                  <strong className="text-text">
                    Diferencia {dif > 0 ? '+' : '−'}
                    {formatearNumero(Math.abs(dif / (d.ud === 'CN' ? 100 : 1)))} {d.ud}
                  </strong>
                </p>
              </li>
            );
          })}
        </ul>
      </Bloque>

      <Bloque titulo="Con existencia pero sin ningún lote" cantidad={cuadre.sinLotes.length} nota="SIFA dice que hay existencia, pero el reporte de lotes no trae ningún lote de estos productos.">
        <ul className="flex flex-col gap-2">
          {cuadre.sinLotes.map((d) => (
            <li key={d.codigo} className="rounded-xl bg-surface-2 p-3">
              <span className="font-mono">{d.codigo}</span> · {d.descripcion}
              <p className="text-xs text-text-muted">Existencia {formatearEnUD(d.existencia, d.ud)}</p>
            </li>
          ))}
        </ul>
      </Bloque>

      <Bloque titulo="Con lotes pero sin existencia guardada" cantidad={cuadre.sinExistencia.length} nota="El reporte de lotes trae estos productos, pero no aparecen en el reporte de existencias importado.">
        <ul className="flex flex-col gap-1">
          {cuadre.sinExistencia.map((c) => (
            <li key={c} className="font-mono">
              {c}
            </li>
          ))}
        </ul>
      </Bloque>
    </div>
  );
}
