'use client';

import { ChevronRight, ArrowRightLeft, ClipboardCheck, CalendarX, PackageX, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Pantalla } from '@/components/layout/Pantalla';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useModulosHabilitados } from '@/lib/auth/useModulosHabilitados';
import { modulosRegistrosVisibles, type ModuloRegistro } from '@/lib/domain/modulos772';

interface Modulo {
  id: ModuloRegistro;
  href: string;
  titulo: string;
  detalle: string;
  icono: LucideIcon;
}

const MODULOS: Modulo[] = [
  { id: 'preconteo', href: '/registros/preconteo/', titulo: 'Preconteo', detalle: 'Entregas a las damas voluntarias y su recepción', icono: ClipboardCheck },
  { id: 'traslados', href: '/registros/traslados/', titulo: 'Traslados', detalle: 'Orden SAP, envíos y recepciones, trámite SAP/SIFA', icono: ArrowRightLeft },
  { id: 'vencidos', href: '/registros/vencidos/', titulo: 'Vencidos', detalle: 'Lotes vencidos: la meta es cero', icono: CalendarX },
  { id: 'danados', href: '/registros/danados/', titulo: 'Dañados', detalle: 'Quebrados y derramados, con foto opcional', icono: PackageX },
];

export default function Page() {
  const { estado } = useAuth();
  const habilitados = useModulosHabilitados();
  if (estado.fase !== 'listo') return null;
  // El 771 ve todo; la farmacia 772 solo lo que el 771 le habilitó.
  const visibles = modulosRegistrosVisibles(estado.sesion.unidad, estado.sesion.rol === 'superadmin', habilitados);

  return (
    <Pantalla titulo="Registros">
      {visibles.length === 0 && <p className="text-sm text-text-muted">El 771 todavía no te habilitó ningún registro.</p>}
      <ul className="flex flex-col gap-2">
        {MODULOS.filter((m) => visibles.includes(m.id)).map(({ href, titulo, detalle, icono: Icono }) => (
          <li key={titulo}>
            <Link href={href} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface p-3 transition duration-200 hover:brightness-125">
              <Icono aria-hidden className="size-6 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{titulo}</span>
                <span className="block text-xs text-text-muted">{detalle}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Pantalla>
  );
}
