'use client';

import { Bot, Send, Trash2, WifiOff, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useEstadoSync } from '@/lib/db/sync';
import { MAX_PREGUNTA, SUGERENCIAS_CHANGO, type TurnoChango } from '@/lib/domain/chango';
import { parsearRespuesta, type Trozo } from '@/lib/chango/texto';
import { mensajeErrorChango, preguntarAChango } from '@/lib/functions/chango';

interface Mensaje extends TurnoChango {
  id: number;
  /** Respuesta que no es un dato de Chango (sin cuota, error): se muestra distinta y no entra al historial. */
  aviso?: boolean;
  fechaDatos?: string | null;
}

const Trozos = ({ trozos }: { trozos: Trozo[] }) => (
  <>
    {trozos.map((t, i) => (t.negrita ? <strong key={i}>{t.texto}</strong> : <Fragment key={i}>{t.texto}</Fragment>))}
  </>
);

function TextoRespuesta({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col gap-2">
      {parsearRespuesta(texto).map((b, i) =>
        b.tipo === 'parrafo' ? (
          <p key={i}>
            <Trozos trozos={b.trozos} />
          </p>
        ) : (
          <ul key={i} className="ml-4 list-disc">
            {b.items.map((it, j) => (
              <li key={j}>
                <Trozos trozos={it} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** Marca la última pregunta como sin respuesta útil para que no se reenvíe como historial. */
function marcarUltimaPregunta(mensajes: Mensaje[]): Mensaje[] {
  const i = mensajes.findLastIndex((m) => m.rol === 'usuario');
  return mensajes.map((m, j) => (j === i ? { ...m, aviso: true } : m));
}

/** Panel de chat de Chango IA. La conversación vive solo en pantalla; cada pregunta lleva los últimos turnos como contexto. */
export function PanelChango({ alCerrar }: { alCerrar: () => void }) {
  const { online } = useEstadoSync();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const contador = useRef(0);

  useEffect(() => {
    entrada.current?.focus();
  }, []);
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, enviando]);

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (limpia === '' || enviando || !online) return;
    // Lo que terminó en aviso (sin cuota, error) no entra al historial, ni la pregunta ni el aviso.
    const historial = mensajes.filter((m) => !m.aviso).map(({ rol, texto: t }) => ({ rol, texto: t }));
    setMensajes((m) => [...m, { id: ++contador.current, rol: 'usuario', texto: limpia }]);
    setTexto('');
    setEnviando(true);
    try {
      const r = await preguntarAChango(limpia, historial);
      const aviso = r.estado !== 'ok';
      setMensajes((m) => [
        ...(aviso ? marcarUltimaPregunta(m) : m),
        { id: ++contador.current, rol: 'chango', texto: r.respuesta, aviso, fechaDatos: r.estado === 'ok' ? r.fechaDatos : undefined },
      ]);
    } catch (e) {
      setMensajes((m) => [...marcarUltimaPregunta(m), { id: ++contador.current, rol: 'chango', texto: mensajeErrorChango(e), aviso: true }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Chango IA"
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] min-h-[50dvh] flex-col rounded-t-3xl bg-surface-2 shadow-2xl lg:inset-x-auto lg:top-0 lg:right-0 lg:max-h-none lg:w-[26rem] lg:rounded-none lg:rounded-l-3xl"
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <p className="flex items-center gap-2 font-semibold text-accent">
          <Bot aria-hidden className="size-5" />
          Chango IA
        </p>
        <div className="flex items-center">
          {mensajes.length > 0 && (
            <button type="button" aria-label="Borrar la conversación" onClick={() => setMensajes([])} className="grid size-11 place-items-center rounded-xl text-text-muted hover:bg-surface">
              <Trash2 aria-hidden className="size-4" />
            </button>
          )}
          <button type="button" aria-label="Cerrar Chango IA" onClick={alCerrar} className="grid size-11 place-items-center rounded-xl text-text-muted hover:bg-surface">
            <X aria-hidden className="size-5" />
          </button>
        </div>
      </header>

      <div aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2 text-sm">
        {mensajes.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-text-muted">Pregúntame por tu inventario, tus pendientes o tu mes. Respondo solo con los datos que hay en Stocky y te digo de qué fecha son.</p>
            <ul className="flex flex-col gap-2">
              {SUGERENCIAS_CHANGO.map((s) => (
                <li key={s}>
                  <button type="button" disabled={!online || enviando} onClick={() => void enviar(s)} className="min-h-11 w-full rounded-2xl bg-surface px-3 py-2 text-left text-sm disabled:opacity-50">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {mensajes.map((m) =>
          m.rol === 'usuario' ? (
            <p key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-accent px-3 py-2 text-bg">
              {m.texto}
            </p>
          ) : (
            <div key={m.id} className={`max-w-[92%] self-start rounded-2xl rounded-bl-md px-3 py-2 ${m.aviso ? 'bg-surface text-warning' : 'bg-surface'}`}>
              <TextoRespuesta texto={m.texto} />
              {m.fechaDatos && <p className="mt-2 text-[11px] text-text-muted">Datos del reporte de SIFA del {m.fechaDatos}. Chango sugiere; tú decides.</p>}
            </div>
          ),
        )}
        {enviando && (
          <p role="status" className="self-start animate-pulse rounded-2xl bg-surface px-3 py-2 text-text-muted">
            Chango está pensando…
          </p>
        )}
        <div ref={fin} />
      </div>

      {!online && (
        <p role="status" className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs text-warning">
          <WifiOff aria-hidden className="size-4 shrink-0" />
          Chango necesita conexión a internet. El resto de Stocky sigue funcionando sin ella.
        </p>
      )}
      <form
        className="flex items-end gap-2 px-4 pt-1 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
      >
        <label className="sr-only" htmlFor="pregunta-chango">
          Pregunta para Chango
        </label>
        <textarea
          id="pregunta-chango"
          ref={entrada}
          value={texto}
          rows={1}
          maxLength={MAX_PREGUNTA}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar(texto);
            }
          }}
          placeholder="Escribe tu pregunta"
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-surface px-3 py-2.5 text-sm text-text"
        />
        <button type="submit" aria-label="Enviar pregunta" disabled={enviando || !online || texto.trim() === ''} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-bg disabled:opacity-50">
          <Send aria-hidden className="size-5" />
        </button>
      </form>
    </div>
  );
}
