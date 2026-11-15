'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ArrowRightLeft, CalendarClock, Clock, Upload } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { Card } from '@/components/ui/Card';
import { SeccionTareasHoy } from '@/components/tareas/SeccionTareasHoy';
import { ChipAlerta } from '@/components/ui/ChipAlerta';
import { useAuth } from '@/lib/auth/AuthProvider';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { suscribirUltimaImportacion, type Importacion } from '@/lib/db/importaciones';

function saludo(ahora: Date): string {
  const hora = Number(
    new Intl.DateTimeFormat('es-CR', { hour: '2-digit', hour12: false, timeZone: 'America/Costa_Rica' }).format(ahora),
  );
  if (hora < 12) return 'Buenos días';
  if (hora < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

const ETIQUETA_TIPO = {
  existenciasDespacho: 'Existencias de despacho',
  productosEnDespacho: 'Productos en despacho',
} as const;

export default function Hoy() {
  const { estado } = useAuth();
  // `undefined` = todavía cargando; `null` = no hay importaciones.
  const [ultima, setUltima] = useState<Importacion | null | undefined>(undefined);
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;

  useEffect(() => {
    if (!uid) return;
    return suscribirUltimaImportacion(uid, setUltima);
  }, [uid]);

  if (estado.fase !== 'listo') return null;
  const { sesion } = estado;

  const ahora = new Date();
  const fecha = format(parseISO(hoyCostaRica(ahora)), "EEEE d 'de' MMMM", { locale: es });
  const es771 = sesion.unidad === '771' || sesion.rol === 'superadmin';

  return (
    <Pantalla titulo={`${saludo(ahora)}, ${sesion.nombre.split(' ')[0] ?? ''}`}>
      <p className="-mt-3 text-sm text-text-muted first-letter:uppercase">{fecha}</p>

      <section aria-label="Alertas" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ChipAlerta href="/inventario/" etiqueta="Vencimientos" valor={null} tono="critical" icono={Clock} />
        <ChipAlerta href="/inventario/" etiqueta="Riesgo de agotamiento" valor={null} tono="warning" icono={AlertTriangle} />
        {es771 && (
          <ChipAlerta href="/registros/" etiqueta="Traslados pendientes" valor={null} tono="info" icono={ArrowRightLeft} />
        )}
        <ChipAlerta href="/agenda/" etiqueta="Pedidos y envíos" valor={null} tono="info" icono={CalendarClock} />
      </section>

      {ultima === null && (
        <Card className="flex flex-col items-start gap-3">
          <p className="font-semibold">Todavía no hay reportes cargados</p>
          <p className="text-sm text-text-muted">
            Importa tu primer PDF de SIFA para ver vencimientos, riesgo de agotamiento y bajos.
          </p>
          <Link
            href="/importar/"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-bg"
          >
            <Upload aria-hidden className="size-4" />
            Importar reporte
          </Link>
        </Card>
      )}
      {ultima && (
        <Card className="flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-semibold">Último reporte: {ETIQUETA_TIPO[ultima.tipoReporte]}</p>
            <p className="text-text-muted">
              {format(ultima.fechaReporte.toDate(), "d 'de' MMMM yyyy", { locale: es })} · {ultima.filas} productos
            </p>
          </div>
          <Link href="/importar/" className="inline-flex min-h-11 items-center rounded-2xl bg-surface-2 px-4 font-semibold">
            Importar
          </Link>
        </Card>
      )}

      <SeccionTareasHoy />
    </Pantalla>
  );
}
