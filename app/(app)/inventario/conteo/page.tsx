'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, ClipboardCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DetalleConteo } from '@/components/conteo/DetalleConteo';
import { NuevoConteo } from '@/components/conteo/NuevoConteo';
import { Pantalla } from '@/components/layout/Pantalla';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Hoja } from '@/components/ui/Hoja';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { crearConteo, suscribirConteos, type Conteo } from '@/lib/db/conteos';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { crearFoto } from '@/lib/domain/conteo';

const fecha = (f: string) => format(parseISO(f), "EEE d 'de' MMM yyyy", { locale: es });

export default function ConteoFisico() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  // `undefined` = cargando.
  const [conteos, setConteos] = useState<Conteo[] | undefined>(undefined);
  const [existencias, setExistencias] = useState<Existencia[] | undefined>(undefined);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const bajas = [suscribirConteos(uid, setConteos), suscribirExistencias(uid, setExistencias)];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  const fechaReporte = useMemo(
    () => (existencias && existencias.length > 0 ? hoyCostaRica(new Date(Math.max(...existencias.map((p) => p.actualizadoEn.toMillis())))) : null),
    [existencias],
  );

  if (estado.fase !== 'listo' || !uid) return null;
  const actual = conteos?.find((c) => c.id === abierto);

  function iniciar(alcance: 'todos' | 'lista', codigos?: ReadonlySet<string>) {
    if (!uid || !existencias) return;
    const { id, guardado } = crearConteo(uid, { fecha: hoyCostaRica(), fechaReporteSifa: fechaReporte, alcance, foto: crearFoto(existencias, codigos) });
    void guardado.catch(() => mostrar('No se pudo iniciar el conteo.', { tono: 'error' }));
    setNuevo(false);
    setAbierto(id);
  }

  if (actual) {
    return (
      <Pantalla titulo="Conteo físico">
        <DetalleConteo uid={uid} conteo={actual} usuario={estado.sesion.nombre} unidad={estado.sesion.unidad ?? ''} alVolver={() => setAbierto(null)} />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Conteo físico">
      <Link href="/inventario/" className="-mt-2 inline-flex min-h-11 items-center gap-2 self-start text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Inventario
      </Link>

      <p className="text-sm text-text-muted">Cuenta lo que hay en el almacén y compáralo con la existencia que dice SIFA. Funciona sin conexión.</p>

      <Button onClick={() => setNuevo(true)} disabled={!existencias || existencias.length === 0} className="self-start">
        <Plus aria-hidden className="size-4" />
        Nuevo conteo
      </Button>
      {existencias?.length === 0 && (
        <Card className="text-sm text-text-muted">
          Para contar necesitas la existencia de SIFA.{' '}
          <Link href="/importar/" className="font-semibold text-accent">
            Importa el reporte de existencias
          </Link>
          .
        </Card>
      )}

      {conteos === undefined ? (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando…
        </Card>
      ) : conteos.length === 0 ? (
        <Card className="text-center text-sm text-text-muted">Aún no hay conteos.</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {conteos.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setAbierto(c.id)} className="flex min-h-11 w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left">
                <ClipboardCheck aria-hidden className="size-5 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{fecha(c.fecha)}</span>
                  <span className="block text-xs text-text-muted">
                    {c.alcance === 'todos' ? 'Todos los productos' : 'Lista elegida'} · {Object.keys(c.foto).length} productos
                    {c.fechaReporteSifa ? ` · SIFA del ${fecha(c.fechaReporteSifa)}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Hoja abierta={nuevo} alCerrar={() => setNuevo(false)} titulo="Nuevo conteo">
        <NuevoConteo existencias={existencias ?? []} alIniciar={iniciar} />
      </Hoja>
    </Pantalla>
  );
}
