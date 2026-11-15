import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { agregarToken, quitarToken } from '@/lib/db/usuario';
import { firebaseApp } from '@/lib/firebase';

export type ResultadoActivacion = 'ok' | 'denegado' | 'no-soportado' | 'sin-clave' | 'sin-red' | 'error';

/** Clave pública VAPID de Firebase Console → Cloud Messaging → Certificados web push. */
const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function notificacionesSoportadas(): Promise<boolean> {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && (await isSupported());
}

async function obtenerToken(): Promise<string> {
  const registro = await navigator.serviceWorker.ready;
  return getToken(getMessaging(firebaseApp()), { vapidKey: VAPID, serviceWorkerRegistration: registro });
}

/** Pide permiso, obtiene el token de este dispositivo y lo guarda en la cuenta. Requiere conexión. */
export async function activarNotificaciones(uid: string): Promise<ResultadoActivacion> {
  if (!(await notificacionesSoportadas())) return 'no-soportado';
  if (!VAPID) return 'sin-clave';
  if (!navigator.onLine) return 'sin-red';
  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'denegado';
    await agregarToken(uid, await obtenerToken());
    return 'ok';
  } catch {
    return 'error';
  }
}

/** Deja de avisar en este dispositivo: borra el token en FCM y en la cuenta. */
export async function desactivarNotificaciones(uid: string): Promise<void> {
  if (!(await notificacionesSoportadas()) || !VAPID) return;
  const token = await obtenerToken();
  await Promise.allSettled([deleteToken(getMessaging(firebaseApp())), quitarToken(uid, token)]);
}
