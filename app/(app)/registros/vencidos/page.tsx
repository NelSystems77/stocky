'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { FormularioVencido } from '@/components/registros/FormularioVencido';
import { SelectorMes } from '@/components/registros/SelectorMes';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { borrarVencido, crearVencido, restaurarVencido, suscribirVencidos } from '@/lib/db/vencidos';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { formatearEnUD, formatearNumero } from '@/lib/domain/formato';
import { ordenarVencidos, totalesVencidos, vencidosDelMes, type EntradaVencido, type RegistroVencido } from '@/lib/domain/vencidos';

const fecha = (f: string) => format(parseISO(f), "d 'de' MMM yyyy", { locale: es });

export default function Vencidos() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const [registros, setRegistros] = useState<RegistroVencido[] | undefined>(undefined);
  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [formulario, setFormulario] = useState(false);
  const [mes, setMes] = useState(() => hoyCostaRica().slice(0, 7));
  const mesActual = hoyCostaRica().slice(0, 7);

  useEffect(() => {
    if (!uid) return;
    const bajas = [suscribirVencidos(uid, setRegistros), suscribirExistencias(uid, setExistencias)];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  const porCodigo = useMemo(() => new Map(existencias.map((e) => [e.codigo, e])), [existencias]);
  const delMes = useMemo(() => ordenarVencidos(vencidosDelMes(registros ?? [], mes)), [registros, mes]);
  const totales = useMemo(() => totalesVencidos(delMes), [delMes]);

  if (!uid) return null;

  function guardar(e: EntradaVencido) {
    if (!uid) return;
    void crearVencido(uid, e).catch(() => mostrar('No se pudo guardar el vencido.', { tono: 'error' }));
    mostrar('Vencido registrado.', { tono: 'ok' });
  }

  function borrar(r: RegistroVencido) {
    if (!uid) return;
    void borrarVencido(uid, r.id).catch(() => mostrar('No se pudo borrar el registro.', { tono: 'error' }));
    mostrar('Registro borrado.', {
      accion: { etiqueta: 'Deshacer', alPulsar: () => void restaurarVencido(uid, r).catch(() => mostrar('No se pudo restaurar.', { tono: 'error' })) },
    });
  }

  const cantidad = (r: RegistroVencido) => {
    const ud = porCodigo.get(r.codigo)?.ud;
    return ud ? formatearEnUD(r.cantidad, ud) : `${formatearNumero(r.cantidad)} u.`;
  };

  return (
    <Pantalla titulo="Vencidos">
      <Link href="/registros/" className="-mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Registros
      </Link>

      <div className="flex items-center justify-between gap-2">
        <SelectorMes mes={mes} mesActual={mesActual} alCambiar={setMes} />
        <Button onClick={() => setFormulario(true)}>
          <Plus aria-hidden className="size-4" />
          Registrar
        </Button>
      </div>

      {registros === undefined ? (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando…
        </Card>
      ) : (
        <>
          <Card className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-semibold">{totales.registros}</p>
              <p className="text-xs text-text-muted">Lotes</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{formatearNumero(totales.unidades)}</p>
              <p className="text-xs text-text-muted">Unidades</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{totales.productos}</p>
              <p className="text-xs text-text-muted">Productos</p>
            </div>
          </Card>

          {delMes.length === 0 ? (
            <p className="text-sm text-ok">Sin vencidos registrados en este mes. Esa es la meta.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {delMes.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 rounded-2xl bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-text-muted">{r.codigo}</span>
                      <span className="block text-sm">{porCodigo.get(r.codigo)?.descripcion ?? 'Producto fuera del último reporte'}</span>
                    </span>
                    <button type="button" aria-label={`Borrar vencido ${r.codigo}`} onClick={() => borrar(r)} className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted hover:bg-surface-2">
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                  <p className="text-xs text-text-muted">
                    Lote {r.lote} · venció el {fecha(r.fechaVencimiento)} · <span className="font-semibold text-text">{cantidad(r)}</span>
                    {r.origen === 'reporte' && ' · del reporte'}
                  </p>
                  {r.notas && <p className="text-xs text-text-muted">{r.notas}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-text-muted">El acta del vencido se hace en SIFA. Aquí queda el registro para el resumen mensual.</p>
        </>
      )}

      <FormularioVencido abierta={formulario} alCerrar={() => setFormulario(false)} existencias={existencias} alGuardar={guardar} />
    </Pantalla>
  );
}
