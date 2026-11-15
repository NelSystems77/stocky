import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

// Se referencian de forma estática para que Next las incruste en el build.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** Clave de sitio pública de reCAPTCHA Enterprise (App Check). Sin ella la app funciona, pero sin tokens. */
const CLAVE_APP_CHECK = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const REGION_FUNCTIONS = 'us-central1';

/** Solo para desarrollo y pruebas locales: `NEXT_PUBLIC_USE_EMULATORS=true` apunta a los emuladores de Firebase. */
const USAR_EMULADORES = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

/**
 * Inicialización perezosa: solo se invoca desde el cliente (efectos, manejadores),
 * nunca durante el prerender estático.
 */
export function firebaseApp(): FirebaseApp {
  if (!config.apiKey || !config.appId) {
    throw new Error('Falta la configuración de Firebase: copia .env.example a .env.local y complétala.');
  }
  if (getApps().length > 0) return getApp();
  const app = initializeApp(config);
  iniciarAppCheck(app);
  return app;
}

/**
 * App Check: cada petición a Firebase lleva un token que prueba que viene de esta app y no de un script ajeno.
 * Fase 1: solo se envía el token (la exigencia en el servidor se activa después, con métricas a la vista).
 * El token se renueva solo en segundo plano: no bloquea escrituras ni lecturas sin conexión.
 */
function iniciarAppCheck(app: FirebaseApp): void {
  if (typeof window === 'undefined' || !CLAVE_APP_CHECK || USAR_EMULADORES) return;
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    // Desarrollo local: reCAPTCHA no sirve en localhost; Firebase imprime un token de depuración en la consola.
    (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(CLAVE_APP_CHECK),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('No se pudo iniciar App Check.', e);
  }
}

let auth: Auth | undefined;

export function firebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(firebaseApp());
    if (USAR_EMULADORES) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}

let db: Firestore | undefined;

/** Firestore con persistencia local (IndexedDB) y soporte multi-pestaña para trabajar sin conexión. */
export function firestore(): Firestore {
  if (!db) {
    db = initializeFirestore(firebaseApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (USAR_EMULADORES) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return db;
}

let funciones: Functions | undefined;

export function firebaseFunctions(): Functions {
  if (!funciones) {
    funciones = getFunctions(firebaseApp(), REGION_FUNCTIONS);
    if (USAR_EMULADORES) connectFunctionsEmulator(funciones, '127.0.0.1', 5001);
  }
  return funciones;
}
