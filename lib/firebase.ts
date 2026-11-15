import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

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

const REGION_FUNCTIONS = 'us-central1';

/**
 * Inicialización perezosa: solo se invoca desde el cliente (efectos, manejadores),
 * nunca durante el prerender estático.
 */
export function firebaseApp(): FirebaseApp {
  if (!config.apiKey || !config.appId) {
    throw new Error('Falta la configuración de Firebase: copia .env.example a .env.local y complétala.');
  }
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

let db: Firestore | undefined;

/** Firestore con persistencia local (IndexedDB) y soporte multi-pestaña para trabajar sin conexión. */
export function firestore(): Firestore {
  db ??= initializeFirestore(firebaseApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return db;
}

export function firebaseFunctions(): Functions {
  return getFunctions(firebaseApp(), REGION_FUNCTIONS);
}
