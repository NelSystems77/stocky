'use client';

import { useEffect, useState } from 'react';
import { HojaModulos } from '@/components/admin/HojasCuenta';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { MODULOS, type Cuenta, type Modulo } from '@/lib/db/cuentas';
import { habilitarModulos, listarCuentas772, mensajeErrorCuentas, type CuentaFarmacia } from '@/lib/functions/cuentas';

/** Ajustes del 771: qué módulos extra puede usar la farmacia 772. Requiere conexión (la lista y el cambio pasan por el servidor). */
export function SeccionFarmacia772() {
  const { mostrar } = useToast();
  // `undefined` = cargando; `null` = no se pudo cargar (sin conexión u otro error).
  const [cuentas, setCuentas] = useState<CuentaFarmacia[] | null | undefined>(undefined);
  const [editando, setEditando] = useState<Cuenta | null>(null);

  useEffect(() => {
    let vigente = true;
    listarCuentas772().then(
      (c) => vigente && setCuentas(c),
      () => vigente && setCuentas(null),
    );
    return () => {
      vigente = false;
    };
  }, []);

  async function guardar(c: Cuenta, modulos: Modulo[]) {
    try {
      await habilitarModulos(c.uid, modulos);
      setCuentas((l) => l?.map((x) => (x.uid === c.uid ? { ...x, modulosHabilitados: modulos } : x)));
      mostrar('Módulos actualizados.', { tono: 'ok' });
    } catch (e) {
      mostrar(mensajeErrorCuentas(e), { tono: 'error' });
    }
  }

  const etiqueta = (id: string) => MODULOS.find(([m]) => m === id)?.[1] ?? id;

  return (
    <section aria-label="Farmacia 772" className="mt-8 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Farmacia 772</h2>
      <Card className="flex flex-col gap-3 text-sm">
        <p className="text-text-muted">La farmacia siempre ve Tareas, Agotados, Vencimientos y Reportes. Aquí habilitas lo demás.</p>
        {cuentas === undefined && (
          <p role="status" className="animate-pulse text-text-muted">
            Cargando…
          </p>
        )}
        {cuentas === null && <p className="text-warning">No se pudo cargar la cuenta de la farmacia. Necesitas conexión a internet.</p>}
        {cuentas?.length === 0 && <p className="text-text-muted">Todavía no hay una cuenta de la farmacia 772.</p>}
        {cuentas && cuentas.length > 0 && (
          <ul className="flex flex-col gap-2">
            {cuentas.map((c) => (
              <li key={c.uid} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {c.nombre}
                    {!c.activo && <span className="ml-2 text-xs font-normal text-warning">desactivada</span>}
                  </span>
                  <span className="block text-xs text-text-muted">
                    Módulos extra: {c.modulosHabilitados.length > 0 ? c.modulosHabilitados.map(etiqueta).join(', ') : 'ninguno'}
                  </span>
                </span>
                <Button
                  variante="secundario"
                  onClick={() => setEditando({ uid: c.uid, nombre: c.nombre, email: '', unidad: '772', activo: c.activo, modulosHabilitados: c.modulosHabilitados })}
                >
                  Módulos
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <HojaModulos cuenta={editando} alCerrar={() => setEditando(null)} alGuardar={guardar} />
    </section>
  );
}
