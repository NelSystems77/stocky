import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { AJUSTES_NOTIFICACIONES_INICIALES, type AjustesNotificaciones } from '@/lib/domain/notificaciones';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

export interface DatosUsuario {
  /** `false` si el documento de la cuenta aún no existe (lo crea el superadmin con la cuenta). */
  existe: boolean;
  notificaciones: AjustesNotificaciones;
  tokens: string[];
}

const ref = (uid: string) => doc(firestore(), `usuarios/${uid}`);

export function suscribirUsuario(uid: string, alCambiar: (d: DatosUsuario) => void): Unsubscribe {
  return onSnapshot(
    ref(uid),
    (snap) => {
      const datos = snap.data() as { ajustes?: { notificaciones?: Partial<AjustesNotificaciones> }; tokensFCM?: unknown } | undefined;
      alCambiar({
        existe: snap.exists(),
        notificaciones: { ...AJUSTES_NOTIFICACIONES_INICIALES, ...datos?.ajustes?.notificaciones },
        tokens: Array.isArray(datos?.tokensFCM) ? datos.tokensFCM.filter((t): t is string => typeof t === 'string') : [],
      });
    },
    () => alCambiar({ existe: false, notificaciones: AJUSTES_NOTIFICACIONES_INICIALES, tokens: [] }),
  );
}

/** Solo toca `ajustes.notificaciones.<clave>`: las reglas permiten escribir `ajustes` pero no el rol ni la unidad. */
export function guardarAjusteNotificacion(uid: string, clave: keyof AjustesNotificaciones, valor: boolean): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { [`ajustes.notificaciones.${clave}`]: valor }));
}

export function agregarToken(uid: string, token: string): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { tokensFCM: arrayUnion(token) }));
}

export function quitarToken(uid: string, token: string): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { tokensFCM: arrayRemove(token) }));
}
