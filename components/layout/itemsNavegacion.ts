import { CalendarDays, ClipboardList, Home, MoreHorizontal, Package, type LucideIcon } from 'lucide-react';
import type { Unidad } from '@/lib/auth/AuthProvider';
import { veRegistros } from '@/lib/domain/modulos772';

export interface ItemNav {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Unidades que lo ven; el 772 solo ve Tareas, Agotados, Vencimientos y Reportes, más lo que el 771 le habilite. */
  unidades: Unidad[];
}

export const ITEMS_NAV: ItemNav[] = [
  { href: '/hoy/', etiqueta: 'Hoy', icono: Home, unidades: ['771', '772'] },
  { href: '/inventario/', etiqueta: 'Inventario', icono: Package, unidades: ['771', '772'] },
  { href: '/agenda/', etiqueta: 'Agenda', icono: CalendarDays, unidades: ['771', '772'] },
  // El 772 lo ve solo si el 771 le habilitó algún registro (preconteo, traslados o dañados): ver `veRegistros`.
  { href: '/registros/', etiqueta: 'Registros', icono: ClipboardList, unidades: ['771', '772'] },
  { href: '/mas/', etiqueta: 'Más', icono: MoreHorizontal, unidades: ['771', '772'] },
];

export function itemsPara(unidad: Unidad | null, esSuperadmin: boolean, habilitados: readonly string[] = []): ItemNav[] {
  if (esSuperadmin || unidad === null) return ITEMS_NAV;
  return ITEMS_NAV.filter((i) => i.unidades.includes(unidad) && (i.href !== '/registros/' || veRegistros(unidad, esSuperadmin, habilitados)));
}
