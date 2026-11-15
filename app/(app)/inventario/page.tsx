'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FilaProducto } from '@/components/inventario/FilaProducto';
import { BotonesExportar } from '@/components/reportes/BotonesExportar';
import { Pantalla } from '@/components/layout/Pantalla';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth/AuthProvider';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import { coincide } from '@/lib/domain/busqueda';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { estadoStock } from '@/lib/domain/stock';
import { reporteBajos } from '@/lib/reports/construir';

type Filtro = 'todos' | 'bajos' | 'agotados';
const PAGINA = 50;

export default function Inventario() {
  const { estado } = useAuth();
  // `undefined` = cargando; `[]` = sin reportes importados.
  const [lista, setLista] = useState<Existencia[] | undefined>(undefined);
  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [visibles, setVisibles] = useState(PAGINA);
  const buscar = useDeferredValue(consulta);
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;

  useEffect(() => {
    if (!uid) return;
    return suscribirExistencias(uid, setLista);
  }, [uid]);

  const conteos = useMemo(() => {
    let bajos = 0;
    let agotados = 0;
    for (const p of lista ?? []) {
      const e = estadoStock(p);
      if (e === 'bajo') bajos++;
      else if (e === 'agotado') agotados++;
    }
    return { bajos, agotados };
  }, [lista]);

  const filtrada = useMemo(
    () =>
      (lista ?? []).filter((p) => {
        if (filtro !== 'todos' && estadoStock(p) !== (filtro === 'bajos' ? 'bajo' : 'agotado')) return false;
        return coincide(buscar, p.codigo, p.descripcion);
      }),
    [lista, buscar, filtro],
  );

  if (estado.fase !== 'listo') return null;

  const fechaReporte = lista && lista.length > 0 ? new Date(Math.max(...lista.map((p) => p.actualizadoEn.toMillis()))) : undefined;
  const chips: { id: Filtro; etiqueta: string }[] = [
    { id: 'todos', etiqueta: `Todos (${lista?.length ?? 0})` },
    { id: 'bajos', etiqueta: `Bajos (${conteos.bajos})` },
    { id: 'agotados', etiqueta: `Agotados (${conteos.agotados})` },
  ];

  return (
    <Pantalla titulo="Inventario">
      {lista === undefined && (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando inventario…
        </Card>
      )}

      {lista?.length === 0 && (
        <Card className="flex flex-col items-start gap-3">
          <p className="font-semibold">Aún no hay existencias</p>
          <p className="text-sm text-text-muted">Importa el reporte de existencias de despacho para ver tu inventario.</p>
          <Link href="/importar/" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-bg">
            <Upload aria-hidden className="size-4" />
            Importar reporte
          </Link>
        </Card>
      )}

      {lista && lista.length > 0 && (
        <>
          <div className="sticky top-12 z-10 -mx-4 flex flex-col gap-2 bg-bg/90 px-4 pb-2 backdrop-blur">
            <label className="relative block">
              <span className="sr-only">Buscar por código o nombre</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                inputMode="search"
                value={consulta}
                onChange={(e) => {
                  setConsulta(e.target.value);
                  setVisibles(PAGINA);
                }}
                placeholder="Código o nombre"
                className="min-h-11 w-full rounded-2xl bg-surface-2 pr-4 pl-10 text-text placeholder:text-text-muted"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por estado">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={filtro === c.id}
                  onClick={() => {
                    setFiltro(c.id);
                    setVisibles(PAGINA);
                  }}
                  className={`min-h-11 shrink-0 rounded-full px-4 text-sm transition duration-200 ${filtro === c.id ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          </div>

          {filtro === 'bajos' && conteos.bajos > 0 && (
            <section aria-label="Exportar bajos" className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
              <p className="text-sm">Lista de productos bajos ({conteos.bajos})</p>
              <BotonesExportar
                armar={() =>
                  reporteBajos(lista, fechaReporte ? hoyCostaRica(fechaReporte) : null, {
                    usuario: estado.sesion.nombre,
                    unidad: estado.sesion.unidad ?? '',
                    generadoEn: new Date(),
                  })
                }
              />
            </section>
          )}

          <Link href="/inventario/agotados/" className="inline-flex min-h-11 items-center rounded-2xl bg-surface-2 px-4 text-sm font-semibold text-accent">
            Registro de agotados
          </Link>

          <p className="text-xs text-text-muted">
            {filtrada.length} de {lista.length} productos
            {fechaReporte && <> · Reporte del {format(fechaReporte, "d 'de' MMM yyyy", { locale: es })}</>}
          </p>

          {filtrada.length === 0 ? (
            <Card className="text-center text-sm text-text-muted">Ningún producto coincide con la búsqueda.</Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtrada.slice(0, visibles).map((p) => (
                <FilaProducto key={p.codigo} p={p} />
              ))}
            </ul>
          )}

          {filtrada.length > visibles && (
            <button
              type="button"
              onClick={() => setVisibles((v) => v + PAGINA)}
              className="min-h-11 rounded-2xl bg-surface-2 text-sm font-semibold"
            >
              Mostrar más ({filtrada.length - visibles})
            </button>
          )}
        </>
      )}
    </Pantalla>
  );
}
