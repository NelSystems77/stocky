'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { mensajeErrorAuth, useAuth } from '@/lib/auth/AuthProvider';

const Esquema = z.object({
  correo: z.string().min(1, 'Escribe tu correo.').email('Correo no válido.'),
  clave: z.string().min(1, 'Escribe tu contraseña.'),
  recordarme: z.boolean(),
});
type Datos = z.infer<typeof Esquema>;

export default function Login() {
  const { estado, iniciarSesion } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(Esquema), defaultValues: { recordarme: true } });

  useEffect(() => {
    if (estado.fase === 'listo') router.replace('/hoy/');
  }, [estado.fase, router]);

  async function enviar(d: Datos) {
    setError(null);
    try {
      await iniciarSesion(d.correo, d.clave, d.recordarme);
    } catch (e) {
      setError(mensajeErrorAuth(e));
    }
  }

  const campo = 'min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-text placeholder:text-text-muted';

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface p-6">
        <header className="text-center">
          <p className="text-[10px] tracking-[0.3em] text-text-muted uppercase">NelSystems</p>
          <h1 className="text-3xl font-bold text-accent">Stocky</h1>
        </header>

        <label className="flex flex-col gap-1 text-sm">
          Correo
          <input type="email" autoComplete="username" inputMode="email" className={campo} {...register('correo')} />
          {errors.correo && <span className="text-xs text-critical">{errors.correo.message}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input type="password" autoComplete="current-password" className={campo} {...register('clave')} />
          {errors.clave && <span className="text-xs text-critical">{errors.clave.message}</span>}
        </label>

        <label className="flex min-h-11 items-center gap-2 text-sm text-text-muted">
          <input type="checkbox" className="size-5 accent-accent" {...register('recordarme')} />
          Recordarme
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-critical/10 p-3 text-sm text-critical">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>

        <p className="text-center text-xs text-text-muted">
          ¿Olvidaste tu contraseña? Pide al administrador que la restablezca.
        </p>
      </form>
    </main>
  );
}
