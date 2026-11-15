'use client';

import { KeyRound, Plus, Power, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HojaConfirmar, HojaCredenciales, HojaModulos, HojaNuevaCuenta, type Credenciales, type DatosCuenta } from '@/components/admin/HojasCuenta';
import { Pantalla } from '@/components/layout/Pantalla';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { suscribirCuentas, type Cuenta, type Modulo } from '@/lib/db/cuentas';
import { useEstadoSync } from '@/lib/db/sync';
import { generarClave } from '@/lib/domain/clave';
import { gestionarCuentas, habilitarModulos, mensajeErrorCuentas } from '@/lib/functions/cuentas';

type Pendiente = { tipo: 'activar'; cuenta: Cuenta } | { tipo: 'clave'; cuenta: Cuenta };

export default function Administracion() {
  const { mostrar } = useToast();
  const { online } = useEstadoSync();
  // `undefined` = cargando; `null` = no se pudo leer.
  const [cuentas, setCuentas] = useState<Cuenta[] | null | undefined>(undefined);
  const [creando, setCreando] = useState(false);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [confirmando, setConfirmando] = useState<Pendiente | null>(null);
  const [modulos, setModulos] = useState<Cuenta | null>(null);

  useEffect(() => suscribirCuentas(setCuentas, () => setCuentas(null)), []);

  /** Ejecuta una acción de cuentas y traduce el error. Nada de esto funciona sin conexión. */
  async function ejecutar(accion: () => Promise<void>, ok: string): Promise<boolean> {
    try {
      await accion();
      mostrar(ok, { tono: 'ok' });
      return true;
    } catch (e) {
      mostrar(mensajeErrorCuentas(e), { tono: 'error' });
      return false;
    }
  }

  async function crear(d: DatosCuenta) {
    const ok = await ejecutar(() => gestionarCuentas({ accion: 'crear', ...d }), 'Cuenta creada.');
    if (ok) setCredenciales({ nombre: d.nombre, email: d.email.trim().toLowerCase(), password: d.password });
  }

  async function nuevaClave(c: Cuenta) {
    const password = generarClave();
    const ok = await ejecutar(() => gestionarCuentas({ accion: 'nuevaClave', uid: c.uid, password }), 'Contraseña nueva generada.');
    if (ok) setCredenciales({ nombre: c.nombre, email: c.email, password });
  }

  const requiereRed = !online;

  return (
    <Pantalla titulo="Cuentas">
      {requiereRed && (
        <p role="status" className="rounded-2xl bg-warning/10 p-3 text-sm text-warning">
          Sin conexión: crear y gestionar cuentas necesita internet.
        </p>
      )}

      <Button className="self-start" disabled={requiereRed} onClick={() => setCreando(true)}>
        <Plus aria-hidden className="size-4" />
        Nueva cuenta
      </Button>

      {cuentas === undefined && (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando cuentas…
        </Card>
      )}
      {cuentas === null && <Card className="text-sm text-critical">No se pudieron leer las cuentas.</Card>}
      {cuentas?.length === 0 && <Card className="text-sm text-text-muted">Aún no hay cuentas. Crea la del 771 para empezar.</Card>}

      <ul className="flex flex-col gap-2">
        {cuentas?.map((c) => (
          <li key={c.uid} className={`flex flex-col gap-3 rounded-2xl bg-surface p-4 ${c.activo ? '' : 'opacity-70'}`}>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.nombre}</span>
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted">{c.unidad}</span>
                {!c.activo && <span className="rounded-md bg-critical/15 px-1.5 py-0.5 text-[10px] font-semibold text-critical">Desactivada</span>}
              </p>
              <p className="truncate text-sm text-text-muted">{c.email}</p>
              {c.unidad === '772' && (
                <p className="text-xs text-text-muted">
                  Módulos extra: {c.modulosHabilitados.length > 0 ? c.modulosHabilitados.join(', ') : 'ninguno'}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variante="secundario" disabled={requiereRed} onClick={() => setConfirmando({ tipo: 'clave', cuenta: c })}>
                <KeyRound aria-hidden className="size-4" />
                Nueva contraseña
              </Button>
              {c.unidad === '772' && (
                <Button variante="secundario" disabled={requiereRed} onClick={() => setModulos(c)}>
                  <SlidersHorizontal aria-hidden className="size-4" />
                  Módulos
                </Button>
              )}
              <Button variante="fantasma" disabled={requiereRed} onClick={() => setConfirmando({ tipo: 'activar', cuenta: c })}>
                <Power aria-hidden className="size-4" />
                {c.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <HojaNuevaCuenta abierta={creando} alCerrar={() => setCreando(false)} alCrear={crear} />
      <HojaCredenciales credenciales={credenciales} alCerrar={() => setCredenciales(null)} />
      <HojaModulos
        cuenta={modulos}
        alCerrar={() => setModulos(null)}
        alGuardar={async (c: Cuenta, m: Modulo[]) => {
          await ejecutar(() => habilitarModulos(c.uid, m), 'Módulos actualizados.');
        }}
      />
      <HojaConfirmar
        abierta={confirmando !== null}
        alCerrar={() => setConfirmando(null)}
        titulo={confirmando?.tipo === 'clave' ? 'Generar contraseña nueva' : confirmando?.cuenta.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
        mensaje={
          confirmando?.tipo === 'clave'
            ? `Se cerrará la sesión de ${confirmando.cuenta.nombre} en todos sus dispositivos y la contraseña anterior dejará de servir.`
            : confirmando?.cuenta.activo
              ? `${confirmando.cuenta.nombre} no podrá entrar a Stocky mientras esté desactivada. Sus datos no se borran.`
              : `${confirmando?.cuenta.nombre ?? ''} podrá volver a entrar a Stocky.`
        }
        etiqueta={confirmando?.tipo === 'clave' ? 'Generar' : confirmando?.cuenta.activo ? 'Desactivar' : 'Activar'}
        alConfirmar={() => {
          const c = confirmando;
          if (!c) return;
          if (c.tipo === 'clave') void nuevaClave(c.cuenta);
          else
            void ejecutar(
              () => gestionarCuentas({ accion: 'activar', uid: c.cuenta.uid, activo: !c.cuenta.activo }),
              c.cuenta.activo ? 'Cuenta desactivada.' : 'Cuenta activada.',
            );
        }}
      />
    </Pantalla>
  );
}
