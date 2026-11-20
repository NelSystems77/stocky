'use client';

import { addMonths, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, PackageCheck, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { esSegundoSabado, hoyCostaRica, inicioSemana, rangoCuadriculaMes, sumarDias } from '@/lib/domain/calendario';
import { estaCerrada, ETIQUETA_ESTADO, ocurrenciasProgramadas, type OcurrenciaProgramada, type Programado, type Seguimiento } from '@/lib/domain/pedidosEnvios';
import { estaAbierta, ocurrencias, type Cumplimiento, type Ocurrencia, type Tarea } from '@/lib/domain/tareas';
import type { FechaISO } from '@/lib/domain/types';
import { useFeriados } from '@/lib/tareas/useFeriados';

type Vista = 'dia' | 'semana' | 'mes';
const VISTAS: [Vista, string][] = [
  ['dia', 'Día'],
  ['semana', 'Semana'],
  ['mes', 'Mes'],
];
const ENCABEZADO_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const fmt = (f: FechaISO, patron: string) => format(parseISO(f), patron, { locale: es });
const iso = (d: Date) => format(d, 'yyyy-MM-dd');

function dias(desde: FechaISO, hasta: FechaISO): FechaISO[] {
  const lista: FechaISO[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) lista.push(f);
  return lista;
}

function Item({ o }: { o: Ocurrencia }) {
  const cerrada = o.estado === 'hecha' || o.estado === 'descartada';
  return (
    <li className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
      <span className={`min-w-0 flex-1 truncate ${cerrada ? 'text-text-muted line-through' : ''}`}>{o.titulo}</span>
      {o.hora && <span className="shrink-0 text-xs text-text-muted">{o.hora}</span>}
      {o.estado === 'hecha' && <span className="shrink-0 text-xs text-ok">Hecha</span>}
      {o.estado === 'descartada' && <span className="shrink-0 text-xs text-text-muted">Descartada</span>}
      {o.estado === 'pospuesta' && <span className="shrink-0 text-xs text-info">Pospuesta</span>}
    </li>
  );
}

function ItemProgramado({ o }: { o: OcurrenciaProgramada }) {
  const Icono = o.clase === 'envio' ? Send : PackageCheck;
  const cerrada = estaCerrada(o);
  return (
    <li className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
      <Icono aria-hidden className="size-4 shrink-0 text-text-muted" />
      <span className={`min-w-0 flex-1 truncate ${cerrada ? 'text-text-muted line-through' : ''}`}>{o.nombre}</span>
      {o.estado !== 'pendiente' && <span className={`shrink-0 text-xs ${cerrada ? 'text-ok' : 'text-info'}`}>{ETIQUETA_ESTADO[o.estado]}</span>}
    </li>
  );
}

function ListaDia({
  fecha,
  items,
  programadas,
  conTitulo,
}: {
  fecha: FechaISO;
  items: Ocurrencia[];
  programadas: OcurrenciaProgramada[];
  conTitulo: boolean;
}) {
  const ingreso = esSegundoSabado(fecha);
  return (
    <section aria-label={fmt(fecha, "EEEE d 'de' MMMM")} className="flex flex-col gap-1.5">
      {conTitulo && <h3 className="text-sm font-semibold first-letter:uppercase">{fmt(fecha, "EEEE d 'de' MMMM")}</h3>}
      {ingreso && (
        <p className="flex items-center gap-2 rounded-xl bg-info/10 px-3 py-2 text-sm text-info">
          <PackageCheck aria-hidden className="size-4" />
          Ingreso de mercadería
        </p>
      )}
      {items.length === 0 && programadas.length === 0 && !ingreso && <p className="text-sm text-text-muted">Sin tareas.</p>}
      {(items.length > 0 || programadas.length > 0) && (
        <ul className="flex flex-col gap-1.5">
          {programadas.map((o) => (
            <ItemProgramado key={`${o.programadoId}_${o.fecha}`} o={o} />
          ))}
          {items.map((o) => (
            <Item key={`${o.tareaId}_${o.fechaOrigen}`} o={o} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface PropsCalendario {
  tareas: Tarea[];
  cumplimientos: Cumplimiento[];
  /** Pedidos y envíos del 771 (vacío para quien no los tiene). */
  programados?: Programado[];
  seguimientos?: Seguimiento[];
}

const SIN_PROGRAMADOS: Programado[] = [];
const SIN_SEGUIMIENTOS: Seguimiento[] = [];

export function Calendario({ tareas, cumplimientos, programados = SIN_PROGRAMADOS, seguimientos = SIN_SEGUIMIENTOS }: PropsCalendario) {
  const hoy = hoyCostaRica();
  const feriados = useFeriados();
  const [vista, setVista] = useState<Vista>('mes');
  const [ref, setRef] = useState<FechaISO>(hoy);
  const [sel, setSel] = useState<FechaISO>(hoy);

  const [anio, mes] = ref.split('-').map(Number) as [number, number];
  const { desde, hasta } =
    vista === 'dia'
      ? { desde: ref, hasta: ref }
      : vista === 'semana'
        ? { desde: inicioSemana(ref), hasta: sumarDias(inicioSemana(ref), 6) }
        : rangoCuadriculaMes(anio, mes);

  const porDia = useMemo(() => {
    const mapa = new Map<FechaISO, Ocurrencia[]>();
    for (const o of ocurrencias(tareas, cumplimientos, desde, hasta, feriados)) {
      mapa.set(o.fechaVence, [...(mapa.get(o.fechaVence) ?? []), o]);
    }
    return mapa;
  }, [tareas, cumplimientos, desde, hasta, feriados]);

  const progPorDia = useMemo(() => {
    const mapa = new Map<FechaISO, OcurrenciaProgramada[]>();
    for (const o of ocurrenciasProgramadas(programados, seguimientos, desde, hasta, feriados)) {
      mapa.set(o.fecha, [...(mapa.get(o.fecha) ?? []), o]);
    }
    return mapa;
  }, [programados, seguimientos, desde, hasta, feriados]);

  function mover(delta: 1 | -1) {
    const nuevo =
      vista === 'dia' ? sumarDias(ref, delta) : vista === 'semana' ? sumarDias(ref, 7 * delta) : iso(addMonths(parseISO(ref), delta));
    setRef(nuevo);
    setSel(nuevo);
  }

  const titulo =
    vista === 'dia'
      ? fmt(ref, "EEEE d 'de' MMMM")
      : vista === 'semana'
        ? `${fmt(desde, 'd MMM')} – ${fmt(hasta, 'd MMM yyyy')}`
        : fmt(ref, 'MMMM yyyy');

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Vista del calendario" className="flex gap-2">
        {VISTAS.map(([v, etiqueta]) => (
          <button
            key={v}
            type="button"
            aria-pressed={vista === v}
            onClick={() => setVista(v)}
            className={`min-h-11 flex-1 rounded-full text-sm transition duration-200 ${vista === v ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => mover(-1)} aria-label="Anterior" className="grid size-11 place-items-center rounded-full bg-surface-2">
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold first-letter:uppercase" aria-live="polite">
            {titulo}
          </p>
          {ref !== hoy && (
            <button
              type="button"
              className="text-xs text-accent"
              onClick={() => {
                setRef(hoy);
                setSel(hoy);
              }}
            >
              Ir a hoy
            </button>
          )}
        </div>
        <button type="button" onClick={() => mover(1)} aria-label="Siguiente" className="grid size-11 place-items-center rounded-full bg-surface-2">
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>

      {vista === 'dia' && <ListaDia fecha={ref} items={porDia.get(ref) ?? []} programadas={progPorDia.get(ref) ?? []} conTitulo={false} />}

      {vista === 'semana' && (
        <div className="flex flex-col gap-4">
          {dias(desde, hasta).map((f) => (
            <ListaDia key={f} fecha={f} items={porDia.get(f) ?? []} programadas={progPorDia.get(f) ?? []} conTitulo />
          ))}
        </div>
      )}

      {vista === 'mes' && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={titulo}>
            {ENCABEZADO_SEMANA.map((d, i) => (
              <span key={i} className="py-1 text-xs text-text-muted">
                {d}
              </span>
            ))}
            {dias(desde, hasta).map((f) => {
              const items = porDia.get(f) ?? [];
              const progAbiertas = (progPorDia.get(f) ?? []).filter((o) => !estaCerrada(o)).length;
              const abiertas = items.filter(estaAbierta).length;
              const fueraDelMes = f.slice(0, 7) !== ref.slice(0, 7);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={sel === f}
                  aria-label={`${fmt(f, "EEEE d 'de' MMMM")}${abiertas ? `, ${abiertas} pendientes` : ''}${progAbiertas ? `, ${progAbiertas} pedidos o envíos` : ''}${esSegundoSabado(f) ? ', ingreso de mercadería' : ''}`}
                  onClick={() => setSel(f)}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition duration-200 ${sel === f ? 'bg-surface-2' : ''} ${fueraDelMes ? 'text-text-muted/50' : ''} ${f === hoy ? 'ring-1 ring-accent' : ''}`}
                >
                  {Number(f.slice(8))}
                  <span className="flex h-1.5 gap-0.5">
                    {abiertas > 0 && <span className="size-1.5 rounded-full bg-accent" />}
                    {progAbiertas > 0 && <span className="size-1.5 rounded-full bg-text-muted" />}
                    {esSegundoSabado(f) && <span className="size-1.5 rounded-full bg-info" />}
                  </span>
                </button>
              );
            })}
          </div>
          <ListaDia fecha={sel} items={porDia.get(sel) ?? []} programadas={progPorDia.get(sel) ?? []} conTitulo />
        </>
      )}
    </div>
  );
}
