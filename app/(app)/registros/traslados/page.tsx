'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { FormularioTraslado } from '@/components/registros/FormularioTraslado';
import { HojaRecepcionTraslado } from '@/components/registros/HojaRecepcionTraslado';
import { SelectorMes } from '@/components/registros/SelectorMes';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import {
  actualizarTraslado,
  borrarTraslado,
  cerrarTrasladoDb,
  crearTraslado,
  marcarTramite,
  reabrirTraslado,
  recibirTraslado,
  restaurarTraslado,
  suscribirTraslados,
} from '@/lib/db/traslados';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { formatearDiferencia } from '@/lib/domain/conteo';
import { formatearEnUD, formatearNumero } from '@/lib/domain/formato';
import {
  diasDesdeRegistro,
  diferenciaItem,
  ETIQUETA_ESTADO_TRASLADO,
  ETIQUETA_TIPO_TRASLADO,
  ordenarTraslados,
  quitarRecepcion,
  totalesTraslados,
  tramiteCompleto,
  trasladosDelMes,
  trasladosPendientes,
  type ItemTraslado,
  type RegistroTraslado,
  type TrasladoValido,
} from '@/lib/domain/traslados';

const fecha = (f: string) => format(parseISO(f), "d 'de' MMM yyyy", { locale: es });
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

export default function Traslados() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  // El checklist de trámite SAP/SIFA es solo del 771 (PRD RF-9.3).
  const checklist = estado.fase === 'listo' && (estado.sesion.unidad === '771' || estado.sesion.rol === 'superadmin');
  const [registros, setRegistros] = useState<RegistroTraslado[] | undefined>(undefined);
  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [formulario, setFormulario] = useState(false);
  const [editando, setEditando] = useState<RegistroTraslado | null>(null);
  const [recibiendo, setRecibiendo] = useState<RegistroTraslado | null>(null);
  const [mes, setMes] = useState(() => hoyCostaRica().slice(0, 7));
  const hoy = hoyCostaRica();
  const mesActual = hoy.slice(0, 7);

  useEffect(() => {
    if (!uid) return;
    const bajas = [suscribirTraslados(uid, setRegistros), suscribirExistencias(uid, setExistencias)];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  const porCodigo = useMemo(() => new Map(existencias.map((e) => [e.codigo, e])), [existencias]);
  const pendientes = useMemo(() => trasladosPendientes(registros ?? []), [registros]);
  const delMes = useMemo(() => ordenarTraslados(trasladosDelMes(registros ?? [], mes)), [registros, mes]);
  const totales = useMemo(() => totalesTraslados(delMes), [delMes]);

  if (!uid) return null;

  function guardar(t: TrasladoValido) {
    if (!uid) return;
    if (editando) {
      const previo = editando;
      void actualizarTraslado(uid, previo, t).catch(() => mostrar('No se pudo guardar el cambio.', { tono: 'error' }));
      mostrar('Traslado actualizado.', {
        tono: 'ok',
        accion: { etiqueta: 'Deshacer', alPulsar: () => void restaurarTraslado(uid, previo).catch(() => mostrar('No se pudo deshacer.', { tono: 'error' })) },
      });
      return;
    }
    void crearTraslado(uid, t).catch(() => mostrar('No se pudo guardar el traslado.', { tono: 'error' }));
    mostrar('Traslado registrado.', { tono: 'ok' });
  }

  // Una recepción pregunta cuánto llegó de cada producto; un envío se marca directo.
  function recibir(t: RegistroTraslado, items: ItemTraslado[]) {
    if (!uid) return;
    void recibirTraslado(uid, t.id, items, hoy).catch(() => mostrar('No se pudo actualizar el traslado.', { tono: 'error' }));
    const conDiferencia = items.some((i) => (diferenciaItem(i) ?? 0) !== 0);
    mostrar(conDiferencia ? 'Recibido con diferencia.' : 'Marcado como recibido.', {
      tono: 'ok',
      accion: { etiqueta: 'Deshacer', alPulsar: () => void reabrirTraslado(uid, t.id, quitarRecepcion(items)).catch(() => mostrar('No se pudo deshacer.', { tono: 'error' })) },
    });
    setRecibiendo(null);
  }

  function cerrar(t: RegistroTraslado) {
    if (!uid) return;
    if (t.tipo === 'recepcion') {
      setRecibiendo(t);
      return;
    }
    void cerrarTrasladoDb(uid, t, hoy).catch(() => mostrar('No se pudo actualizar el traslado.', { tono: 'error' }));
    mostrar('Marcado como enviado.', {
      tono: 'ok',
      accion: { etiqueta: 'Deshacer', alPulsar: () => void reabrirTraslado(uid, t.id).catch(() => mostrar('No se pudo deshacer.', { tono: 'error' })) },
    });
  }

  function tramite(t: RegistroTraslado, campo: 'enSAP' | 'enSIFA') {
    if (!uid) return;
    void marcarTramite(uid, t.id, campo, !t[campo]).catch(() => mostrar('No se pudo guardar el trámite.', { tono: 'error' }));
  }

  function borrar(t: RegistroTraslado) {
    if (!uid) return;
    void borrarTraslado(uid, t.id).catch(() => mostrar('No se pudo borrar el traslado.', { tono: 'error' }));
    mostrar('Traslado borrado.', {
      accion: { etiqueta: 'Deshacer', alPulsar: () => void restaurarTraslado(uid, t).catch(() => mostrar('No se pudo restaurar.', { tono: 'error' })) },
    });
  }

  const nombre = (codigo: string) => porCodigo.get(codigo)?.descripcion ?? 'Producto fuera del último reporte';
  const cantidad = (codigo: string, base: number) => {
    const ud = porCodigo.get(codigo)?.ud;
    return ud ? formatearEnUD(base, ud) : `${formatearNumero(base)} u.`;
  };

  return (
    <Pantalla titulo="Traslados">
      <Link href="/registros/" className="-mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Registros
      </Link>

      <div className="flex items-center justify-between gap-2">
        <SelectorMes mes={mes} mesActual={mesActual} alCambiar={setMes} />
        <Button onClick={() => setFormulario(true)}>
          <Plus aria-hidden className="size-4" />
          Traslado
        </Button>
      </div>

      {registros === undefined ? (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando…
        </Card>
      ) : (
        <>
          {pendientes.length > 0 && (
            <section aria-label="Pendientes" className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Pendientes ({pendientes.length})</h2>
              <ul className="flex flex-col gap-2">
                {pendientes.map((t) => (
                  <FilaTraslado key={t.id} t={t} hoy={hoy} nombre={nombre} cantidad={cantidad} udDe={(c) => porCodigo.get(c)?.ud ?? ''} checklist={checklist} alCerrar={() => cerrar(t)} alTramite={(c) => tramite(t, c)} alEditar={() => setEditando(t)} alBorrar={() => borrar(t)} />
                ))}
              </ul>
            </section>
          )}

          <Card className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                [totales.pendientes, 'Pendientes'],
                [totales.recibidos, 'Recibidos'],
                [totales.enviados, 'Enviados'],
                [totales.tramitePendiente, 'Trámite sin completar'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <div key={etiqueta}>
                <p className="text-2xl font-semibold">{valor}</p>
                <p className="text-[11px] leading-tight text-text-muted">{etiqueta}</p>
              </div>
            ))}
          </Card>

          <section aria-label="Traslados del mes" className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Del mes ({delMes.filter((t) => t.estado !== 'pendiente').length} cerrados)</h2>
            {delMes.length === 0 ? (
              <p className="text-sm text-text-muted">No hay traslados registrados en este mes.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {delMes.filter((t) => t.estado !== 'pendiente').map((t) => (
                  <FilaTraslado key={t.id} t={t} hoy={hoy} nombre={nombre} cantidad={cantidad} udDe={(c) => porCodigo.get(c)?.ud ?? ''} checklist={checklist} alCerrar={() => cerrar(t)} alTramite={(c) => tramite(t, c)} alEditar={() => setEditando(t)} alBorrar={() => borrar(t)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <HojaRecepcionTraslado registro={recibiendo} udDe={(c) => porCodigo.get(c)?.ud} nombre={nombre} alCerrar={() => setRecibiendo(null)} alRecibir={recibir} />

      <FormularioTraslado
        key={editando?.id ?? 'nuevo'}
        abierta={formulario || editando !== null}
        alCerrar={() => {
          setFormulario(false);
          setEditando(null);
        }}
        existencias={existencias}
        alGuardar={guardar}
        inicial={editando ?? undefined}
      />
    </Pantalla>
  );
}

interface FilaProps {
  t: RegistroTraslado;
  hoy: string;
  nombre: (codigo: string) => string;
  cantidad: (codigo: string, base: number) => string;
  /** UD del producto según el último reporte (para mostrar la diferencia). */
  udDe: (codigo: string) => string;
  checklist: boolean;
  alCerrar: () => void;
  alTramite: (campo: 'enSAP' | 'enSIFA') => void;
  alEditar: () => void;
  alBorrar: () => void;
}

function FilaTraslado({ t, hoy, nombre, cantidad, udDe, checklist, alCerrar, alTramite, alEditar, alBorrar }: FilaProps) {
  const pendiente = t.estado === 'pendiente';
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-mono text-sm">{t.ordenSAP}</span>
          <span className="block text-xs text-text-muted">
            {ETIQUETA_TIPO_TRASLADO[t.tipo]} {t.tipo === 'envio' ? 'a' : 'desde'} {t.unidad}
          </span>
        </span>
        <div className="flex shrink-0">
          <button type="button" aria-label={`Editar traslado ${t.ordenSAP}`} onClick={alEditar} className="grid size-11 place-items-center rounded-xl text-text-muted hover:bg-surface-2">
            <Pencil aria-hidden className="size-4" />
          </button>
          <button type="button" aria-label={`Borrar traslado ${t.ordenSAP}`} onClick={alBorrar} className="grid size-11 place-items-center rounded-xl text-text-muted hover:bg-surface-2">
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5 text-xs">
        {t.items.map((i) => (
          <li key={i.codigo} className="flex justify-between gap-2">
            <span className="min-w-0 truncate">
              <span className="font-mono text-text-muted">{i.codigo}</span> {nombre(i.codigo)}
            </span>
            <span className="shrink-0 font-semibold">
              {cantidad(i.codigo, i.cantidad)}
              {(diferenciaItem(i) ?? 0) !== 0 && (
                <span className="ml-2 font-bold">
                  llegó {cantidad(i.codigo, i.recibida ?? 0)} · {formatearDiferencia(diferenciaItem(i), udDe(i.codigo))}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">
        Registrado el {fecha(t.fecha)} ·{' '}
        {pendiente ? (
          <span className="font-semibold text-text">{ETIQUETA_ESTADO_TRASLADO.pendiente} hace {dias(diasDesdeRegistro(t, hoy))}</span>
        ) : (
          <span className="text-ok">
            {ETIQUETA_ESTADO_TRASLADO[t.estado]}
            {t.fechaCierre && <> el {fecha(t.fechaCierre)}</>}
          </span>
        )}
      </p>
      {t.notas && <p className="text-xs text-text-muted">{t.notas}</p>}
      {pendiente && (
        <Button variante="secundario" className="self-start" onClick={alCerrar}>
          {t.tipo === 'recepcion' ? 'Marcar recibido' : 'Marcar enviado'}
        </Button>
      )}
      {checklist && (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 border-t border-surface-2 pt-2">
          <legend className="sr-only">Trámite {tramiteCompleto(t) ? 'completo' : 'pendiente'}</legend>
          {(
            [
              ['enSAP', 'Registrado en SAP'],
              ['enSIFA', 'Aplicado en SIFA'],
            ] as const
          ).map(([campo, etiqueta]) => (
            <label key={campo} className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={t[campo]} onChange={() => alTramite(campo)} className="size-5 accent-accent" />
              {etiqueta}
            </label>
          ))}
        </fieldset>
      )}
    </li>
  );
}
