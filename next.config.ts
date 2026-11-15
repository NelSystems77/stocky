import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

// Rutas que se precargan para que la app abra sin conexión aunque no se hayan visitado antes.
const PANTALLAS = ['/', '/login/', '/hoy/', '/inventario/', '/agenda/', '/registros/', '/mas/', '/reportes/', '/importar/', '/ajustes/'];
const revision = process.env['GITHUB_SHA'] ?? String(Date.now());

const conSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  additionalPrecacheEntries: PANTALLAS.map((url) => ({ url, revision })),
});

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default conSerwist(config);
