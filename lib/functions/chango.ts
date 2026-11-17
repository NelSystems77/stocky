import { httpsCallable } from 'firebase/functions';
import type { TurnoChango } from '@/lib/domain/chango';
import { firebaseFunctions } from '@/lib/firebase';

export type RespuestaChango =
  | { estado: 'ok'; respuesta: string; modelo: string; fechaDatos: string | null }
  | { estado: 'sin-cuota' | 'limite' | 'error'; respuesta: string };

/** Pregunta a Chango IA. Requiere conexión: la consulta pasa por una Cloud Function y por Gemini. */
export async function preguntarAChango(pregunta: string, historial: readonly TurnoChango[]): Promise<RespuestaChango> {
  const r = await httpsCallable<{ pregunta: string; historial: readonly TurnoChango[] }, RespuestaChango>(firebaseFunctions(), 'changoPreguntar', { timeout: 90_000 })({
    pregunta,
    historial,
  });
  return r.data;
}

/** Mensaje para la persona cuando la llamada misma falla (no cuando Chango responde «sin cuota»). */
export function mensajeErrorChango(e: unknown): string {
  const codigo = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (codigo) {
    case 'functions/permission-denied':
      // El SDK a veces agrega el código HTTP al final (« [403]»): no es para la persona.
      return e instanceof Error && e.message ? e.message.replace(/\s*\[\d{3}\]$/, '') : 'No tienes permiso para usar Chango IA.';
    case 'functions/unauthenticated':
      return 'Tu sesión venció. Inicia sesión de nuevo.';
    case 'functions/invalid-argument':
      return 'Escribe una pregunta más corta (máximo 500 caracteres).';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'No hay conexión con Chango. Inténtalo cuando tengas internet.';
    default:
      return 'Chango no pudo responder ahora. Inténtalo de nuevo en unos minutos.';
  }
}
