'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, BellOff, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SeccionFarmacia772 } from '@/components/ajustes/SeccionFarmacia772';
import { Pantalla } from '@/components/layout/Pantalla';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { guardarAjusteNotificacion, guardarFeriados, guardarMargenRiesgo, guardarUmbralesVencimiento, suscribirUsuario, type DatosUsuario } from '@/lib/db/usuario';
import { MARGEN_RIESGO_MAXIMO } from '@/lib/domain/riesgo';
import { MAX_DIAS_ALTA, MAX_DIAS_MEDIA, validarUmbralesVencimiento } from '@/lib/domain/vencimientos';
import { agregarFeriado, esFechaValida, feriadosPorAnio, quitarFeriado } from '@/lib/domain/feriados';
import type { FechaISO } from '@/lib/domain/types';
import type { AjustesNotificaciones } from '@/lib/domain/notificaciones';
import { activarNotificaciones, desactivarNotificaciones, notificacionesSoportadas, type ResultadoActivacion } from '@/lib/notificaciones';

const TIPOS: { clave: keyof AjustesNotificaciones; titulo: string; detalle: string }[] = [
  { clave: 'resumenManana', titulo: 'Resumen de las 7:00 a. m.', detalle: 'Tareas de hoy y pendientes de días anteriores.' },
  { clave: 'resumenMediodia', titulo: 'Resumen de las 12:00 m. d.', detalle: 'Lo que falta por hacer hoy.' },
  { clave: 'recordatorios', titulo: 'Recordatorio a la hora de cada tarea', detalle: 'Solo para las tareas que tienen hora.' },
  { clave: 'vencimientos', titulo: 'Lotes por vencer', detalle: 'A las 7:00 a. m.: cada día si hay lotes vencidos; una vez por semana si hay de prioridad alta.' },
  { clave: 'pedidosEnvios', titulo: 'Preparar envíos y pedidos', detalle: 'A las 7:00 a. m., según la anticipación de cada uno.' },
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
  const [nueva, setNueva] = useState('');
  const [margen, setMargen] = useState<string | null>(null);
  const [diasAlta, setDiasAlta] = useState<string | null>(null);
  const [diasMedia, setDiasMedia] = useState<string | null>(null);
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

  const feriados = datos.feriados;

  function guardar(lista: readonly FechaISO[], mensajeError: string) {
    if (!uid) return;
    void guardarFeriados(uid, lista).catch(() => mostrar(mensajeError, { tono: 'error' }));
  }

  function agregar() {
    if (!esFechaValida(nueva)) {
      mostrar('Elige una fecha válida.', { tono: 'error' });
      return;
    }
    if (feriados.includes(nueva)) {
      mostrar('Ese feriado ya está en la lista.', { tono: 'info' });
      return;
    }
    guardar(agregarFeriado(feriados, nueva), 'No se pudo guardar el feriado.');
    setNueva('');
  }

  function quitar(fecha: FechaISO) {
    guardar(quitarFeriado(feriados, fecha), 'No se pudo quitar el feriado.');
    mostrar('Feriado quitado.', {
      tono: 'info',
      accion: { etiqueta: 'Deshacer', alPulsar: () => guardar(agregarFeriado(quitarFeriado(feriados, fecha), fecha), 'No se pudo deshacer.') },
    });
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

      <section aria-label="Feriados" className="mt-8 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Feriados</h2>
        <p className="text-xs text-text-muted">
          En estas fechas no hay avisos ni tareas recurrentes, y «Posponer al próximo día laboral» las salta. Las tareas únicas conservan la fecha que elegiste.
        </p>
        <Card className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Agregar feriado
            <input
              type="date"
              value={nueva}
              disabled={!datos.existe}
              onChange={(e) => setNueva(e.target.value)}
              className="min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-text"
            />
          </label>
          <Button disabled={!datos.existe || !nueva} onClick={agregar}>
            Agregar
          </Button>
        </Card>

        {feriados.length === 0 ? (
          <p className="text-sm text-text-muted">Todavía no has agregado feriados.</p>
        ) : (
          feriadosPorAnio(feriados).map((g) => (
            <div key={g.anio} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-muted">{g.anio}</h3>
              <ul className="flex flex-col gap-2">
                {g.fechas.map((f) => (
                  <li key={f} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-1">
                    <span className="text-sm first-letter:uppercase">{format(parseISO(f), "EEEE d 'de' MMMM", { locale: es })}</span>
                    <button
                      type="button"
                      aria-label={`Quitar el feriado del ${format(parseISO(f), "d 'de' MMMM yyyy", { locale: es })}`}
                      onClick={() => quitar(f)}
                      className="grid size-11 place-items-center rounded-xl text-text-muted hover:text-critical focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section aria-label="Alertas de riesgo" className="mt-8 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Alertas de riesgo</h2>
        <Card className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Margen sobre el próximo ingreso (días hábiles)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MARGEN_RIESGO_MAXIMO}
              disabled={!datos.existe}
              value={margen ?? String(datos.margenRiesgo)}
              onChange={(e) => setMargen(e.target.value)}
              onBlur={() => {
                if (margen === null) return;
                const n = Number(margen);
                setMargen(null);
                if (!Number.isInteger(n) || n < 0 || n > MARGEN_RIESGO_MAXIMO) {
                  mostrar(`Escribe un número entero de 0 a ${MARGEN_RIESGO_MAXIMO}.`, { tono: 'error' });
                  return;
                }
                if (n !== datos.margenRiesgo) void guardarMargenRiesgo(uid, n).catch(() => mostrar('No se pudo guardar el ajuste.', { tono: 'error' }));
              }}
              className="min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-text"
            />
          </label>
          <p className="text-xs text-text-muted">
            Un producto está <strong>crítico</strong> si la existencia no alcanza hasta el próximo ingreso (segundo sábado), y <strong>en riesgo</strong> si alcanza pero le sobran menos de estos días. Por defecto, 7.
          </p>
        </Card>
      </section>

      <section aria-label="Alertas de vencimiento" className="mt-8 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Alertas de vencimiento</h2>
        <Card className="flex flex-col gap-3">
          {(
            [
              ['alta', 'Prioridad alta: faltan estos días o menos', diasAlta, setDiasAlta, MAX_DIAS_ALTA, datos.umbralesVencimiento.alta],
              ['media', 'Prioridad media: faltan estos días o menos', diasMedia, setDiasMedia, MAX_DIAS_MEDIA, datos.umbralesVencimiento.media],
            ] as const
          ).map(([clave, etiqueta, valor, poner, maximo, actual]) => (
            <label key={clave} className="flex flex-col gap-1 text-sm">
              {etiqueta}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={maximo}
                disabled={!datos.existe}
                value={valor ?? String(actual)}
                onChange={(e) => poner(e.target.value)}
                onBlur={() => {
                  if (diasAlta === null && diasMedia === null) return;
                  const alta = Number(diasAlta ?? datos.umbralesVencimiento.alta);
                  const media = Number(diasMedia ?? datos.umbralesVencimiento.media);
                  setDiasAlta(null);
                  setDiasMedia(null);
                  const r = validarUmbralesVencimiento(alta, media);
                  if (!r.ok) {
                    mostrar(r.error, { tono: 'error' });
                    return;
                  }
                  if (alta !== datos.umbralesVencimiento.alta || media !== datos.umbralesVencimiento.media) {
                    void guardarUmbralesVencimiento(uid, { alta, media }).catch(() => mostrar('No se pudo guardar el ajuste.', { tono: 'error' }));
                  }
                }}
                className="min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-text"
              />
            </label>
          ))}
          <p className="text-xs text-text-muted">
            Un lote con existencia entra en <strong>prioridad alta</strong> si le faltan {datos.umbralesVencimiento.alta} días o menos para vencer, y en <strong>prioridad media</strong> si le faltan {datos.umbralesVencimiento.media} o menos.
            Además, es de prioridad alta el que no se consumirá antes de vencer según el consumo diario. Por defecto, 30 y 90 días; la media debe ser mayor que la alta.
          </p>
        </Card>
      </section>

      {estado.fase === 'listo' && estado.sesion.unidad === '771' && estado.sesion.rol !== 'superadmin' && <SeccionFarmacia772 />}

      <section aria-label="Unidades de medida" className="mt-8 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Unidades de medida</h2>
        <Card className="flex flex-col gap-1 text-sm">
          <p>
            <span className="font-mono">CN</span> = 100 unidades (1.5 CN = 150 unidades).
          </p>
          <p className="text-text-muted">Las demás unidades (FC, TR, tubo, ampolla, frasco…) valen 1.</p>
        </Card>
      </section>
    </Pantalla>
  );
}
