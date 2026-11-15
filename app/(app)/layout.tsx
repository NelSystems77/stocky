'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BotonChango } from '@/components/chango/BotonChango';
import { BarraInferior, MenuLateral } from '@/components/layout/Navegacion';
import { Splash } from '@/components/layout/Splash';
import { SyncIndicator } from '@/components/layout/SyncIndicator';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function LayoutApp({ children }: { children: ReactNode }) {
  const { estado } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (estado.fase === 'sin-sesion') router.replace('/login/');
  }, [estado.fase, router]);

  if (estado.fase !== 'listo') return <Splash />;

  return (
    <div className="flex min-h-dvh">
      <MenuLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-bg/80 px-4 py-2 backdrop-blur">
          <span className="font-bold text-accent lg:invisible">Stocky</span>
          <SyncIndicator />
        </header>
        <main className="flex-1 pb-24 lg:pb-8">{children}</main>
      </div>
      <BarraInferior />
      <BotonChango />
    </div>
  );
}
