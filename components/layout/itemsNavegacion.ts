import { CalendarDays, ClipboardList, Home, MoreHorizontal, Package, type LucideIcon } from 'lucide-react';
import type { Unidad } from '@/lib/auth/AuthProvider';

export interface ItemNav {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Unidades que lo ven; el 772 solo ve Tareas, Agotados, Vencimientos y Reportes. */
  unidades: Unidad[];
}

export const ITEMS_NAV: ItemNav[] = [
  { href: '/hoy/', etiqueta: 'Hoy', icono: Home, unidades: ['771', '772'] },
  { href: '/inventario/', etiqueta: 'Inventario', icono: Package, unidades: ['771', '772'] },
  { href: '/agenda/', etiqueta: 'Agenda', icono: CalendarDays, unidades: ['771', '772'] },
  { href: '/registros/', etiqueta: 'Registros', icono: ClipboardList, unidades: ['771'] },
  { href: '/mas/', etiqueta: 'Más', icono: MoreHorizontal, unidades: ['771', '772'] },
];

export function itemsPara(unidad: Unidad | null, esSuperadmin: boolean): ItemNav[] {
  if (esSuperadmin || unidad === null) return ITEMS_NAV;
  return ITEMS_NAV.filter((i) => i.unidades.includes(unidad));
}
