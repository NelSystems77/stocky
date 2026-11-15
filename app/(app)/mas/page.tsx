'use client';

import { FileText, LogOut, Settings, ShieldCheck, Upload, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Pantalla } from '@/components/layout/Pantalla';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth/AuthProvider';

const ENLACES: { href: string; etiqueta: string; icono: LucideIcon }[] = [
  { href: '/reportes/', etiqueta: 'Reportes', icono: FileText },
  { href: '/importar/', etiqueta: 'Importar reporte', icono: Upload },
  { href: '/ajustes/', etiqueta: 'Ajustes', icono: Settings },
];

export default function Mas() {
  const { estado, cerrarSesion } = useAuth();
  if (estado.fase !== 'listo') return null;
  return (
    <Pantalla titulo="Más">
      <Card className="text-sm">
        <p className="font-semibold">{estado.sesion.nombre}</p>
        <p className="text-text-muted">
          {estado.sesion.rol === 'superadmin' ? 'SuperAdmin NelSystems' : `Unidad ${estado.sesion.unidad ?? '—'}`}
        </p>
      </Card>
      <nav className="flex flex-col gap-2">
        {(estado.sesion.rol === 'superadmin' ? [{ href: '/admin/', etiqueta: 'Administración de cuentas', icono: ShieldCheck }, ...ENLACES] : ENLACES).map(({ href, etiqueta, icono: Icono }) => (
          <Link key={href} href={href} className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface px-4 text-sm">
            <Icono aria-hidden className="size-5 text-text-muted" />
            {etiqueta}
          </Link>
        ))}
      </nav>
      <Button variante="secundario" onClick={() => void cerrarSesion()}>
        <LogOut aria-hidden className="size-4" />
        Cerrar sesión
      </Button>
    </Pantalla>
  );
}
