'use client';

import { FileUp } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type DragEvent } from 'react';
import { VistaPrevia } from '@/components/importar/VistaPrevia';
import { VistaPreviaLotes } from '@/components/importar/VistaPreviaLotes';
import { Pantalla } from '@/components/layout/Pantalla';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth/AuthProvider';
import { consolidarFilas, separarNuevos, validarDespacho, type ProductoConsolidado } from '@/lib/domain/consolidado';
import { hoyCostaRica } from '@/lib/domain/calendario';
import { TABLA_UD_INICIAL } from '@/lib/domain/unidades';
import { crearCodigosCatalogo, leerCodigosCatalogo } from '@/lib/db/catalogo';
import { leerExistencias } from '@/lib/db/existencias';
import { guardarImportacion } from '@/lib/db/importaciones';
import { guardarCargaLotes, leerLotes } from '@/lib/db/lotes';
import { lotesDesdeFilas, revisarCarga, type Lote, type LoteGuardado, type RevisionLotes } from '@/lib/domain/lotes';
import { useEstadoSync } from '@/lib/db/sync';
import { leerPdfEnNavegador } from '@/lib/pdf/leerPdf';
import { esReporteLotes, parsearLotes, type ResultadoLotes } from '@/lib/pdf/lotes';
import { parsearReporte } from '@/lib/pdf/parser';
import { ErrorReporte, type ResultadoReporte } from '@/lib/pdf/tipos';

const MAX_BYTES = 25 * 1024 * 1024;

interface Previa {
  archivo: string;
  resultado: ResultadoReporte;
  productos: ProductoConsolidado[];
  nuevos: string[];
  sembrar: boolean;
  catalogoDisponible: boolean;
  bloqueo: string | null;
}

interface PreviaLotes {
  archivo: string;
  resultado: ResultadoLotes;
  lotes: Lote[];
  anteriores: LoteGuardado[];
  revision: RevisionLotes;
  bloqueo: string | null;
}

type Fase =
  | { tipo: 'inicio' }
  | { tipo: 'leyendo'; archivo: string }
  | { tipo: 'previa'; previa: Previa }
  | { tipo: 'previaLotes'; previa: PreviaLotes }
  | { tipo: 'listo'; filas: number; unidad: 'productos' | 'lotes' };

export default function Importar() {
  const { estado } = useAuth();
  const { mostrar } = useToast();
  const { online } = useEstadoSync();
  const [fase, setFase] = useState<Fase>({ tipo: 'inicio' });
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  // Cada carga de lotes exige confirmar que se revisaron los cambios.
  const [revisado, setRevisado] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  if (estado.fase !== 'listo') return null;
  const { sesion } = estado;

  async function procesar(archivo: File) {
    setError(null);
    if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) {
      setError('El archivo debe ser un PDF.');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      setError('El PDF pesa más de 25 MB. Revisa que sea el reporte correcto.');
      return;
    }
    setFase({ tipo: 'leyendo', archivo: archivo.name });
    try {
      const lineas = await leerPdfEnNavegador(archivo);
      if (esReporteLotes(lineas)) {
        await procesarLotes(archivo.name, lineas);
        return;
      }
      const resultado = parsearReporte(lineas);
      const bloqueo = validarDespacho(resultado.despacho, sesion.unidad, sesion.rol === 'superadmin')?.motivo ?? null;

      let catalogo = new Set<string>();
      let catalogoDisponible = true;
      try {
        catalogo = await leerCodigosCatalogo();
      } catch {
        catalogoDisponible = false;
      }
      const { nuevos, sembrar } = catalogoDisponible
        ? separarNuevos(resultado.filas.map((f) => f.codigo), catalogo)
        : { nuevos: [], sembrar: false };

      setFase({
        tipo: 'previa',
        previa: {
          archivo: archivo.name,
          resultado,
          productos: consolidarFilas(resultado.filas, TABLA_UD_INICIAL),
          nuevos,
          sembrar,
          catalogoDisponible,
          bloqueo,
        },
      });
    } catch (e) {
      setFase({ tipo: 'inicio' });
      setError(e instanceof ErrorReporte ? e.message : 'No pude leer el PDF. Verifica que no esté dañado ni protegido.');
    }
  }

  async function procesarLotes(nombre: string, lineas: string[]) {
    const resultado = parsearLotes(lineas);
    const bloqueoDespacho = validarDespacho(resultado.despacho, sesion.unidad, sesion.rol === 'superadmin')?.motivo ?? null;
    const lotes = lotesDesdeFilas(resultado.filas, TABLA_UD_INICIAL);

    // Lo guardado antes y las existencias de SIFA sirven para comparar; sin red y sin copia local se sigue sin ellas.
    let anteriores: LoteGuardado[] = [];
    let comparacionDisponible = true;
    try {
      anteriores = await leerLotes(sesion.uid);
    } catch {
      comparacionDisponible = false;
    }
    let existencias: Awaited<ReturnType<typeof leerExistencias>> | null = null;
    try {
      existencias = await leerExistencias(sesion.uid);
    } catch {
      existencias = null;
    }

    const revision = revisarCarga({ nuevos: lotes, anteriores, existencias, fechaReporte: resultado.fechaReporte, hoy: hoyCostaRica() });
    // Sin poder ver lo anterior no se guarda: marcaría como agotado lo que no se pudo comparar.
    const bloqueo =
      bloqueoDespacho ??
      (!comparacionDisponible ? 'No pude leer los lotes guardados (sin conexión y sin copia local), así que no puedo comparar. Conéctate e inténtalo de nuevo.' : null) ??
      (resultado.cuadra === false ? 'El valor de las filas leídas no cuadra con el total del reporte: falta o sobra alguna fila. No se guarda.' : null) ??
      (revision.fecha.nivel === 'bloqueo' ? revision.fecha.mensaje : null);
    setRevisado(false);
    setFase({ tipo: 'previaLotes', previa: { archivo: nombre, resultado, lotes, anteriores, revision, bloqueo } });
  }

  function guardarLotes(p: PreviaLotes) {
    const { confirmada } = guardarCargaLotes({
      uid: sesion.uid,
      fechaReporte: p.resultado.fechaReporte ?? hoyCostaRica(),
      archivo: p.archivo,
      lotes: p.lotes,
      anteriores: p.anteriores,
      cambios: p.revision.cambios,
    });
    void confirmada.catch(() => mostrar('No se pudieron sincronizar los lotes con el servidor. Se reintentará.', { tono: 'error' }));
    mostrar(online ? `Lotes guardados · ${p.lotes.length} lotes.` : 'Guardado en este dispositivo. Se sincroniza al volver la conexión.', { tono: 'ok' });
    setFase({ tipo: 'listo', filas: p.lotes.length, unidad: 'lotes' });
  }

  function guardar(p: Previa) {
    const { confirmada } = guardarImportacion({
      uid: sesion.uid,
      tipo: p.resultado.tipo,
      fechaReporte: p.resultado.fechaReporte ?? hoyCostaRica(),
      archivo: p.archivo,
      productos: p.productos,
      codigosNuevos: p.nuevos.length,
    });
    void confirmada.catch(() => mostrar('No se pudo sincronizar el reporte con el servidor. Se reintentará.', { tono: 'error' }));

    if (p.catalogoDisponible) {
      const aCrear = p.sembrar ? p.productos : p.productos.filter((x) => p.nuevos.includes(x.codigo));
      if (aCrear.length > 0) {
        void crearCodigosCatalogo(aCrear, !p.sembrar, TABLA_UD_INICIAL).catch(() =>
          mostrar('No se pudieron registrar los códigos nuevos en el catálogo.', { tono: 'error' }),
        );
      }
    }
    mostrar(
      online ? `Reporte guardado · ${p.productos.length} productos.` : 'Guardado en este dispositivo. Se sincroniza al volver la conexión.',
      { tono: 'ok' },
    );
    setFase({ tipo: 'listo', filas: p.productos.length, unidad: 'productos' });
  }

  function alSoltar(e: DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    const f = e.dataTransfer.files[0];
    if (f) void procesar(f);
  }

  return (
    <Pantalla titulo="Importar reporte">
      {fase.tipo === 'inicio' && (
        <>
          <Card
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={alSoltar}
            className={`flex flex-col items-center gap-3 border-2 border-dashed p-8 text-center transition duration-200 ${arrastrando ? 'border-accent bg-surface-2' : 'border-white/10'}`}
          >
            <FileUp aria-hidden className="size-8 text-accent" />
            <p className="font-semibold">Arrastra el PDF de SIFA aquí</p>
            <p className="text-sm text-text-muted">o elígelo desde tu dispositivo. El archivo se lee en tu equipo y no se sube a ningún servidor.</p>
            <Button onClick={() => entrada.current?.click()}>Elegir PDF</Button>
            <input
              ref={entrada}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Elegir PDF del reporte"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void procesar(f);
                e.target.value = '';
              }}
            />
          </Card>
          {error && (
            <p role="alert" className="rounded-2xl bg-critical/10 p-3 text-sm text-critical">
              {error}
            </p>
          )}
          <p className="text-xs text-text-muted">Reportes reconocidos: existencias de despacho, productos en despacho y lotes y vencimientos.</p>
        </>
      )}

      {fase.tipo === 'leyendo' && (
        <Card role="status" className="animate-pulse text-center text-sm text-text-muted">
          Leyendo {fase.archivo}…
        </Card>
      )}

      {fase.tipo === 'previa' && (
        <>
          <VistaPrevia
            resultado={fase.previa.resultado}
            archivo={fase.previa.archivo}
            nuevos={fase.previa.nuevos}
            sembrar={fase.previa.sembrar}
            catalogoDisponible={fase.previa.catalogoDisponible}
          />
          {fase.previa.bloqueo && (
            <p role="alert" className="rounded-2xl bg-critical/10 p-3 text-sm text-critical">
              {fase.previa.bloqueo}
            </p>
          )}
          <div className="sticky bottom-20 flex gap-3 pr-18 lg:bottom-4">
            <Button variante="secundario" className="flex-1" onClick={() => setFase({ tipo: 'inicio' })}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={fase.previa.bloqueo !== null} onClick={() => guardar(fase.previa)}>
              Guardar
            </Button>
          </div>
        </>
      )}

      {fase.tipo === 'previaLotes' && (
        <>
          <VistaPreviaLotes resultado={fase.previa.resultado} archivo={fase.previa.archivo} lotes={fase.previa.lotes} revision={fase.previa.revision} />
          {fase.previa.bloqueo && (
            <p role="alert" className="rounded-2xl bg-critical/10 p-3 text-sm text-critical">
              {fase.previa.bloqueo}
            </p>
          )}
          <div className="sticky bottom-20 flex flex-col gap-3 rounded-2xl bg-bg/95 p-3 pr-18 lg:bottom-4">
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-[#2DD4BF]"
                checked={revisado}
                disabled={fase.previa.bloqueo !== null}
                onChange={(e) => setRevisado(e.target.checked)}
              />
              Revisé los cambios, las cantidades y las fechas de vencimiento contra el PDF
            </label>
            <div className="flex gap-3">
              <Button variante="secundario" className="flex-1" onClick={() => setFase({ tipo: 'inicio' })}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={fase.previa.bloqueo !== null || !revisado} onClick={() => guardarLotes(fase.previa)}>
                Guardar lotes
              </Button>
            </div>
          </div>
        </>
      )}

      {fase.tipo === 'listo' && (
        <Card className="flex flex-col items-start gap-3">
          <p className="font-semibold text-ok">Listo: {fase.filas} {fase.unidad} guardados.</p>
          <div className="flex gap-3">
            <Link href="/hoy/" className="inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-semibold text-bg">
              Ir a Hoy
            </Link>
            <Button variante="secundario" onClick={() => setFase({ tipo: 'inicio' })}>
              Importar otro
            </Button>
          </div>
        </Card>
      )}
    </Pantalla>
  );
}
