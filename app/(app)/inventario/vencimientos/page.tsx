'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState, useSyncExternalStore } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { BotonesExportar } from '@/components/reportes/BotonesExportar';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { FilaLote } from '@/components/vencimientos/FilaLote';
import { DiferenciasSifa } from '@/components/vencimientos/DiferenciasSifa';
import { HistorialCargas } from '@/components/vencimientos/HistorialCargas';
import { HojaGestionar } from '@/components/vencimientos/HojaGestionar';
import { useAuth } from '@/lib/auth/AuthProvider';
import { gestionarLote, reabrirLote } from '@/lib/db/lotes';
import { coincide } from '@/lib/domain/busqueda';
import { contarUrgentes, type AlertaLote, type LoteVista } from '@/lib/domain/vencimientos';
import { reporteVencimientos } from '@/lib/reports/construir';
import { useVencimientos } from '@/lib/vencimientos/useVencimientos';

type Filtro = 'urgentes' | 'medias' | 'todos' | 'gestionados';
type Pestana = 'lotes' | 'diferencias' | 'historial';
const PAGINA = 40;

/** El chip de Hoy enlaza a `#diferencias`: se lee el hash sin efectos (en el servidor no hay hash). */
const suscribirHash = (alCambiar: () => void) => {
  window.addEventListener('hashchange', alCambiar);
  return () => window.removeEventListener('hashchange', alCambiar);
};
const leerHash = () => window.location.hash;
const hashEnServidor = () => '';

const fecha = (f: string) => format(parseISO(f), "d 'de' MMM yyyy", { locale: es });

export default function Vencimientos() {
  const v = useVencimientos();
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const hash = useSyncExternalStore(suscribirHash, leerHash, hashEnServidor);
  const [elegida, setPestana] = useState<Pestana | null>(null);
  const pestana: Pestana = elegida ?? (hash === '#diferencias' ? 'diferencias' : 'lotes');
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [consulta, setConsulta] = useState('');
  const [visibles, setVisibles] = useState(PAGINA);
  const [gestionando, setGestionando] = useState<LoteVista | null>(null);
  const buscar = useDeferredValue(consulta);

  const gestionados = useMemo(() => v.vista.filter((l) => l.estado === 'gestionado').toSorted((a, b) => (b.gestion?.fecha ?? '').localeCompare(a.gestion?.fecha ?? '')), [v.vista]);
  const urgentes = contarUrgentes(v.resumen);
  // Sin elegir, se abre en lo urgente si lo hay.
  const activo: Filtro = filtro ?? (urgentes > 0 ? 'urgentes' : 'todos');

  const filas = useMemo(() => {
    const aFila = (alerta: AlertaLote) => ({ lote: alerta.lote, alerta });
    let lista: { lote: LoteVista; alerta: AlertaLote | null }[];
    if (activo === 'gestionados') lista = gestionados.map((lote) => ({ lote, alerta: null }));
    else if (activo === 'urgentes') lista = v.alertas.filter((a) => a.nivel === 'vencido' || a.nivel === 'alta').map(aFila);
    else if (activo === 'medias') lista = v.alertas.filter((a) => a.nivel === 'media').map(aFila);
    else lista = v.alertas.map(aFila);
    return lista.filter((f) => coincide(buscar, f.lote.codigo, `${f.lote.descripcion} ${f.lote.lote}`));
  }, [activo, v.alertas, gestionados, buscar]);

  if (!v.uid) return null;
  const uid = v.uid;

  function gestionar(lote: LoteVista, motivo: string) {
    void gestionarLote(uid, lote.id, motivo, v.hoy).catch(() => mostrar('No se pudo gestionar el lote.', { tono: 'error' }));
    mostrar(`Gestionado: lote ${lote.lote}`, {
      tono: 'ok',
      accion: { etiqueta: 'Deshacer', alPulsar: () => void reabrirLote(uid, lote, v.hoy).catch(() => mostrar('No se pudo deshacer.', { tono: 'error' })) },
    });
  }

  function reabrir(lote: LoteVista) {
    void reabrirLote(uid, lote, v.hoy).catch(() => mostrar('No se pudo reabrir el lote.', { tono: 'error' }));
    mostrar(`Reabierto: lote ${lote.lote}`, { tono: 'ok' });
  }

  const chips: { id: Filtro; etiqueta: string }[] = [
    { id: 'urgentes', etiqueta: `Urgentes (${urgentes})` },
    { id: 'medias', etiqueta: `Prioridad media (${v.resumen.media})` },
    { id: 'todos', etiqueta: `Todos (${v.alertas.length})` },
    { id: 'gestionados', etiqueta: `Gestionados (${gestionados.length})` },
  ];

  return (
    <Pantalla titulo="Vencimientos">
      <Link href="/inventario/" className="-mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Inventario
      </Link>

      <div role="tablist" aria-label="Secciones de vencimientos" className="flex gap-2">
        {(
          [
            ['lotes', 'Lotes'],
            ['diferencias', v.sifa.total > 0 ? `Diferencias con SIFA (${v.sifa.total})` : 'Diferencias con SIFA'],
            ['historial', 'Historial'],
          ] as const
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`min-h-11 flex-1 rounded-2xl px-1 text-xs transition duration-200 sm:text-sm ${pestana === id ? 'bg-surface-2 font-semibold text-accent' : 'text-text-muted'}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'historial' && <HistorialCargas uid={uid} />}

      {pestana === 'diferencias' &&
        (v.cargando ? (
          <p role="status" className="animate-pulse text-center text-sm text-text-muted">
            Cargando…
          </p>
        ) : (
          <DiferenciasSifa sifa={v.sifa} hayLotes={v.lotes.length > 0} />
        ))}

      {pestana === 'lotes' && v.cargando && (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando lotes…
        </Card>
      )}

      {pestana === 'lotes' && !v.cargando && v.lotes.length === 0 && (
        <Card className="flex flex-col items-start gap-3">
          <p className="font-semibold">Aún no hay lotes cargados</p>
          <p className="text-sm text-text-muted">Importa el reporte de lotes y vencimientos de SIFA (se carga el tercer jueves del mes).</p>
          <Link href="/importar/" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-bg">
            <Upload aria-hidden className="size-4" />
            Importar reporte
          </Link>
        </Card>
      )}

      {pestana === 'lotes' && !v.cargando && v.lotes.length > 0 && (
        <>
          <Card className="flex flex-col gap-1 text-sm">
            <p>
              <span className="text-text-muted">Última carga de lotes:</span> {v.ultimaCarga ? fecha(v.ultimaCarga) : '—'}
            </p>
            <p className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 sm:grid-cols-4">
              <span className={v.resumen.vencidos > 0 ? 'text-critical' : 'text-text-muted'}>Vencidos: <strong>{v.resumen.vencidos}</strong></span>
              <span className={v.resumen.alta > 0 ? 'text-warning' : 'text-text-muted'}>Alta: <strong>{v.resumen.alta}</strong></span>
              <span className={v.resumen.media > 0 ? 'text-low' : 'text-text-muted'}>Media: <strong>{v.resumen.media}</strong></span>
              <span className="text-text-muted">Con A1: <strong>{v.resumen.a1}</strong></span>
            </p>
            {v.resumen.sinConsumo > 0 && (
              <p className="text-xs text-text-muted">
                {v.resumen.sinConsumo} lotes son de productos sin consumo cargado: solo se evalúa la fecha (A2), no si se consumirán a tiempo (A1).
              </p>
            )}
            {v.excesoReal.size > 0 && (
              <p className="text-xs text-warning">
                {v.excesoReal.size} productos tienen más existencia real que la proyectada (¿un ingreso sin registrar?). Carga el reporte de lotes para corregirlo.
              </p>
            )}
            {v.ingresosSinSumar.length > 0 && (
              <p className="rounded-xl bg-info/10 p-2 text-xs text-info">
                Desde la última carga hubo {v.ingresosSinSumar.length === 1 ? 'ingreso de mercadería' : 'ingresos de mercadería'} ({v.ingresosSinSumar.map(fecha).join(', ')}) que la proyección no incluye: no sé qué lotes entraron ni cuánto.
                Carga el reporte de lotes y vencimientos para ver los lotes nuevos.
              </p>
            )}
            {v.ajustados.size > 0 && <p className="text-xs text-text-muted">{v.ajustados.size} productos se ajustaron a la existencia real del último reporte de existencias.</p>}
            <p className="text-xs text-text-muted">Las cantidades con ≈ son una proyección desde la última carga (consumo diario promedio, primero lo que vence antes).</p>
          </Card>

          <div className="sticky top-12 z-10 -mx-4 flex flex-col gap-2 bg-bg/90 px-4 pb-2 backdrop-blur">
            <label className="relative block">
              <span className="sr-only">Buscar por código, nombre o lote</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                inputMode="search"
                value={consulta}
                onChange={(e) => {
                  setConsulta(e.target.value);
                  setVisibles(PAGINA);
                }}
                placeholder="Código, nombre o lote"
                className="min-h-11 w-full rounded-2xl bg-surface-2 pr-4 pl-10 text-text placeholder:text-text-muted"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar lotes">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={activo === c.id}
                  onClick={() => {
                    setFiltro(c.id);
                    setVisibles(PAGINA);
                  }}
                  className={`min-h-11 shrink-0 rounded-full px-4 text-sm transition duration-200 ${activo === c.id ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          </div>

          {filas.length > 0 && estado.fase === 'listo' && (
            <section aria-label="Exportar la lista" className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
              <p className="text-sm">Exportar esta lista ({filas.length} lotes)</p>
              <BotonesExportar
                armar={() =>
                  reporteVencimientos(
                    filas,
                    { filtro: chips.find((c) => c.id === activo)?.etiqueta ?? 'Todos', hoy: v.hoy, ultimaCarga: v.ultimaCarga, resumen: v.resumen, umbrales: v.umbrales },
                    { usuario: estado.sesion.nombre, unidad: estado.sesion.unidad ?? '', generadoEn: new Date() },
                  )
                }
              />
            </section>
          )}

          {filas.length === 0 ? (
            <Card className="text-sm text-text-muted">{activo === 'urgentes' ? 'No hay lotes urgentes. Cero vencidos por ahora.' : 'No hay lotes con esos criterios.'}</Card>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {filas.slice(0, visibles).map((f) => (
                  <FilaLote key={f.lote.id} lote={f.lote} alerta={f.alerta} hoy={v.hoy} alGestionar={() => setGestionando(f.lote)} alReabrir={() => reabrir(f.lote)} />
                ))}
              </ul>
              {filas.length > visibles && (
                <button type="button" onClick={() => setVisibles((n) => n + PAGINA)} className="min-h-11 rounded-2xl bg-surface-2 text-sm font-semibold">
                  Ver más ({filas.length - visibles})
                </button>
              )}
            </>
          )}
        </>
      )}

      <HojaGestionar lote={gestionando} alCerrar={() => setGestionando(null)} alConfirmar={gestionar} />
    </Pantalla>
  );
}
