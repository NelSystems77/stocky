import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import type { FechaISO } from '@/lib/domain/types';
import { normalizarFeriados } from '@/lib/domain/feriados';
import { MARGEN_RIESGO_INICIAL, normalizarMargen } from '@/lib/domain/riesgo';
import { normalizarUmbralesVencimiento, UMBRALES_VENCIMIENTO_INICIALES, validarUmbralesVencimiento, type UmbralesVencimiento } from '@/lib/domain/vencimientos';
import { AJUSTES_NOTIFICACIONES_INICIALES, type AjustesNotificaciones } from '@/lib/domain/notificaciones';
import { firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

export interface DatosUsuario {
  /** `false` si el documento de la cuenta aún no existe (lo crea el superadmin con la cuenta). */
  existe: boolean;
  notificaciones: AjustesNotificaciones;
  /** Feriados del usuario (`YYYY-MM-DD`, ordenados): no hay avisos ni recurrencias en esos días. */
  feriados: FechaISO[];
  /** Días hábiles de margen sobre el próximo ingreso para marcar «riesgo» (regla A4). */
  margenRiesgo: number;
  /** Días para la prioridad alta y media de las alertas de vencimiento (A2). */
  umbralesVencimiento: UmbralesVencimiento;
  tokens: string[];
  /** Módulos que el 771 habilitó al 772 (`modulosHabilitados`). */
  modulosHabilitados: string[];
  /** Secciones elegidas para el resumen mensual (`ajustes.resumenSecciones`); `undefined` = nunca eligió. */
  resumenSecciones: unknown;
}

const ref = (uid: string) => doc(firestore(), `usuarios/${uid}`);

export function suscribirUsuario(uid: string, alCambiar: (d: DatosUsuario) => void): Unsubscribe {
  return onSnapshot(
    ref(uid),
    (snap) => {
      const datos = snap.data() as { ajustes?: { notificaciones?: Partial<AjustesNotificaciones>; feriados?: unknown; resumenSecciones?: unknown; umbrales?: { margenRiesgo?: unknown; vencimiento?: unknown } }; tokensFCM?: unknown; modulosHabilitados?: unknown } | undefined;
      alCambiar({
        existe: snap.exists(),
        notificaciones: { ...AJUSTES_NOTIFICACIONES_INICIALES, ...datos?.ajustes?.notificaciones },
        feriados: normalizarFeriados(datos?.ajustes?.feriados),
        margenRiesgo: normalizarMargen(datos?.ajustes?.umbrales?.margenRiesgo),
        umbralesVencimiento: normalizarUmbralesVencimiento(datos?.ajustes?.umbrales?.vencimiento),
        tokens: Array.isArray(datos?.tokensFCM) ? datos.tokensFCM.filter((t): t is string => typeof t === 'string') : [],
        modulosHabilitados: Array.isArray(datos?.modulosHabilitados) ? datos.modulosHabilitados.filter((m): m is string => typeof m === 'string') : [],
        resumenSecciones: datos?.ajustes?.resumenSecciones,
      });
    },
    () => alCambiar({ existe: false, notificaciones: AJUSTES_NOTIFICACIONES_INICIALES, feriados: [], margenRiesgo: MARGEN_RIESGO_INICIAL, umbralesVencimiento: { ...UMBRALES_VENCIMIENTO_INICIALES }, tokens: [], modulosHabilitados: [], resumenSecciones: undefined }),
  );
}

/** Solo toca `ajustes.notificaciones.<clave>`: las reglas permiten escribir `ajustes` pero no el rol ni la unidad. */
export function guardarAjusteNotificacion(uid: string, clave: keyof AjustesNotificaciones, valor: boolean): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { [`ajustes.notificaciones.${clave}`]: valor }));
}

/** Reemplaza la lista de feriados (`ajustes.feriados`). Siempre se guarda normalizada. */
export function guardarFeriados(uid: string, feriados: readonly FechaISO[]): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { 'ajustes.feriados': normalizarFeriados([...feriados]) }));
}

/** Guarda el margen de riesgo (`ajustes.umbrales.margenRiesgo`), siempre normalizado. */
export function guardarMargenRiesgo(uid: string, dias: number): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { 'ajustes.umbrales.margenRiesgo': normalizarMargen(dias) }));
}

/** Guarda los umbrales de vencimiento (`ajustes.umbrales.vencimiento`). Solo se guardan si son válidos. */
export function guardarUmbralesVencimiento(uid: string, u: UmbralesVencimiento): Promise<void> {
  if (!validarUmbralesVencimiento(u.alta, u.media).ok) return Promise.reject(new Error('Umbrales de vencimiento inválidos.'));
  return registrarEscritura(updateDoc(ref(uid), { 'ajustes.umbrales.vencimiento': { alta: u.alta, media: u.media } }));
}

/** Recuerda las secciones elegidas para el resumen mensual (`ajustes.resumenSecciones`). */
export function guardarResumenSecciones(uid: string, secciones: readonly string[]): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { 'ajustes.resumenSecciones': [...secciones] }));
}

export function agregarToken(uid: string, token: string): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { tokensFCM: arrayUnion(token) }));
}

export function quitarToken(uid: string, token: string): Promise<void> {
  return registrarEscritura(updateDoc(ref(uid), { tokensFCM: arrayRemove(token) }));
}
