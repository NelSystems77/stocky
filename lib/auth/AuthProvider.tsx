'use client';

import {
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { firebaseAuth } from '@/lib/firebase';

export type Rol = 'superadmin' | 'usuario';
export type Unidad = '771' | '772';

export interface Sesion {
  uid: string;
  email: string;
  nombre: string;
  rol: Rol | null;
  unidad: Unidad | null;
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'sin-sesion' }
  | { fase: 'error-config'; mensaje: string }
  | { fase: 'listo'; sesion: Sesion };

interface Contexto {
  estado: Estado;
  iniciarSesion: (correo: string, clave: string, recordarme: boolean) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<Contexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });

  useEffect(() => {
    let cancelado = false;
    let baja: (() => void) | undefined;
    try {
      baja = onAuthStateChanged(firebaseAuth(), (usuario) => {
        if (!usuario) {
          setEstado({ fase: 'sin-sesion' });
          return;
        }
        void usuario.getIdTokenResult().then((token) => {
          if (cancelado) return;
          const rol = token.claims['role'];
          const unidad = token.claims['unidad'];
          setEstado({
            fase: 'listo',
            sesion: {
              uid: usuario.uid,
              email: usuario.email ?? '',
              nombre: usuario.displayName ?? usuario.email ?? '',
              rol: rol === 'superadmin' || rol === 'usuario' ? rol : null,
              unidad: unidad === '771' || unidad === '772' ? unidad : null,
            },
          });
        });
      });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Error de configuración.';
      queueMicrotask(() => setEstado({ fase: 'error-config', mensaje }));
    }
    return () => {
      cancelado = true;
      baja?.();
    };
  }, []);

  const valor = useMemo<Contexto>(
    () => ({
      estado,
      iniciarSesion: async (correo, clave, recordarme) => {
        const auth = firebaseAuth();
        await setPersistence(auth, recordarme ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, correo.trim(), clave);
      },
      cerrarSesion: () => signOut(firebaseAuth()),
    }),
    [estado],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): Contexto {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}

/** Traduce los códigos de error de Firebase Auth a mensajes para la persona usuaria. */
export function mensajeErrorAuth(e: unknown): string {
  const codigo = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Correo o contraseña incorrectos.';
    case 'auth/user-disabled':
      return 'Esta cuenta está desactivada. Contacta al administrador.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Iniciar sesión por primera vez requiere internet.';
    default:
      return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
}
