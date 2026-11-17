'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { itemsPara } from './itemsNavegacion';

function useItems() {
  const { estado } = useAuth();
  if (estado.fase !== 'listo') return [];
  return itemsPara(estado.sesion.unidad, estado.sesion.rol === 'superadmin');
}

const activo = (ruta: string, href: string) => ruta === href || ruta.startsWith(href);

/** Barra inferior (celular). */
export function BarraInferior() {
  const ruta = usePathname();
  const items = useItems();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/5 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {items.map(({ href, etiqueta, icono: Icono }) => {
        const a = activo(ruta, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={a ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition duration-200 ${a ? 'text-accent' : 'text-text-muted'}`}
          >
            <Icono aria-hidden className="size-5" />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

/** Menú lateral (PC, ≥ 1024 px). */
export function MenuLateral() {
  const ruta = usePathname();
  const items = useItems();
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-white/5 bg-surface p-4 lg:flex">
      <div className="mb-4 px-2">
        <p className="text-[10px] tracking-[0.3em] text-text-muted uppercase">NelSystems</p>
        <p className="text-2xl font-bold text-accent">Stocky</p>
      </div>
      <nav aria-label="Navegación principal" className="flex flex-col gap-1">
        {items.map(({ href, etiqueta, icono: Icono }) => {
          const a = activo(ruta, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={a ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm transition duration-200 ${a ? 'bg-surface-2 text-accent' : 'text-text-muted hover:bg-surface-2 hover:text-text'}`}
            >
              <Icono aria-hidden className="size-5" />
              {etiqueta}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
