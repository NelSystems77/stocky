import { ChevronRight, ArrowRightLeft, ClipboardCheck, CalendarX, PackageX, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Pantalla } from '@/components/layout/Pantalla';

interface Modulo {
  href?: string;
  titulo: string;
  detalle: string;
  icono: LucideIcon;
}

const MODULOS: Modulo[] = [
  { href: '/registros/preconteo/', titulo: 'Preconteo', detalle: 'Entregas a las damas voluntarias y su recepción', icono: ClipboardCheck },
  { href: '/registros/traslados/', titulo: 'Traslados', detalle: 'Orden SAP, envíos y recepciones, trámite SAP/SIFA', icono: ArrowRightLeft },
  { href: '/registros/vencidos/', titulo: 'Vencidos', detalle: 'Lotes vencidos: la meta es cero', icono: CalendarX },
  { href: '/registros/danados/', titulo: 'Dañados', detalle: 'Quebrados y derramados, con foto opcional', icono: PackageX },
];

export default function Page() {
  return (
    <Pantalla titulo="Registros">
      <ul className="flex flex-col gap-2">
        {MODULOS.map(({ href, titulo, detalle, icono: Icono }) => (
          <li key={titulo}>
            <Link href={href ?? '#'} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface p-3 transition duration-200 hover:brightness-125">
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
