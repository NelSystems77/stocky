import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stocky by NelSystems',
  description: 'Asistente de pendientes del Almacén Local 771',
};

export const viewport: Viewport = { themeColor: '#0B1220' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
