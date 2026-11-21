'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pantalla } from '@/components/layout/Pantalla';
import { SelectorMes } from '@/components/registros/SelectorMes';
import { BotonesExportar } from '@/components/reportes/BotonesExportar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth/AuthProvider';
import { suscribirAgotados } from '@/lib/db/agotados';
import { suscribirDanados } from '@/lib/db/danados';
import { suscribirExistencias, type Existencia } from '@/lib/db/existencias';
import { suscribirPreconteos } from '@/lib/db/preconteos';
import { suscribirCumplimientos, suscribirTareas } from '@/lib/db/tareas';
import { suscribirProgramados, suscribirSeguimientos } from '@/lib/db/pedidosEnvios';
import { suscribirTraslados } from '@/lib/db/traslados';
import type { Programado, Seguimiento } from '@/lib/domain/pedidosEnvios';
import { guardarResumenSecciones, suscribirUsuario, type DatosUsuario } from '@/lib/db/usuario';
import { suscribirVencidos } from '@/lib/db/vencidos';
import type { RegistroAgotado } from '@/lib/domain/agotados';
import { hoyCostaRica, sumarDias } from '@/lib/domain/calendario';
import type { RegistroDanado } from '@/lib/domain/danados';
import type { RegistroPreconteo } from '@/lib/domain/preconteo';
import { MARGEN_RIESGO_INICIAL } from '@/lib/domain/riesgo';
import {
  ETIQUETA_SECCION,
  normalizarSeleccion,
  SECCIONES_RESUMEN,
  seccionesDisponibles,
  seleccionEfectiva,
  type SeccionResumen,
} from '@/lib/domain/resumenSecciones';
import { ocurrencias, VENTANA_ATRAS, type Cumplimiento, type Tarea } from '@/lib/domain/tareas';
import type { RegistroTraslado } from '@/lib/domain/traslados';
import type { RegistroVencido } from '@/lib/domain/vencidos';
import { bajosYRiesgo } from '@/lib/domain/bajosRiesgo';
import { reporteBajosYRiesgo } from '@/lib/reports/bajosRiesgo';
import { inicioFinMes, reporteResumenMensual } from '@/lib/reports/resumen';
import { useRiesgo } from '@/lib/riesgo/useRiesgo';

const DETALLE_SECCION: Record<SeccionResumen, string> = {
  tareas: 'Hechas, pospuestas, descartadas y sin hacer, por tarea',
  preconteo: 'Entregado y recibido por producto y presentación',
  traslados: 'Cada traslado con su orden SAP y el trámite SAP/SIFA',
  danados: 'Cada dañado con lote, cantidad y motivo',
  vencidos: 'Lotes vencidos del mes (la meta es cero)',
  agotados: 'Agotados del mes y días sin existencia',
  envios: 'Cada envío a un puesto del mes y si se hizo',
  pedidos: 'Cada pedido del mes y si se tramitó',
};

export default function Reportes() {
  const { estado } = useAuth();
  const uid = estado.fase === 'listo' ? estado.sesion.uid : null;
  const [datosUsuario, setDatosUsuario] = useState<DatosUsuario | undefined>(undefined);
  const [mes, setMes] = useState(() => hoyCostaRica().slice(0, 7));
  // Mientras la persona no toca nada se usa lo guardado; al tocar, manda lo local.
  const [local, setLocal] = useState<SeccionResumen[] | null>(null);

  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cumplimientos, setCumplimientos] = useState<Cumplimiento[]>([]);
  const [preconteos, setPreconteos] = useState<RegistroPreconteo[]>([]);
  const [traslados, setTraslados] = useState<RegistroTraslado[]>([]);
  const [danados, setDanados] = useState<RegistroDanado[]>([]);
  const [vencidos, setVencidos] = useState<RegistroVencido[]>([]);
  const [agotados, setAgotados] = useState<RegistroAgotado[]>([]);
  const [envios, setEnvios] = useState<Programado[]>([]);
  const [pedidos, setPedidos] = useState<Programado[]>([]);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [existencias, setExistencias] = useState<Existencia[]>([]);

  const hoy = hoyCostaRica();
  const mesActual = hoy.slice(0, 7);
  const es771 = estado.fase === 'listo' && (estado.sesion.unidad === '771' || estado.sesion.rol === 'superadmin');

  useEffect(() => {
    if (!uid) return;
    return suscribirUsuario(uid, setDatosUsuario);
  }, [uid]);

  // Bajos y riesgo usa las existencias y los consumos del 771 (el 772 no tiene el módulo de inventario).
  const { riesgos, hayConsumos } = useRiesgo(es771 ? existencias : undefined);

  const disponibles = useMemo(
    () => (es771 ? seccionesDisponibles('todos') : datosUsuario ? seccionesDisponibles(datosUsuario.modulosHabilitados) : []),
    [es771, datosUsuario],
  );
  const guardadas = useMemo(() => normalizarSeleccion(datosUsuario?.resumenSecciones), [datosUsuario]);
  const elegidas = seleccionEfectiva(local ?? guardadas, disponibles);

  // Solo se leen las colecciones de las secciones disponibles (el 772 no puede leer las demás).
  useEffect(() => {
    if (!uid || datosUsuario === undefined) return;
    const { desde } = inicioFinMes(mes);
    const bajas = [suscribirExistencias(uid, setExistencias)];
    if (disponibles.includes('tareas')) {
      bajas.push(suscribirTareas(uid, setTareas), suscribirCumplimientos(uid, sumarDias(desde, -VENTANA_ATRAS), setCumplimientos));
    }
    if (disponibles.includes('preconteo')) bajas.push(suscribirPreconteos(uid, setPreconteos));
    if (disponibles.includes('traslados')) bajas.push(suscribirTraslados(uid, setTraslados));
    if (disponibles.includes('danados')) bajas.push(suscribirDanados(uid, setDanados));
    if (disponibles.includes('vencidos')) bajas.push(suscribirVencidos(uid, setVencidos));
    if (disponibles.includes('agotados')) bajas.push(suscribirAgotados(uid, setAgotados));
    if (disponibles.includes('envios')) bajas.push(suscribirProgramados(uid, 'envio', setEnvios));
    if (disponibles.includes('pedidos')) bajas.push(suscribirProgramados(uid, 'pedido', setPedidos));
    if (disponibles.includes('envios') || disponibles.includes('pedidos')) bajas.push(suscribirSeguimientos(uid, desde, setSeguimientos));
    return () => bajas.forEach((b) => b());
  }, [uid, mes, datosUsuario, disponibles]);

  if (!uid || estado.fase !== 'listo') return null;
  const sesion = estado.sesion;

  function alternar(s: SeccionResumen) {
    if (!uid) return;
    const siguiente = elegidas.includes(s) ? elegidas.filter((x) => x !== s) : SECCIONES_RESUMEN.filter((x) => x === s || elegidas.includes(x));
    setLocal(siguiente);
    // Se recuerda la elección (también sin conexión); si falla no pasa nada, vale lo que se ve.
    void guardarResumenSecciones(uid, siguiente).catch(() => undefined);
  }

  function armar() {
    if (elegidas.length === 0) return null;
    const { desde, hasta } = inicioFinMes(mes);
    const tope = hasta < hoy ? hasta : hoy;
    return reporteResumenMensual(
      {
        mes,
        hasta: tope,
        ocurrencias: elegidas.includes('tareas') ? ocurrencias(tareas, cumplimientos, desde, tope, datosUsuario?.feriados ?? []) : [],
        preconteos,
        traslados,
        danados,
        vencidos,
        agotados,
        envios,
        pedidos,
        seguimientos,
        feriados: datosUsuario?.feriados ?? [],
        descripciones: new Map(existencias.map((e) => [e.codigo, e.descripcion])),
        uds: new Map(existencias.map((e) => [e.codigo, e.ud])),
      },
      elegidas,
      { usuario: sesion.nombre, unidad: sesion.unidad ?? '', generadoEn: new Date() },
    );
  }

  function armarBajosRiesgo() {
    if (hayConsumos === undefined || existencias.length === 0) return null;
    const fechaReporte = hoyCostaRica(new Date(Math.max(...existencias.map((p) => p.actualizadoEn.toMillis()))));
    return reporteBajosYRiesgo(
      bajosYRiesgo(existencias, riesgos),
      { fechaReporte, margen: datosUsuario?.margenRiesgo ?? MARGEN_RIESGO_INICIAL, hayConsumos },
      { usuario: sesion.nombre, unidad: sesion.unidad ?? '', generadoEn: new Date() },
      hoy,
    );
  }

  return (
    <Pantalla titulo="Reportes">
      <section aria-label="Resumen mensual de labores" className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <div>
          <h2 className="text-lg font-semibold">Resumen mensual de labores</h2>
          <p className="text-xs text-text-muted">Elige qué incluir. Se recuerda tu elección para el próximo mes.</p>
        </div>

        <SelectorMes mes={mes} mesActual={mesActual} alCambiar={setMes} />

        {datosUsuario === undefined ? (
          <p role="status" className="animate-pulse text-sm text-text-muted">
            Cargando…
          </p>
        ) : (
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">Secciones del resumen</legend>
            {disponibles.map((s) => (
              <label key={s} className="flex min-h-11 items-start gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <input type="checkbox" checked={elegidas.includes(s)} onChange={() => alternar(s)} className="mt-0.5 size-5 shrink-0 accent-accent" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{ETIQUETA_SECCION[s]}</span>
                  <span className="block text-xs text-text-muted">{DETALLE_SECCION[s]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {elegidas.length === 0 && datosUsuario !== undefined && <p className="text-sm text-warning">Marca al menos una sección para generar el resumen.</p>}
        <BotonesExportar armar={armar} deshabilitado={elegidas.length === 0 || datosUsuario === undefined} />
        <p className="text-xs text-text-muted">El archivo se genera en tu dispositivo, también sin conexión.</p>
      </section>

      {es771 && (
        <section aria-label="Bajos y riesgo" className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">Bajos y riesgo</h2>
            <p className="text-xs text-text-muted">
              Al día: productos críticos (no alcanzan hasta el próximo ingreso), en riesgo y bajo la cuota mínima, de lo más urgente a lo menos.
            </p>
          </div>
          {existencias.length === 0 ? (
            <p className="text-sm text-text-muted">Importa el reporte de existencias para generar este reporte.</p>
          ) : (
            <>
              {hayConsumos === false && (
                <p className="text-xs text-warning">Sin consumos cargados solo se listan los bajos. Importa «Productos en despacho» para incluir el riesgo.</p>
              )}
              <BotonesExportar armar={armarBajosRiesgo} deshabilitado={hayConsumos === undefined} />
            </>
          )}
        </section>
      )}

      <Card className="text-sm text-text-muted">
        El reporte de agotados por período sigue en Inventario. Los reportes de Tareas, Vencimientos y Ubicaciones llegan con sus módulos.
      </Card>
    </Pantalla>
  );
}
