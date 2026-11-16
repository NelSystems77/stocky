'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Image as IconoFoto, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { FormularioDanado } from '@/components/registros/FormularioDanado';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { adjuntarFoto, borrarDanado, crearDanado, leerFoto, restaurarDanado, suscribirDanados } from '@/lib/db/danados';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import { hoyCostaRica } from '@/lib/domain/calendario';
import {
  danadosDelMes,
  ETIQUETA_MOTIVO,
  MOTIVOS_DANADO,
  ordenarDanados,
  totalesDanados,
  type EntradaDanado,
  type RegistroDanado,
} from '@/lib/domain/danados';
import { formatearEnUD, formatearNumero } from '@/lib/domain/formato';
import { reducirFoto } from '@/lib/imagen';

const fecha = (f: string) => format(parseISO(f), "d 'de' MMM yyyy", { locale: es });
const nombreMes = (mes: string) => format(parseISO(`${mes}-01`), 'MMMM yyyy', { locale: es });

function cambiarMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function Danados() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const [registros, setRegistros] = useState<RegistroDanado[] | undefined>(undefined);
  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [formulario, setFormulario] = useState(false);
  const [mes, setMes] = useState(() => hoyCostaRica().slice(0, 7));
  const mesActual = hoyCostaRica().slice(0, 7);

  useEffect(() => {
    if (!uid) return;
    const bajas = [suscribirDanados(uid, setRegistros), suscribirExistencias(uid, setExistencias)];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  const porCodigo = useMemo(() => new Map(existencias.map((e) => [e.codigo, e])), [existencias]);
  const delMes = useMemo(() => ordenarDanados(danadosDelMes(registros ?? [], mes)), [registros, mes]);
  const totales = useMemo(() => totalesDanados(delMes), [delMes]);

  if (!uid) return null;

  function guardar(entrada: EntradaDanado, foto: File | null) {
    if (!uid) return;
    const { id, escritura } = crearDanado(uid, entrada);
    void escritura.catch(() => mostrar('No se pudo guardar el dañado.', { tono: 'error' }));
    mostrar('Dañado registrado.', { tono: 'ok' });
    if (!foto) return;
    if (!navigator.onLine) {
      mostrar('Dañado guardado. La foto necesita conexión: agrégala cuando vuelva la red.', { tono: 'info' });
      return;
    }
    void (async () => {
      try {
        await adjuntarFoto(uid, id, await reducirFoto(foto));
      } catch {
        mostrar('El dañado se guardó, pero la foto no se pudo subir.', { tono: 'error' });
      }
    })();
  }

  function borrar(r: RegistroDanado) {
    if (!uid) return;
    void borrarDanado(uid, r.id).catch(() => mostrar('No se pudo borrar el registro.', { tono: 'error' }));
    mostrar('Registro borrado.', {
      accion: {
        etiqueta: 'Deshacer',
        alPulsar: () => void restaurarDanado(uid, r).catch(() => mostrar('No se pudo restaurar.', { tono: 'error' })),
      },
    });
  }

  const descripcion = (codigo: string) => porCodigo.get(codigo)?.descripcion ?? 'Producto fuera del último reporte';
  const cantidad = (r: { codigo: string; cantidad: number }) => {
    const ud = porCodigo.get(r.codigo)?.ud;
    return ud ? formatearEnUD(r.cantidad, ud) : `${formatearNumero(r.cantidad)} u.`;
  };

  return (
    <Pantalla titulo="Dañados">
      <Link href="/registros/" className="-mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Registros
      </Link>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Mes">
          <button type="button" aria-label="Mes anterior" onClick={() => setMes(cambiarMes(mes, -1))} className="grid size-11 place-items-center rounded-xl bg-surface-2">
            ‹
          </button>
          <span className="min-w-32 text-center text-sm font-semibold capitalize">{nombreMes(mes)}</span>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={mes >= mesActual}
            onClick={() => setMes(cambiarMes(mes, 1))}
            className="grid size-11 place-items-center rounded-xl bg-surface-2 disabled:opacity-40"
          >
            ›
          </button>
        </div>
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
              <p className="text-xs text-text-muted">Registros</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{formatearNumero(totales.unidades)}</p>
              <p className="text-xs text-text-muted">Unidades</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{totales.porProducto.length}</p>
              <p className="text-xs text-text-muted">Productos</p>
            </div>
            <p className="col-span-3 text-xs text-text-muted">
              {MOTIVOS_DANADO.map((m) => `${ETIQUETA_MOTIVO[m]}: ${formatearNumero(totales.porMotivo[m])}`).join(' · ')}
            </p>
          </Card>

          {delMes.length === 0 ? (
            <p className="text-sm text-text-muted">No hay dañados registrados en este mes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {delMes.map((r) => (
                <FilaDanado key={r.id} r={r} nombre={descripcion(r.codigo)} cantidad={cantidad(r)} alBorrar={() => borrar(r)} />
              ))}
            </ul>
          )}
          <p className="text-xs text-text-muted">El acta del dañado se hace en SIFA; aquí solo queda el registro para el resumen mensual.</p>
        </>
      )}

      <FormularioDanado abierta={formulario} alCerrar={() => setFormulario(false)} existencias={existencias} alGuardar={guardar} />
    </Pantalla>
  );
}

function FilaDanado({ r, nombre, cantidad, alBorrar }: { r: RegistroDanado; nombre: string; cantidad: string; alBorrar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [falla, setFalla] = useState(false);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  async function verFoto() {
    if (!r.fotoRuta) return;
    setCargando(true);
    setFalla(false);
    try {
      setUrl(URL.createObjectURL(await leerFoto(r.fotoRuta)));
    } catch {
      setFalla(true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-mono text-xs text-text-muted">{r.codigo}</span>
          <span className="block text-sm">{nombre}</span>
        </span>
        <button type="button" aria-label={`Borrar dañado ${r.codigo}`} onClick={alBorrar} className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted hover:bg-surface-2">
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>
      <p className="text-xs text-text-muted">
        {fecha(r.fecha)} · <span className="font-semibold text-text">{cantidad}</span> · {ETIQUETA_MOTIVO[r.motivo]}
        {r.lote && <> · Lote {r.lote}</>}
      </p>
      {r.notas && <p className="text-xs text-text-muted">{r.notas}</p>}
      {r.fotoRuta && !url && (
        <Button variante="secundario" className="self-start" disabled={cargando} onClick={() => void verFoto()}>
          <IconoFoto aria-hidden className="size-4" />
          {cargando ? 'Cargando…' : 'Ver foto'}
        </Button>
      )}
      {falla && <p className="text-xs text-critical">No se pudo cargar la foto (¿sin conexión?).</p>}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Foto del dañado ${r.codigo}`} className="max-h-72 w-full rounded-xl object-contain" />
      )}
    </li>
  );
}
