import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '@/lib/firebase';
import type { Modulo } from '@/lib/db/cuentas';

type Peticion =
  | { accion: 'crear'; email: string; password: string; nombre: string; unidad: '771' | '772' }
  | { accion: 'activar'; uid: string; activo: boolean }
  | { accion: 'nuevaClave'; uid: string; password: string };

/** Gestión de cuentas (solo superadmin). Requiere conexión: no hay versión offline. */
export async function gestionarCuentas(p: Peticion): Promise<void> {
  await httpsCallable(firebaseFunctions(), 'gestionarCuentas')(p);
}

export interface CuentaFarmacia {
  uid: string;
  nombre: string;
  activo: boolean;
  modulosHabilitados: string[];
}

/** Cuentas de la farmacia 772 (para el 771). Requiere conexión. */
export async function listarCuentas772(): Promise<CuentaFarmacia[]> {
  const r = await httpsCallable<unknown, { cuentas: CuentaFarmacia[] }>(firebaseFunctions(), 'cuentas772')({});
  return r.data.cuentas;
}

export async function habilitarModulos(uid: string, modulos: readonly Modulo[]): Promise<void> {
  await httpsCallable(firebaseFunctions(), 'habilitarModulos')({ uid, modulos });
}

/** Traduce el error de una callable a un mensaje para la persona usuaria. */
export function mensajeErrorCuentas(e: unknown): string {
  const codigo = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (codigo) {
    case 'functions/already-exists':
      return 'Ya existe una cuenta con ese correo.';
    case 'functions/permission-denied':
      return 'No tienes permiso para hacer esto.';
    case 'functions/unauthenticated':
      return 'Tu sesión venció. Inicia sesión de nuevo.';
    case 'functions/invalid-argument':
      return 'Revisa los datos: la contraseña necesita al menos 8 caracteres y el correo debe ser válido.';
    case 'functions/not-found':
      return 'Esa cuenta ya no existe.';
    case 'functions/failed-precondition':
      return e instanceof Error && e.message ? e.message : 'Esta acción no se puede aplicar a esa cuenta.';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'No hay conexión con el servidor. Inténtalo cuando tengas internet.';
    default:
      return 'No se pudo completar la acción. Inténtalo de nuevo.';
  }
}
