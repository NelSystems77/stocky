'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ArrowRightLeft, CalendarClock, Clock, Upload } from 'lucide-react';
import Link from 'next/link';
import { Pantalla } from '@/components/layout/Pantalla';
import { Card } from '@/components/ui/Card';
import { ChipAlerta } from '@/components/ui/ChipAlerta';
import { useAuth } from '@/lib/auth/AuthProvider';
import { hoyCostaRica } from '@/lib/domain/calendario';

function saludo(ahora: Date): string {
  const hora = Number(
    new Intl.DateTimeFormat('es-CR', { hour: '2-digit', hour12: false, timeZone: 'America/Costa_Rica' }).format(ahora),
  );
  if (hora < 12) return 'Buenos días';
  if (hora < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function Hoy() {
  const { estado } = useAuth();
  if (estado.fase !== 'listo') return null;
  const { sesion } = estado;

  const ahora = new Date();
  const fecha = format(parseISO(hoyCostaRica(ahora)), "EEEE d 'de' MMMM", { locale: es });
  const es771 = sesion.unidad === '771' || sesion.rol === 'superadmin';

  return (
    <Pantalla titulo={`${saludo(ahora)}, ${sesion.nombre.split(' ')[0] ?? ''}`}>
      <p className="-mt-3 text-sm text-text-muted capitalize">{fecha}</p>

      <section aria-label="Alertas" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ChipAlerta href="/inventario/" etiqueta="Vencimientos" valor={null} tono="critical" icono={Clock} />
        <ChipAlerta href="/inventario/" etiqueta="Riesgo de agotamiento" valor={null} tono="warning" icono={AlertTriangle} />
        {es771 && (
          <ChipAlerta href="/registros/" etiqueta="Traslados pendientes" valor={null} tono="info" icono={ArrowRightLeft} />
        )}
        <ChipAlerta href="/agenda/" etiqueta="Pedidos y envíos" valor={null} tono="info" icono={CalendarClock} />
      </section>

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

      <section aria-label="Tareas de hoy">
        <h2 className="mb-2 text-lg font-semibold">Tareas de hoy</h2>
        <Card className="text-sm text-text-muted">No hay tareas para hoy.</Card>
      </section>
    </Pantalla>
  );
}
