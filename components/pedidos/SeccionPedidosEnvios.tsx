'use client';

import { CalendarClock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { sembrarProgramados } from '@/lib/db/pedidosEnvios';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { programadosSugeridos, vistaPedidosEnvios, type OcurrenciaProgramada } from '@/lib/domain/pedidosEnvios';
import { useAvanzar, usePedidosEnvios } from '@/lib/pedidos/usePedidosEnvios';
import { FilaPedidoEnvio } from './FilaPedidoEnvio';

/** «Pedidos y envíos» de Hoy (PRD M4 y M5). Solo el 771. */
export function SeccionPedidosEnvios() {
  const { mostrar } = useToast();
  const { uid, aplica, feriados, programados, seguimientos, cargando } = usePedidosEnvios();
  const avanzar = useAvanzar(uid, seguimientos);
  const hoy = hoyCostaRica();
  const vista = useMemo(() => vistaPedidosEnvios(programados, seguimientos, hoy, feriados), [programados, seguimientos, hoy, feriados]);

  if (!aplica || cargando) return null;

  function sembrar() {
    if (!uid) return;
    void sembrarProgramados(uid, programadosSugeridos(hoy)).catch(() => mostrar('No se pudieron cargar.', { tono: 'error' }));
    mostrar('Pedidos y envíos cargados. Puedes editarlos en Agenda.', { tono: 'ok' });
  }

  if (programados.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="font-semibold">Aún no hay pedidos ni envíos</p>
        <p className="text-sm text-text-muted">
          Puedes cargar los envíos a R, C, V y Z, el pedido semanal del 772 y el de sueros, con sus días, y ajustarlos después.
        </p>
        <Button onClick={sembrar}>Cargar pedidos y envíos</Button>
      </Card>
    );
  }

  const preparar = vista.proximos.filter((p) => p.preparar);
  const despues = vista.proximos.filter((p) => !p.preparar);
  const nada = vista.hoy.length + vista.atrasados.length + preparar.length === 0;
  const fila = (o: OcurrenciaProgramada, prep = false) => (
    <FilaPedidoEnvio key={`${o.programadoId}_${o.fecha}`} o={o} hoy={hoy} preparar={prep} alAvanzar={() => avanzar(o)} />
  );

  return (
    <section aria-label="Pedidos y envíos" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pedidos y envíos</h2>
        <Link href="/agenda/" className="inline-flex min-h-11 items-center text-sm text-accent">
          Ver agenda
        </Link>
      </div>

      {nada && (
        <Card className="flex items-center gap-2 text-sm text-text-muted">
          <CheckCircle2 aria-hidden className="size-5 text-ok" />
          Nada por tramitar ni enviar por ahora.
        </Card>
      )}

      {vista.atrasados.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-warning">Atrasados ({vista.atrasados.length})</h3>
          <ul className="flex flex-col gap-2">{vista.atrasados.map((o) => fila(o))}</ul>
        </>
      )}
      {vista.hoy.length > 0 && (
        <>
          <h3 className="text-sm font-semibold">Hoy</h3>
          <ul className="flex flex-col gap-2">{vista.hoy.map((o) => fila(o))}</ul>
        </>
      )}
      {preparar.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-info">Para preparar</h3>
          <ul className="flex flex-col gap-2">{preparar.map((o) => fila(o, true))}</ul>
        </>
      )}
      {despues.length > 0 && (
        <details className="rounded-2xl bg-surface p-3 text-sm">
          <summary className="flex min-h-8 cursor-pointer items-center gap-2 text-text-muted">
            <CalendarClock aria-hidden className="size-4" />
            Próximos 7 días ({despues.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">{despues.map((o) => fila(o))}</ul>
        </details>
      )}
    </section>
  );
}
