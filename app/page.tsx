'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Splash } from '@/components/layout/Splash';
import { useAuth } from '@/lib/auth/AuthProvider';

const SPLASH_MS = 1200;

/** Splash NelSystems → login (solo sin sesión) → Hoy. */
export default function Inicio() {
  const { estado } = useAuth();
  const router = useRouter();
  const [splashListo, setSplashListo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashListo(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const destino = estado.fase === 'listo' ? (estado.sesion.rol === 'superadmin' ? '/admin/' : '/hoy/') : null;

  useEffect(() => {
    if (!splashListo) return;
    if (destino) router.replace(destino);
    else if (estado.fase === 'sin-sesion') router.replace('/login/');
  }, [splashListo, destino, estado.fase, router]);

  if (estado.fase === 'error-config') {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <p className="max-w-sm text-sm text-critical">{estado.mensaje}</p>
      </main>
    );
  }
  return <Splash />;
}
