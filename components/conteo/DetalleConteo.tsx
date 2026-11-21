'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { BotonesExportar } from '@/components/reportes/BotonesExportar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Hoja } from '@/components/ui/Hoja';
import { useToast } from '@/components/ui/Toast';
import { borrarConteo, guardarLinea, quitarLinea, restaurarConteo, suscribirLineas, type Conteo } from '@/lib/db/conteos';
import { coincide } from '@/lib/domain/busqueda';
import { filasConteo, leerCantidad, resumenConteo, type LineaConteo } from '@/lib/domain/conteo';
import { parsearCodigo } from '@/lib/domain/codigos';
import { normalizarUD } from '@/lib/domain/unidades';
import { reporteConteo } from '@/lib/reports/conteo';
import { FilaContar } from './FilaContar';

type Filtro = 'todos' | 'diferencias' | 'sinContar';
const PAGINA = 50;

interface Props {
  uid: string;
  conteo: Conteo;
  usuario: string;
  unidad: string;
  alVolver: () => void;
}

const fecha = (f: string) => format(parseISO(f), "d 'de' MMMM yyyy", { locale: es });

export function DetalleConteo({ uid, conteo, usuario, unidad, alVolver }: Props) {
  const { mostrar } = useToast();
  // `undefined` = cargando lo contado.
  const [lineas, setLineas] = useState<LineaConteo[] | undefined>(undefined);
  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [visibles, setVisibles] = useState(PAGINA);
  const [agregando, setAgregando] = useState(false);
  const buscar = useDeferredValue(consulta);

  useEffect(() => suscribirLineas(uid, conteo.id, setLineas), [uid, conteo.id]);

  const filas = useMemo(() => filasConteo(conteo.foto, lineas ?? []), [conteo.foto, lineas]);
  const resumen = useMemo(() => resumenConteo(filas), [filas]);
  const filtradas = useMemo(
    () =>
      filas.filter((f) => {
        if (filtro === 'diferencias' && f.estado !== 'falta' && f.estado !== 'sobra') return false;
        if (filtro === 'sinContar' && f.estado !== 'sinContar') return false;
        return coincide(buscar, f.codigo, f.descripcion);
      }),
    [filas, filtro, buscar],
  );

  const error = (m: string) => mostrar(m, { tono: 'error' });

  function guardar(codigo: string, contado: number, observacion: string) {
    const previa = lineas?.find((l) => l.codigo === codigo);
    const fuera = filas.find((f) => f.codigo === codigo && f.fueraDeSifa);
    const linea: LineaConteo = { codigo, contado, observacion, ...(fuera ? { fueraDeSifa: { descripcion: fuera.descripcion, ud: fuera.ud } } : {}) };
    void guardarLinea(uid, conteo.id, linea).catch(() => error('No se pudo guardar lo contado.'));
    if (!previa || previa.contado !== contado) {
      mostrar('Contado guardado.', {
        tono: 'ok',
        accion: {
          etiqueta: 'Deshacer',
          alPulsar: () => void (previa ? guardarLinea(uid, conteo.id, previa) : quitarLinea(uid, conteo.id, codigo)).catch(() => error('No se pudo deshacer.')),
        },
      });
    }
  }

  function quitar(codigo: string) {
    const previa = lineas?.find((l) => l.codigo === codigo);
    void quitarLinea(uid, conteo.id, codigo).catch(() => error('No se pudo quitar lo contado.'));
    mostrar('Vuelve a «sin contar».', {
      accion: previa ? { etiqueta: 'Deshacer', alPulsar: () => void guardarLinea(uid, conteo.id, previa).catch(() => error('No se pudo deshacer.')) } : undefined,
    });
  }

  function borrar() {
    const contado = lineas ?? [];
    void borrarConteo(
      uid,
      conteo.id,
      contado.map((l) => l.codigo),
    ).catch(() => error('No se pudo borrar el conteo.'));
    mostrar('Conteo borrado.', {
      accion: { etiqueta: 'Deshacer', alPulsar: () => void restaurarConteo(uid, conteo, contado).catch(() => error('No se pudo restaurar.')) },
    });
    alVolver();
  }

  const chips: { id: Filtro; etiqueta: string }[] = [
    { id: 'todos', etiqueta: `Todos (${resumen.productos})` },
    { id: 'diferencias', etiqueta: `Con diferencias (${resumen.conDiferencia})` },
    { id: 'sinContar', etiqueta: `Sin contar (${resumen.sinContar})` },
  ];

  return (
    <>
      <button type="button" onClick={alVolver} className="-mt-2 inline-flex min-h-11 items-center gap-2 self-start text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Conteos
      </button>

      <Card className="flex flex-col gap-1">
        <p className="font-semibold">Conteo del {fecha(conteo.fecha)}</p>
        <p className="text-xs text-text-muted">
          {conteo.fechaReporteSifa ? `SIFA según el reporte del ${fecha(conteo.fechaReporteSifa)}` : 'SIFA según el último reporte importado'} ·{' '}
          {conteo.alcance === 'todos' ? 'todos los productos' : 'lista elegida'}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <p>
            <span className="block text-lg font-semibold tabular-nums">
              {resumen.contados}/{resumen.productos}
            </span>
            <span className="text-xs text-text-muted">Contados</span>
          </p>
          <p>
            <span className="block text-lg font-semibold tabular-nums">-{resumen.faltantes}</span>
            <span className="text-xs text-text-muted">Faltantes</span>
          </p>
          <p>
            <span className="block text-lg font-semibold tabular-nums">+{resumen.sobrantes}</span>
            <span className="text-xs text-text-muted">Sobrantes</span>
          </p>
        </div>
      </Card>

      <section aria-label="Exportar conteo" className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
        <p className="text-sm">{filtro === 'diferencias' ? 'Exportar solo las diferencias' : 'Exportar el conteo'}</p>
        <BotonesExportar
          deshabilitado={lineas === undefined}
          armar={() => reporteConteo(filas, { fecha: conteo.fecha, fechaReporteSifa: conteo.fechaReporteSifa }, { usuario, unidad, generadoEn: new Date() }, filtro === 'diferencias')}
        />
      </section>

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
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar el conteo">
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

      {lineas === undefined ? (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando lo contado…
        </Card>
      ) : filtradas.length === 0 ? (
        <Card className="text-center text-sm text-text-muted">
          {filtro === 'diferencias' ? 'Aún no hay diferencias.' : filtro === 'sinContar' ? 'No queda nada sin contar.' : 'Ningún producto coincide con la búsqueda.'}
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtradas.slice(0, visibles).map((f) => (
            <FilaContar
              key={`${f.codigo}-${f.contado}`}
              fila={f}
              alGuardar={(contado, obs) => guardar(f.codigo, contado, obs)}
              alQuitar={() => quitar(f.codigo)}
              alRechazar={() => error('Escribe solo números (ej. 20000).')}
            />
          ))}
        </ul>
      )}

      {filtradas.length > visibles && (
        <button type="button" onClick={() => setVisibles((v) => v + PAGINA)} className="min-h-11 rounded-2xl bg-surface-2 text-sm font-semibold">
          Mostrar más ({filtradas.length - visibles})
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variante="secundario" onClick={() => setAgregando(true)}>
          <Plus aria-hidden className="size-4" />
          Producto que no está en SIFA
        </Button>
        <Button variante="fantasma" onClick={borrar}>
          <Trash2 aria-hidden className="size-4" />
          Borrar conteo
        </Button>
      </div>

      <Hoja abierta={agregando} alCerrar={() => setAgregando(false)} titulo="Producto que no está en SIFA">
        <FormularioFueraDeSifa
          existentes={new Set(filas.map((f) => f.codigo))}
          alGuardar={(l) => {
            void guardarLinea(uid, conteo.id, l).catch(() => error('No se pudo guardar lo contado.'));
            mostrar('Producto agregado al conteo.', { tono: 'ok' });
            setAgregando(false);
          }}
        />
      </Hoja>
    </>
  );
}

function FormularioFueraDeSifa({ existentes, alGuardar }: { existentes: ReadonlySet<string>; alGuardar: (l: LineaConteo) => void }) {
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ud, setUd] = useState('');
  const [contado, setContado] = useState('');
  const [error, setError] = useState('');

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const c = parsearCodigo(codigo);
    const n = leerCantidad(contado);
    if (!c) return setError('Escribe un código válido (ej. 110-16-0010).');
    if (existentes.has(c)) return setError('Ese producto ya está en el conteo: búscalo en la lista.');
    if (descripcion.trim() === '') return setError('Escribe el nombre del producto.');
    if (n === null) return setError('Escribe la cantidad contada, en unidades sueltas.');
    alGuardar({ codigo: c, contado: n, observacion: '', fueraDeSifa: { descripcion: descripcion.trim().slice(0, 200), ud: normalizarUD(ud).slice(0, 20) } });
  }

  const campo = 'min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text';
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 text-xs text-text-muted">
      <p>La existencia de SIFA se toma como 0: todo lo contado cuenta como sobrante y queda marcado «No está en SIFA».</p>
      <label className="flex flex-col gap-1">
        Código
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" className={`${campo} font-mono`} />
      </label>
      <label className="flex flex-col gap-1">
        Nombre del producto
        <input value={descripcion} maxLength={200} onChange={(e) => setDescripcion(e.target.value)} autoComplete="off" className={campo} />
      </label>
      <label className="flex flex-col gap-1">
        UD (CN, FC, TR…; vacío si no la sabes)
        <input value={ud} maxLength={20} onChange={(e) => setUd(e.target.value)} autoComplete="off" className={campo} />
      </label>
      <label className="flex flex-col gap-1">
        Contado (unidades sueltas)
        <input value={contado} inputMode="decimal" onChange={(e) => setContado(e.target.value)} autoComplete="off" className={campo} />
      </label>
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
      <Button type="submit">Agregar al conteo</Button>
    </form>
  );
}
