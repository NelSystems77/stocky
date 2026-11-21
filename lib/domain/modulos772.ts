import type { Unidad } from '@/lib/auth/AuthProvider';

/** Módulos de la pantalla Registros. El 772 solo ve los que el 771 le habilitó (Vencidos es solo del 771). */
export type ModuloRegistro = 'preconteo' | 'traslados' | 'vencidos' | 'danados';

const TODOS: readonly ModuloRegistro[] = ['preconteo', 'traslados', 'vencidos', 'danados'];
/** Los que el 771 puede habilitar al 772 (coinciden con `modulosHabilitados` y con `firestore.rules`). */
const HABILITABLES: readonly ModuloRegistro[] = ['preconteo', 'traslados', 'danados'];

/** Qué módulos de Registros ve la persona: el 771 y el superadmin todos; el 772 solo los habilitados. */
export function modulosRegistrosVisibles(unidad: Unidad | null, esSuperadmin: boolean, habilitados: readonly string[]): ModuloRegistro[] {
  if (esSuperadmin || unidad !== '772') return [...TODOS];
  return HABILITABLES.filter((m) => habilitados.includes(m));
}

/** ¿Muestra el acceso a Registros en la navegación? Solo si hay algo que ver. */
export function veRegistros(unidad: Unidad | null, esSuperadmin: boolean, habilitados: readonly string[]): boolean {
  return modulosRegistrosVisibles(unidad, esSuperadmin, habilitados).length > 0;
}
