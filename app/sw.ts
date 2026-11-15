import { defaultCache } from '@serwist/next/worker';
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// App shell en precache (JS, CSS, íconos y las pantallas) para abrir sin conexión; el resto se cachea al usarse.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: defaultCache,
});
serwist.addEventListeners();

interface CargaPush {
  notification?: { title?: string; body?: string };
  data?: { title?: string; body?: string; url?: string };
  fcm_options?: { link?: string };
  fcmOptions?: { link?: string };
}

// Avisos push (FCM). Sin SDK en el worker: el servidor manda `notification` y aquí se muestra.
self.addEventListener('push', (evento) => {
  let carga: CargaPush = {};
  try {
    carga = (evento.data?.json() as CargaPush | undefined) ?? {};
  } catch {
    carga = { notification: { body: evento.data?.text() } };
  }
  const titulo = carga.notification?.title ?? carga.data?.title ?? 'Stocky';
  const cuerpo = carga.notification?.body ?? carga.data?.body ?? '';
  const url = carga.fcm_options?.link ?? carga.fcmOptions?.link ?? carga.data?.url ?? '/hoy/';
  evento.waitUntil(
    self.registration.showNotification(titulo, { body: cuerpo, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url } }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data as { url?: string } | undefined)?.url ?? '/hoy/', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => v.url.startsWith(self.location.origin));
      if (abierta) return abierta.navigate(destino).then((v) => v?.focus());
      return self.clients.openWindow(destino);
    }),
  );
});
