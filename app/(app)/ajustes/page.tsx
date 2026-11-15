'use client';

import { Bell, BellOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { guardarAjusteNotificacion, suscribirUsuario, type DatosUsuario } from '@/lib/db/usuario';
import type { AjustesNotificaciones } from '@/lib/domain/notificaciones';
import { activarNotificaciones, desactivarNotificaciones, notificacionesSoportadas, type ResultadoActivacion } from '@/lib/notificaciones';

const TIPOS: { clave: keyof AjustesNotificaciones; titulo: string; detalle: string }[] = [
  { clave: 'resumenManana', titulo: 'Resumen de las 7:00 a. m.', detalle: 'Tareas de hoy y pendientes de días anteriores.' },
  { clave: 'resumenMediodia', titulo: 'Resumen de las 12:00 m. d.', detalle: 'Lo que falta por hacer hoy.' },
  { clave: 'recordatorios', titulo: 'Recordatorio a la hora de cada tarea', detalle: 'Solo para las tareas que tienen hora.' },
];

const MENSAJES: Record<Exclude<ResultadoActivacion, 'ok'>, string> = {
  denegado: 'Bloqueaste las notificaciones. Para activarlas, permítelas en los ajustes del navegador para este sitio.',
  'no-soportado': 'Este navegador no admite notificaciones. En iPhone, instala Stocky en la pantalla de inicio (iOS 16.4 o superior).',
  'sin-clave': 'Falta configurar la clave de notificaciones (VAPID) de la app. Avisa al administrador.',
  'sin-red': 'Activar las notificaciones requiere conexión a internet.',
  error: 'No se pudieron activar las notificaciones. Inténtalo de nuevo.',
};

export default function Ajustes() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const [datos, setDatos] = useState<DatosUsuario | undefined>(undefined);
  const [soportado, setSoportado] = useState<boolean | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;

  useEffect(() => {
    if (!uid) return;
    void notificacionesSoportadas().then(setSoportado);
    return suscribirUsuario(uid, setDatos);
  }, [uid]);

  if (!uid || datos === undefined) return <Pantalla titulo="Ajustes" />;

  const permiso = typeof Notification === 'undefined' ? 'default' : Notification.permission;
  const activas = soportado === true && permiso === 'granted' && datos.tokens.length > 0;

  async function activar() {
    if (!uid) return;
    setOcupado(true);
    const r = await activarNotificaciones(uid);
    setOcupado(false);
    mostrar(r === 'ok' ? 'Notificaciones activadas en este dispositivo.' : MENSAJES[r], { tono: r === 'ok' ? 'ok' : 'error' });
  }

  async function desactivar() {
    if (!uid) return;
    setOcupado(true);
    await desactivarNotificaciones(uid).catch(() => undefined);
    setOcupado(false);
    mostrar('Notificaciones desactivadas en este dispositivo.', { tono: 'info' });
  }

  return (
    <Pantalla titulo="Ajustes">
      <section aria-label="Notificaciones" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Notificaciones</h2>

        {!datos.existe && (
          <Card className="text-sm text-warning">
            Tu cuenta todavía no está lista para recibir notificaciones. Pídele al administrador que la complete.
          </Card>
        )}

        <Card className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm">
            {activas ? <Bell aria-hidden className="size-5 text-ok" /> : <BellOff aria-hidden className="size-5 text-text-muted" />}
            {activas ? 'Activadas en este dispositivo' : 'Desactivadas en este dispositivo'}
          </p>
          {activas ? (
            <Button variante="secundario" disabled={ocupado} onClick={() => void desactivar()}>
              Desactivar en este dispositivo
            </Button>
          ) : (
            <Button disabled={ocupado || !datos.existe} onClick={() => void activar()}>
              Activar notificaciones
            </Button>
          )}
          {soportado === false && <p className="text-xs text-text-muted">{MENSAJES['no-soportado']}</p>}
          {permiso === 'denied' && <p className="text-xs text-warning">{MENSAJES.denegado}</p>}
        </Card>

        <ul className="flex flex-col gap-2">
          {TIPOS.map((t) => (
            <li key={t.clave}>
              <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2">
                <span>
                  <span className="block text-sm">{t.titulo}</span>
                  <span className="block text-xs text-text-muted">{t.detalle}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="size-6 shrink-0 accent-accent"
                  checked={datos.notificaciones[t.clave]}
                  disabled={!datos.existe}
                  onChange={(e) => {
                    void guardarAjusteNotificacion(uid, t.clave, e.target.checked).catch(() =>
                      mostrar('No se pudo guardar el ajuste.', { tono: 'error' }),
                    );
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-muted">
          Solo se avisa en días laborables (lunes a viernes y el segundo sábado del mes). Los demás avisos, como envíos a los EBAIS, llegan con sus módulos.
        </p>
      </section>
    </Pantalla>
  );
}
