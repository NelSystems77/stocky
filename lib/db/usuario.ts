import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import type { FechaISO } from '@/lib/domain/types';
import { normalizarFeriados } from '@/lib/domain/feriados';
import { AJUSTES_NOTIFICACIONES_INICIALES, type AjustesNotificaciones } from '@/lib/domain/notificaciones';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

export interface DatosUsuario {
  /** `false` si el documento de la cuenta aún no existe (lo crea el superadmin con la cuenta). */
  existe: boolean;
  notificaciones: AjustesNotificaciones;
  /** Feriados del usuario (`YYYY-MM-DD`, ordenados): no hay avisos ni recurrencias en esos días. */
  feriados: FechaISO[];
  tokens: string[];
}

const ref = (uid: string) => doc(firestore(), `usuarios/${uid}`);

export function suscribirUsuario(uid: string, alCambiar: (d: DatosUsuario) => void): Unsubscribe {
  return onSnapshot(
    ref(uid),
    (snap) => {
      const datos = snap.data() as { ajustes?: { notificaciones?: Partial<AjustesNotificaciones>; feriados?: unknown }; tokensFCM?: unknown } | undefined;
      alCambiar({
        existe: snap.exists(),
        notificaciones: { ...AJUSTES_NOTIFICACIONES_INICIALES, ...datos?.ajustes?.notificaciones },
        feriados: normalizarFeriados(datos?.ajustes?.feriados),
        tokens: Array.isArray(datos?.tokensFCM) ? datos.tokensFCM.filter((t): t is string => typeof t === 'string') : [],
      });
    },
    () => alCambiar({ existe: false, notificaciones: AJUSTES_NOTIFICACIONES_INICIALES, feriados: [], tokens: [] }),
  );
}

/** Solo toca `ajustes.notificaciones.<clave>`: las reglas permiten escribir `ajustes` pero no el rol ni la unidad. */
export function guardarAjusteNotificacion(uid: string, clave: keyof AjustesNotificaciones, valor: boolean): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { [`ajustes.notificaciones.${clave}`]: valor }));
}

/** Reemplaza la lista de feriados (`ajustes.feriados`). Siempre se guarda normalizada. */
export function guardarFeriados(uid: string, feriados: readonly FechaISO[]): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { 'ajustes.feriados': normalizarFeriados([...feriados]) }));
}

export function agregarToken(uid: string, token: string): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { tokensFCM: arrayUnion(token) }));
}

export function quitarToken(uid: string, token: string): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { tokensFCM: arrayRemove(token) }));
}
