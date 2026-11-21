'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { BotonesExportar } from '@/components/reportes/BotonesExportar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import { suscribirUsuario } from '@/lib/db/usuario';
import { useRiesgo } from '@/lib/riesgo/useRiesgo';
import { borrarPedidoAldi, guardarPedidoAldi, restaurarPedidoAldi, suscribirPedidosAldi, type PedidoAldi } from '@/lib/db/pedidosAldi';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { formatearNumero } from '@/lib/domain/formato';
import {
  aplicarAjustes,
  calcularPedidoAldi,
  diasHabilesDelPeriodo,
  etiquetaPeriodo,
  FACTORES_ALDI,
  PERIODOS_ALDI,
  resumenPedidoAldi,
  validarParametrosAldi,
} from '@/lib/domain/pedidoAldi';
import { deUnidadesBase } from '@/lib/domain/unidades';
import { reportePedidoAldi } from '@/lib/reports/pedidoAldi';

const PAGINA = 50;
const fecha = (f: string) => format(parseISO(f), "d 'de' MMM yyyy", { locale: es });

/** `'otro'` = el valor lo escribe la persona. */
type Eleccion<T> = T | 'otro';

export default function PedidoAldiPantalla() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const es771 = estado.fase === 'listo' && (estado.sesion.unidad === '771' || estado.sesion.rol === 'superadmin');
  // `undefined` = cargando.
  const [existencias, setExistencias] = useState<Existencia[] | undefined>(undefined);
  const [guardados, setGuardados] = useState<PedidoAldi[] | undefined>(undefined);
  const [factorElegido, setFactorElegido] = useState<Eleccion<number>>(1.5);
  const [factorOtro, setFactorOtro] = useState('');
  const [diasElegidos, setDiasElegidos] = useState<Eleccion<number>>(30);
  const [diasOtro, setDiasOtro] = useState('');
  // Ajustes a mano: código → texto escrito (en la UD del producto).
  const [ajustes, setAjustes] = useState<Record<string, string>>({});
  const [visibles, setVisibles] = useState(PAGINA);
  // Feriados del usuario: los días hábiles del período salen del calendario laboral.
  const [feriados, setFeriados] = useState<readonly string[]>([]);
  // Consumo diario por producto (el mismo que usa el riesgo de agotamiento); `hayConsumos` es `undefined` mientras carga.
  const { riesgos, hayConsumos } = useRiesgo(es771 ? existencias : undefined);

  useEffect(() => {
    if (!uid || !es771) return;
    const bajas = [suscribirExistencias(uid, setExistencias), suscribirPedidosAldi(uid, setGuardados), suscribirUsuario(uid, (d) => setFeriados(d.feriados))];
    return () => bajas.forEach((b) => b());
  }, [uid, es771]);

  const parametros = useMemo(
    () =>
      validarParametrosAldi({
        factor: factorElegido === 'otro' ? Number(factorOtro.replace(',', '.')) : factorElegido,
        dias: diasElegidos === 'otro' ? Number(diasOtro) : diasElegidos,
      }),
    [factorElegido, factorOtro, diasElegidos, diasOtro],
  );

  const diasHabiles = useMemo(() => (parametros.ok ? diasHabilesDelPeriodo(hoyCostaRica(), parametros.valor.dias, feriados) : 0), [parametros, feriados]);

  const calculado = useMemo(
    () =>
      parametros.ok && existencias && hayConsumos !== undefined && diasHabiles > 0
        ? calcularPedidoAldi(
            existencias.map((e) => ({ ...e, consumoDiario: riesgos.get(e.codigo)?.consumoDiario ?? null })),
            { ...parametros.valor, diasHabiles },
          )
        : null,
    [parametros, existencias, hayConsumos, riesgos, diasHabiles],
  );
  const lineas = useMemo(() => (calculado ? aplicarAjustes(calculado.lineas, ajustes) : []), [calculado, ajustes]);
  const resumen = resumenPedidoAldi(lineas);
  const fechaReporte = useMemo(
    () => (existencias && existencias.length > 0 ? hoyCostaRica(new Date(Math.max(...existencias.map((p) => p.actualizadoEn.toMillis())))) : null),
    [existencias],
  );

  if (estado.fase !== 'listo' || !uid) return null;
  if (!es771) {
    return (
      <Pantalla titulo="Pedido al ALDI">
        <Card className="text-sm text-text-muted">El pedido al ALDI es del Almacén Local 771.</Card>
      </Pantalla>
    );
  }
  const sesion = estado.sesion;
  const emisor = () => ({ usuario: sesion.nombre, unidad: sesion.unidad ?? '', generadoEn: new Date() });

  function cambiarParametro(fn: () => void) {
    fn();
    // Otro factor u otro período cambia todo lo calculado: los ajustes a mano ya no valdrían.
    setAjustes({});
    setVisibles(PAGINA);
  }

  function guardar() {
    if (!uid || !parametros.ok || lineas.length === 0) return;
    void guardarPedidoAldi(uid, { fecha: hoyCostaRica(), fechaReporteSifa: fechaReporte, factor: parametros.valor.factor, dias: parametros.valor.dias, lineas }).catch(() =>
      mostrar('No se pudo guardar el pedido.', { tono: 'error' }),
    );
    mostrar('Pedido guardado en el historial.', { tono: 'ok' });
  }

  function borrar(p: PedidoAldi) {
    if (!uid) return;
    void borrarPedidoAldi(uid, p.id).catch(() => mostrar('No se pudo borrar el pedido.', { tono: 'error' }));
    mostrar('Pedido borrado.', {
      accion: { etiqueta: 'Deshacer', alPulsar: () => void restaurarPedidoAldi(uid, p).catch(() => mostrar('No se pudo restaurar.', { tono: 'error' })) },
    });
  }

  const chip = (activo: boolean) =>
    `min-h-11 shrink-0 rounded-full px-4 text-sm transition duration-200 ${activo ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`;
  const campo = 'min-h-11 w-28 rounded-xl bg-surface-2 px-3 text-sm text-text';

  return (
    <Pantalla titulo="Pedido al ALDI">
      <Link href="/inventario/" className="-mt-2 inline-flex min-h-11 items-center gap-2 self-start text-sm text-text-muted">
        <ArrowLeft aria-hidden className="size-4" />
        Inventario
      </Link>

      <p className="text-sm text-text-muted">
        Propuesta para reponer las existencias del 771: se repone hasta lo menor entre la cuota (el tope permitido) y el consumo del período × el factor, menos la existencia, hacia arriba a la UD entera. Tú la revisas y ajustas; el pedido se tramita en SIFA/SAP.
      </p>

      <section aria-label="Parámetros del pedido" className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Factor</h2>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Factor">
            {FACTORES_ALDI.map((f) => (
              <button key={f} type="button" aria-pressed={factorElegido === f} onClick={() => cambiarParametro(() => setFactorElegido(f))} className={chip(factorElegido === f)}>
                × {formatearNumero(f)}
              </button>
            ))}
            <button type="button" aria-pressed={factorElegido === 'otro'} onClick={() => cambiarParametro(() => setFactorElegido('otro'))} className={chip(factorElegido === 'otro')}>
              Otro
            </button>
            {factorElegido === 'otro' && (
              <input
                inputMode="decimal"
                aria-label="Factor (ej. 1.75)"
                placeholder="ej. 1.75"
                value={factorOtro}
                onChange={(e) => cambiarParametro(() => setFactorOtro(e.target.value))}
                className={campo}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Período que cubre el pedido</h2>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
            {PERIODOS_ALDI.map((p) => (
              <button key={p.dias} type="button" aria-pressed={diasElegidos === p.dias} onClick={() => cambiarParametro(() => setDiasElegidos(p.dias))} className={chip(diasElegidos === p.dias)}>
                {p.etiqueta}
              </button>
            ))}
            <button type="button" aria-pressed={diasElegidos === 'otro'} onClick={() => cambiarParametro(() => setDiasElegidos('otro'))} className={chip(diasElegidos === 'otro')}>
              Otro
            </button>
            {diasElegidos === 'otro' && (
              <input
                inputMode="numeric"
                aria-label="Días del período"
                placeholder="días"
                value={diasOtro}
                onChange={(e) => cambiarParametro(() => setDiasOtro(e.target.value))}
                className={campo}
              />
            )}
          </div>
          <p className="text-xs text-text-muted">El consumo se calcula con los días hábiles del período. El factor es el margen de seguridad sobre el consumo; la cuota nunca se pasa.</p>
        </div>

        {!parametros.ok && (
          <p role="alert" className="text-sm text-critical">
            {parametros.error}
          </p>
        )}
        {parametros.ok && diasHabiles === 0 && (
          <p role="alert" className="text-sm text-critical">
            Ese período no tiene días hábiles: elige uno más largo.
          </p>
        )}
      </section>

      {existencias === undefined ? (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Cargando…
        </Card>
      ) : existencias.length === 0 ? (
        <Card className="text-sm text-text-muted">
          Para calcular el pedido necesitas la existencia de SIFA.{' '}
          <Link href="/importar/" className="font-semibold text-accent">
            Importa el reporte de existencias
          </Link>
          .
        </Card>
      ) : (
        calculado &&
        parametros.ok && (
          <>
            <Card className="flex flex-col gap-1 text-sm">
              <p className="font-semibold">
                {resumen.productos} {resumen.productos === 1 ? 'producto' : 'productos'} a pedir · {etiquetaPeriodo(parametros.valor.dias)} · × {formatearNumero(parametros.valor.factor)}
              </p>
              <p className="text-xs text-text-muted">
                Existencias del reporte de SIFA{fechaReporte ? ` del ${fecha(fechaReporte)}` : ''}. Omitidos: sin cuota {calculado.sinCuota} · sin existencia en el reporte {calculado.sinExistencia} · sin movimiento (consumo 0) {calculado.sinMovimiento} · ya cubiertos {calculado.yaCubiertos}
                {resumen.ajustadas > 0 ? ` · ajustados a mano: ${resumen.ajustadas}` : ''}.
              </p>
            </Card>

            {(resumen.limitadasPorCuota > 0 || resumen.sinConsumo > 0 || hayConsumos === false) && (
              <Card className="flex flex-col gap-1 text-xs text-text-muted">
                {hayConsumos === false && <p className="text-warning">No hay consumos cargados: todo se repone hasta la cuota. Importa «Productos en despacho» para ajustar por consumo.</p>}
                {resumen.limitadasPorCuota > 0 && (
                  <p>
                    <span className="font-semibold text-warning">{resumen.limitadasPorCuota} limitadas por la cuota:</span> el consumo × factor pide más de lo permitido; puede que su cuota esté desactualizada.
                  </p>
                )}
                {resumen.sinConsumo > 0 && hayConsumos !== false && <p>{resumen.sinConsumo} sin consumo cargado: se repuso hasta la cuota.</p>}
              </Card>
            )}

            <section aria-label="Guardar y exportar" className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={guardar} disabled={lineas.length === 0}>
                  <Save aria-hidden className="size-4" />
                  Guardar pedido
                </Button>
                <BotonesExportar
                  deshabilitado={lineas.length === 0}
                  armar={() => reportePedidoAldi(lineas, { fecha: hoyCostaRica(), fechaReporteSifa: fechaReporte, ...parametros.valor }, emisor())}
                />
              </div>
            </section>

            {lineas.length === 0 ? (
              <Card className="text-center text-sm text-text-muted">Con estos parámetros no hay nada que pedir.</Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {calculado.lineas.slice(0, visibles).map((l) => {
                  const final = lineas.find((x) => x.codigo === l.codigo);
                  const cantidad = final?.cantidad ?? 0;
                  return (
                    <li key={l.codigo} className={`flex flex-col gap-2 rounded-2xl p-3 ${cantidad !== l.calculada ? 'bg-diferencia' : 'bg-surface'}`}>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm">{l.codigo}</span>
                        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted">{l.ud}</span>
                        {cantidad !== l.calculada && <span className="rounded-md bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-info">Ajustado</span>}
                        {l.criterio === 'limitadaPorCuota' && <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">Limitada por la cuota</span>}
                        {l.criterio === 'sinConsumo' && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted">Sin consumo</span>}
                      </p>
                      <p className="truncate text-sm">{l.descripcion}</p>
                      <p className="text-xs text-text-muted">
                        Cuota {formatearNumero(deUnidadesBase(l.cuota, l.ud))} · hay {formatearNumero(deUnidadesBase(l.existencia, l.ud))} · consumo del período {l.consumo == null ? '—' : formatearNumero(deUnidadesBase(l.consumo, l.ud))} · objetivo {formatearNumero(deUnidadesBase(l.objetivo, l.ud))} · sugerido {l.calculada} {l.ud}
                      </p>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-text-muted">A pedir ({l.ud})</span>
                        <input
                          inputMode="numeric"
                          aria-label={`A pedir de ${l.codigo}, en ${l.ud}`}
                          value={ajustes[l.codigo] ?? String(l.calculada)}
                          onChange={(e) => setAjustes((a) => ({ ...a, [l.codigo]: e.target.value }))}
                          className="min-h-11 w-28 rounded-xl bg-surface-2 px-3 text-right tabular-nums text-text"
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {calculado.lineas.length > visibles && (
              <button type="button" onClick={() => setVisibles((v) => v + PAGINA)} className="min-h-11 rounded-2xl bg-surface-2 text-sm font-semibold">
                Mostrar más ({calculado.lineas.length - visibles})
              </button>
            )}
          </>
        )
      )}

      <section aria-label="Pedidos guardados" className="mt-4 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Pedidos guardados</h2>
        {guardados === undefined ? (
          <p role="status" className="animate-pulse text-sm text-text-muted">
            Cargando…
          </p>
        ) : guardados.length === 0 ? (
          <p className="text-sm text-text-muted">Aún no hay pedidos guardados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {guardados.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{fecha(p.fecha)}</span>
                    <span className="block text-xs text-text-muted">
                      {p.lineas.length} productos · {etiquetaPeriodo(p.dias)} · × {formatearNumero(p.factor)}
                      {p.fechaReporteSifa ? ` · SIFA del ${fecha(p.fechaReporteSifa)}` : ''}
                    </span>
                  </span>
                  <button type="button" aria-label={`Borrar el pedido del ${fecha(p.fecha)}`} onClick={() => borrar(p)} className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted hover:bg-surface-2">
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
                <BotonesExportar armar={() => reportePedidoAldi(p.lineas, { fecha: p.fecha, fechaReporteSifa: p.fechaReporteSifa, factor: p.factor, dias: p.dias }, emisor())} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Pantalla>
  );
}
