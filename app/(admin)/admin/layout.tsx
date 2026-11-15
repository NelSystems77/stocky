'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Splash } from '@/components/layout/Splash';
import { SyncIndicator } from '@/components/layout/SyncIndicator';
import { useAuth } from '@/lib/auth/AuthProvider';

/** Solo el superadmin entra aquí. Las reglas de Firestore y las Functions lo vuelven a exigir en el servidor. */
export default function LayoutAdmin({ children }: { children: ReactNode }) {
  const { estado, cerrarSesion } = useAuth();
  const router = useRouter();
  const permitido = estado.fase === 'listo' && estado.sesion.rol === 'superadmin';

  useEffect(() => {
    if (estado.fase === 'sin-sesion') router.replace('/login/');
    else if (estado.fase === 'listo' && estado.sesion.rol !== 'superadmin') router.replace('/hoy/');
  }, [estado, router]);

  if (!permitido) return <Splash />;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-bg/80 px-4 py-2 backdrop-blur">
        <span className="font-bold text-accent">Stocky · Administración</span>
        <div className="flex items-center gap-3">
          <SyncIndicator />
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            aria-label="Cerrar sesión"
            className="grid size-11 place-items-center rounded-full text-text-muted hover:bg-surface-2"
          >
            <LogOut aria-hidden className="size-5" />
          </button>
        </div>
      </header>
      <main className="pb-12">{children}</main>
    </div>
  );
}
