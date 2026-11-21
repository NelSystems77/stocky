'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { FormularioPreconteo } from '@/components/registros/FormularioPreconteo';
import { SelectorMes } from '@/components/registros/SelectorMes';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Hoja } from '@/components/ui/Hoja';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import { actualizarPreconteo, borrarPreconteo, crearPreconteo, registrarRecepcion, restaurarPreconteo, suscribirPreconteos } from '@/lib/db/preconteos';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { formatearEnUD, formatearNumero } from '@/lib/domain/formato';
import {
  diferenciaPreconteo,
  estadoPreconteo,
  ordenarPreconteos,
  preconteosDelMes,
  preconteosPendientes,
  totalesPreconteo,
  validarRecepcion,
  type EntregaValida,
  type RegistroPreconteo,
} from '@/lib/domain/preconteo';
import { deUnidadesBase, normalizarUD } from '@/lib/domain/unidades';

const fecha = (f: string) => format(parseISO(f), "EEE d 'de' MMM yyyy", { locale: es });

export default function Preconteo() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const [registros, setRegistros] = useState<RegistroPreconteo[] | undefined>(undefined);
  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [formulario, setFormulario] = useState(false);
  const [editando, setEditando] = useState<RegistroPreconteo | null>(null);
  const [recibiendo, setRecibiendo] = useState<RegistroPreconteo | null>(null);
  const [mes, setMes] = useState(() => hoyCostaRica().slice(0, 7));
  const mesActual = hoyCostaRica().slice(0, 7);

  useEffect(() => {
    if (!uid) return;
    const bajas = [suscribirPreconteos(uid, setRegistros), suscribirExistencias(uid, setExistencias)];
    return () => bajas.forEach((b) => b());
  }, [uid]);

  const porCodigo = useMemo(() => new Map(existencias.map((e) => [e.codigo, e])), [existencias]);
  const delMes = useMemo(() => ordenarPreconteos(preconteosDelMes(registros ?? [], mes)), [registros, mes]);
  const pendientes = useMemo(() => preconteosPendientes(registros ?? []), [registros]);
  const totales = useMemo(() => totalesPreconteo(delMes), [delMes]);

  if (!uid) return null;

  const ud = (codigo: string) => porCodigo.get(codigo)?.ud;
  const cantidad = (codigo: string, base: number) => {
    const u = ud(codigo);
    return u ? formatearEnUD(base, u) : `${formatearNumero(base)} u.`;
  };

  function guardar(e: EntregaValida) {
    if (!uid) return;
    if (editando) {
      const previo = editando;
      void actualizarPreconteo(uid, previo.id, e).catch(() => mostrar('No se pudo guardar el cambio.', { tono: 'error' }));
      mostrar('Entrega actualizada.', {
        tono: 'ok',
        accion: { etiqueta: 'Deshacer', alPulsar: () => void restaurarPreconteo(uid, previo).catch(() => mostrar('No se pudo deshacer.', { tono: 'error' })) },
      });
      return;
    }
    void crearPreconteo(uid, e).catch(() => mostrar('No se pudo guardar la entrega.', { tono: 'error' }));
    mostrar('Entrega registrada.', { tono: 'ok' });
  }

  function recibir(r: RegistroPreconteo, base: number) {
    if (!uid) return;
    void registrarRecepcion(uid, r.id, base).catch(() => mostrar('No se pudo guardar la recepción.', { tono: 'error' }));
    mostrar(base === r.cantidad ? 'Recibido completo.' : 'Recepción con diferencia registrada.', {
      tono: 'ok',
      accion: {
        etiqueta: 'Deshacer',
        alPulsar: () => void registrarRecepcion(uid, r.id, null).catch(() => mostrar('No se pudo deshacer.', { tono: 'error' })),
      },
    });
    setRecibiendo(null);
  }

  function borrar(r: RegistroPreconteo) {
    if (!uid) return;
    void borrarPreconteo(uid, r.id).catch(() => mostrar('No se pudo borrar el registro.', { tono: 'error' }));
    mostrar('Registro borrado.', {
      accion: {
        etiqueta: 'Deshacer',
        alPulsar: () => void restaurarPreconteo(uid, r).catch(() => mostrar('No se pudo restaurar.', { tono: 'error' })),
      },
    });
  }

  const descripcion = (codigo: string) => porCodigo.get(codigo)?.descripcion ?? 'Producto fuera del último reporte';

  return (
    <Pantalla titulo="Preconteo">
      <Link href="/registros/" className="-mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Registros
      </Link>

      <div className="flex items-center justify-between gap-2">
        <SelectorMes mes={mes} mesActual={mesActual} alCambiar={setMes} />
        <Button onClick={() => setFormulario(true)}>
          <Plus aria-hidden className="size-4" />
          Entrega
        </Button>
      </div>

      {registros === undefined ? (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando…
        </Card>
      ) : (
        <>
          {pendientes.length > 0 && (
            <section aria-label="Por recibir" className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Por recibir ({pendientes.length})</h2>
              <ul className="flex flex-col gap-2">
                {pendientes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-text-muted">{r.codigo}</span>
                      <span className="block truncate text-sm">{descripcion(r.codigo)}</span>
                      <span className="block text-xs text-text-muted">
                        {fecha(r.fecha)} · {cantidad(r.codigo, r.cantidad)} · de a {r.presentacion}
                      </span>
                    </span>
                    <Button variante="secundario" onClick={() => setRecibiendo(r)}>
                      Recibir
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Card className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-semibold">{totales.entregas}</p>
              <p className="text-xs text-text-muted">Entregas</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{totales.pendientes}</p>
              <p className="text-xs text-text-muted">Sin recibir</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{totales.conDiferencia}</p>
              <p className="text-xs text-text-muted">Con diferencia</p>
            </div>
          </Card>

          {totales.porProducto.length > 0 && (
            <section aria-label="Totales del mes" className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Totales del mes</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {totales.porProducto.map((t) => (
                  <li key={`${t.codigo}|${t.presentacion}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-text-muted">{t.codigo}</span> {descripcion(t.codigo)}
                    </span>
                    <span className="shrink-0 text-right text-xs text-text-muted">
                      de a {t.presentacion} · <span className="font-semibold text-text">{cantidad(t.codigo, t.entregado)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Entregas del mes" className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Entregas ({delMes.length})</h2>
            {delMes.length === 0 ? (
              <p className="text-sm text-text-muted">No hay entregas registradas en este mes.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {delMes.map((r) => (
                  <FilaPreconteo key={r.id} r={r} nombre={descripcion(r.codigo)} cantidad={(b) => cantidad(r.codigo, b)} alEditar={() => setEditando(r)} alBorrar={() => borrar(r)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <FormularioPreconteo
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
      <HojaRecepcion registro={recibiendo} ud={recibiendo ? ud(recibiendo.codigo) : undefined} alCerrar={() => setRecibiendo(null)} alRecibir={recibir} />
    </Pantalla>
  );
}

function FilaPreconteo({ r, nombre, cantidad, alEditar, alBorrar }: { r: RegistroPreconteo; nombre: string; cantidad: (base: number) => string; alEditar: () => void; alBorrar: () => void }) {
  const est = estadoPreconteo(r);
  const dif = diferenciaPreconteo(r);
  return (
    <li className="flex flex-col gap-1 rounded-2xl bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-mono text-xs text-text-muted">{r.codigo}</span>
          <span className="block text-sm">{nombre}</span>
        </span>
        <div className="flex shrink-0">
          <button type="button" aria-label={`Editar entrega ${r.codigo}`} onClick={alEditar} className="grid size-11 place-items-center rounded-xl text-text-muted hover:bg-surface-2">
            <Pencil aria-hidden className="size-4" />
          </button>
          <button type="button" aria-label={`Borrar entrega ${r.codigo}`} onClick={alBorrar} className="grid size-11 place-items-center rounded-xl text-text-muted hover:bg-surface-2">
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {fecha(r.fecha)} · entregado <span className="font-semibold text-text">{cantidad(r.cantidad)}</span> · de a {r.presentacion}
      </p>
      <p className="text-xs">
        {est === 'pendiente' && <span className="text-text-muted">Sin recibir</span>}
        {est === 'completo' && <span className="text-ok">Volvió completo</span>}
        {est === 'conDiferencia' && dif !== null && (
          <span className="text-text-muted">
            Recibido {cantidad(r.recibida ?? 0)} · diferencia{' '}
            <span className="font-bold text-text">
              {dif > 0 ? '+' : '-'}
              {cantidad(Math.abs(dif))}
            </span>
          </span>
        )}
      </p>
      {r.notas && <p className="text-xs text-text-muted">{r.notas}</p>}
    </li>
  );
}

function HojaRecepcion({
  registro,
  ud,
  alCerrar,
  alRecibir,
}: {
  registro: RegistroPreconteo | null;
  ud: string | undefined;
  alCerrar: () => void;
  alRecibir: (r: RegistroPreconteo, base: number) => void;
}) {
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const unidad = ud ? normalizarUD(ud) : 'UN';

  function guardar() {
    if (!registro) return;
    const res = validarRecepcion(Number(valor.replace(',', '.')), unidad);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    alRecibir(registro, res.valor);
    setValor('');
    setError(null);
  }

  return (
    <Hoja abierta={registro !== null} alCerrar={alCerrar} titulo="Recibir preconteo">
      {registro && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">
            Se entregaron <span className="font-semibold text-text">{ud ? formatearEnUD(registro.cantidad, ud) : `${formatearNumero(registro.cantidad)} u.`}</span>. ¿Volvió todo?
          </p>
          <Button onClick={() => alRecibir(registro, registro.cantidad)}>Volvió completo</Button>
          <div className="flex flex-col gap-2 border-t border-surface-2 pt-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Si no, cantidad que volvió ({ud ?? 'unidades'})
              <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm text-text" />
            </label>
            {valor !== '' && Number.isFinite(Number(valor.replace(',', '.'))) && (
              <p className="text-xs text-text-muted">
                = {formatearNumero(Number(valor.replace(',', '.')) * (registro.cantidad / deUnidadesBase(registro.cantidad, unidad)))} unidades
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-critical">
                {error}
              </p>
            )}
            <Button variante="secundario" onClick={guardar}>
              Registrar con diferencia
            </Button>
          </div>
        </div>
      )}
    </Hoja>
  );
}
