'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cerrarAgotados, confirmarAgotados, guardarNotas, suscribirAgotados } from '@/lib/db/agotados';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import {
  diasAgotado,
  proponerAgotados,
  registrosACerrar,
  separarRegistros,
  type ProductoStock,
  type RegistroAgotado,
} from '@/lib/domain/agotados';
import { hoyCostaRica } from '@/lib/domain/calendario';
import type { FechaISO } from '@/lib/domain/types';

const fecha = (f: FechaISO) => format(parseISO(f), "d 'de' MMM yyyy", { locale: es });
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

function aProducto(e: Existencia): ProductoStock {
  return {
    codigo: e.codigo,
    cuota: e.cuota,
    cuotaMinima: e.cuotaMinima,
    existencia: e.existencia,
    fechaReporte: hoyCostaRica(e.actualizadoEn.toDate()),
  };
}

export default function Agotados() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const [existencias, setExistencias] = useState<Existencia[] | undefined>(undefined);
  const [registros, setRegistros] = useState<RegistroAgotado[] | undefined>(undefined);
  const hoy = hoyCostaRica();
  const cerrando = useRef(new Set<string>());

  useEffect(() => {
    if (!uid) return;
    const bajas = [suscribirExistencias(uid, setExistencias), suscribirAgotados(uid, setRegistros)];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  const productos = useMemo(() => (existencias ?? []).map(aProducto), [existencias]);
  const porCodigo = useMemo(() => new Map((existencias ?? []).map((e) => [e.codigo, e])), [existencias]);
  const propuestos = useMemo(() => proponerAgotados(productos, registros ?? []), [productos, registros]);
  const { activos, cerrados } = useMemo(() => separarRegistros(registros ?? []), [registros]);

  // Los registros abiertos se cierran solos cuando un reporte posterior trae existencia (idempotente).
  useEffect(() => {
    if (!uid || !registros) return;
    const pendientes = registrosACerrar(productos, registros).filter((c) => !cerrando.current.has(c.id));
    if (pendientes.length === 0) return;
    pendientes.forEach((c) => cerrando.current.add(c.id));
    void cerrarAgotados(uid, pendientes).catch(() => {
      pendientes.forEach((c) => cerrando.current.delete(c.id));
      mostrar('No se pudieron cerrar algunos agotados.', { tono: 'error' });
    });
  }, [uid, productos, registros, mostrar]);

  if (!uid) return null;

  function confirmar(items: ProductoStock[]) {
    if (!uid || items.length === 0) return;
    void confirmarAgotados(
      uid,
      items.map((p) => ({ codigo: p.codigo, fechaAgotado: p.fechaReporte })),
    ).catch(() => mostrar('No se pudo guardar el registro.', { tono: 'error' }));
    mostrar(items.length === 1 ? 'Agotado registrado.' : `${items.length} agotados registrados.`, { tono: 'ok' });
  }

  function guardar(id: string, notas: string) {
    if (!uid) return;
    void guardarNotas(uid, id, notas).catch(() => mostrar('No se pudo guardar la observación.', { tono: 'error' }));
  }

  const nombre = (codigo: string) => porCodigo.get(codigo)?.descripcion ?? 'Producto fuera del último reporte';

  return (
    <Pantalla titulo="Agotados">
      <Link href="/inventario/" className="-mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Inventario
      </Link>

      {existencias === undefined || registros === undefined ? (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando…
        </Card>
      ) : (
        <>
          {existencias.length === 0 && (
            <Card className="text-sm text-text-muted">Importa un reporte de existencias para detectar agotados.</Card>
          )}

          {propuestos.length > 0 && (
            <section aria-label="Por confirmar" className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Por confirmar ({propuestos.length})</h2>
                <Button variante="secundario" onClick={() => confirmar(propuestos)}>
                  Confirmar todos
                </Button>
              </div>
              <p className="text-xs text-text-muted">Productos con cuota y existencia 0 en el último reporte.</p>
              <ul className="flex flex-col gap-2">
                {propuestos.map((p) => (
                  <li key={p.codigo} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-text-muted">{p.codigo}</span>
                      <span className="block truncate text-sm">{nombre(p.codigo)}</span>
                      <span className="block text-xs text-text-muted">Reporte del {fecha(p.fechaReporte)}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Confirmar agotado ${p.codigo}`}
                      onClick={() => confirmar([p])}
                      className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-bg"
                    >
                      <Check aria-hidden className="size-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Agotados activos" className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Activos ({activos.length})</h2>
            {activos.length === 0 ? (
              <p className="text-sm text-text-muted">No hay agotados registrados.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {activos.map((r) => (
                  <FilaRegistro key={r.id} r={r} nombre={nombre(r.codigo)} hoy={hoy} alGuardar={(t) => guardar(r.id, t)} />
                ))}
              </ul>
            )}
          </section>

          {cerrados.length > 0 && (
            <section aria-label="Reabastecidos" className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Reabastecidos ({cerrados.length})</h2>
              <ul className="flex flex-col gap-2">
                {cerrados.map((r) => (
                  <FilaRegistro key={r.id} r={r} nombre={nombre(r.codigo)} hoy={hoy} alGuardar={(t) => guardar(r.id, t)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Pantalla>
  );
}

function FilaRegistro({ r, nombre, hoy, alGuardar }: { r: RegistroAgotado; nombre: string; hoy: FechaISO; alGuardar: (notas: string) => void }) {
  const [notas, setNotas] = useState(r.notas);
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
      <span className="block font-mono text-xs text-text-muted">{r.codigo}</span>
      <span className="block text-sm">{nombre}</span>
      <p className="text-xs text-text-muted">
        Agotado desde el {fecha(r.fechaAgotado)}
        {r.fechaIngreso === null ? (
          <>
            {' · '}
            <span className="font-semibold text-critical">{dias(diasAgotado(r, hoy))} agotado</span>
          </>
        ) : (
          <>
            {' · Ingresó el '}
            {fecha(r.fechaIngreso)} · {dias(diasAgotado(r, hoy))} agotado
          </>
        )}
      </p>
      <label className="flex flex-col gap-1 text-xs text-text-muted">
        Observaciones
        <textarea
          value={notas}
          maxLength={500}
          rows={2}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={() => notas !== r.notas && alGuardar(notas)}
          className="w-full rounded-xl bg-surface-2 p-2 text-sm text-text"
        />
      </label>
    </li>
  );
}
