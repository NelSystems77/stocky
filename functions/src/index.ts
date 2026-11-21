import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { z } from 'zod';
import { PeticionChango, preguntarAChango } from './chango.js';
import { ejecutarTick, type Enviar } from './tick.js';

setGlobalOptions({ region: 'us-central1', maxInstances: 5 });
initializeApp();

const Unidad = z.enum(['771', '772']);

const Peticion = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('crear'),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(128),
    nombre: z.string().trim().min(1).max(100),
    unidad: Unidad,
  }),
  z.object({ accion: z.literal('activar'), uid: z.string().min(1), activo: z.boolean() }),
  z.object({ accion: z.literal('restablecer'), uid: z.string().min(1) }),
  z.object({ accion: z.literal('nuevaClave'), uid: z.string().min(1), password: z.string().min(8).max(128) }),
]);

/**
 * Gestión de cuentas (crear, activar/desactivar, restablecer contraseña).
 * Solo el superadmin; ningún cliente puede escribir claims ni su propio rol.
 */
export const gestionarCuentas = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  if (req.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Solo el superadmin puede gestionar cuentas.');
  }

  const parsed = Peticion.safeParse(req.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Datos inválidos.');
  const datos = parsed.data;

  const auth = getAuth();
  const db = getFirestore();

  // Las acciones sobre una cuenta existente solo valen para cuentas de usuario (771/772):
  // el superadmin no puede desactivarse a sí mismo ni tocar a otro superadmin.
  if (datos.accion !== 'crear') {
    if (datos.uid === req.auth.uid) throw new HttpsError('failed-precondition', 'No puedes aplicar esto a tu propia cuenta.');
    const objetivo = await auth.getUser(datos.uid).catch(() => {
      throw new HttpsError('not-found', 'No existe esa cuenta.');
    });
    if (objetivo.customClaims?.['role'] !== 'usuario') {
      throw new HttpsError('failed-precondition', 'Solo se gestionan cuentas de usuario (771 y 772).');
    }
  }

  switch (datos.accion) {
    case 'crear': {
      const usuario = await auth
        .createUser({ email: datos.email, password: datos.password, displayName: datos.nombre })
        .catch((e: { code?: string }) => {
          if (e.code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'Ya existe una cuenta con ese correo.');
          }
          throw new HttpsError('internal', 'No se pudo crear la cuenta.');
        });
      await auth.setCustomUserClaims(usuario.uid, { role: 'usuario', unidad: datos.unidad });
      await db.doc(`usuarios/${usuario.uid}`).set({
        nombre: datos.nombre,
        email: datos.email,
        unidad: datos.unidad,
        activo: true,
        modulosHabilitados: [],
        ajustes: {},
        creadoEn: FieldValue.serverTimestamp(),
      });
      return { uid: usuario.uid };
    }
    case 'activar': {
      await auth.updateUser(datos.uid, { disabled: !datos.activo });
      if (!datos.activo) await auth.revokeRefreshTokens(datos.uid);
      await db.doc(`usuarios/${datos.uid}`).update({ activo: datos.activo });
      return { ok: true };
    }
    case 'nuevaClave': {
      await auth.updateUser(datos.uid, { password: datos.password });
      await auth.revokeRefreshTokens(datos.uid); // cierra las sesiones abiertas con la contraseña anterior
      return { ok: true };
    }
    case 'restablecer': {
      const usuario = await auth.getUser(datos.uid);
      if (!usuario.email) throw new HttpsError('failed-precondition', 'La cuenta no tiene correo.');
      const enlace = await auth.generatePasswordResetLink(usuario.email);
      return { enlace };
    }
  }
});

/** Módulos que el 771 (o el superadmin) puede habilitarle a la farmacia 772. Deben coincidir con `firestore.rules`. */
const MODULOS_HABILITABLES = ['pedidos', 'envios', 'ubicaciones', 'preconteo', 'traslados', 'danados', 'chango'] as const;

const PeticionModulos = z.object({
  uid: z.string().min(1),
  modulos: z.array(z.enum(MODULOS_HABILITABLES)).max(MODULOS_HABILITABLES.length),
});

/**
 * Habilita módulos a una cuenta 772. Lo pueden hacer el superadmin y el usuario 771
 * (los clientes no pueden escribir `modulosHabilitados`: solo esta Function).
 */
export const habilitarModulos = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const rol = req.auth.token['role'];
  const esSuper = rol === 'superadmin';
  const es771 = rol === 'usuario' && req.auth.token['unidad'] === '771';
  if (!esSuper && !es771) throw new HttpsError('permission-denied', 'No tienes permiso para habilitar módulos.');

  const parsed = PeticionModulos.safeParse(req.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Datos inválidos.');

  const objetivo = await getAuth().getUser(parsed.data.uid).catch(() => {
    throw new HttpsError('not-found', 'No existe esa cuenta.');
  });
  if (objetivo.customClaims?.['role'] !== 'usuario' || objetivo.customClaims['unidad'] !== '772') {
    throw new HttpsError('failed-precondition', 'Solo se habilitan módulos a cuentas de la farmacia 772.');
  }
  const modulos = [...new Set(parsed.data.modulos)];
  await getFirestore().doc(`usuarios/${objetivo.uid}`).update({ modulosHabilitados: modulos });
  return { modulos };
});

const URL_APP = 'https://stocky-bbda4.web.app';
const TOKENS_INVALIDOS = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

const enviarPorFCM: Enviar = async ({ tokens, titulo, cuerpo }) => {
  const r = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: titulo, body: cuerpo },
    webpush: { fcmOptions: { link: `${URL_APP}/hoy/` } },
  });
  return r.responses.flatMap((x, i) => (!x.success && TOKENS_INVALIDOS.includes(x.error?.code ?? '') ? [tokens[i] ?? ''] : []));
};

/**
 * Cada 5 minutos, de lunes a sábado entre las 6:00 y las 19:55 (hora de Costa Rica), manda los avisos de la franja:
 * resumen de las 7:00, resumen de las 12:00 y recordatorios a la hora de cada tarea.
 * Domingos, sábados que no son el segundo y feriados los descarta la lógica de dominio.
 */
export const tickNotificaciones = onSchedule(
  { schedule: '*/5 6-19 * * 1-6', timeZone: 'America/Costa_Rica', maxInstances: 1, timeoutSeconds: 120 },
  async () => {
    await ejecutarTick(getFirestore(), enviarPorFCM);
  },
);

/** Clave de Gemini: secreto de Functions (`firebase functions:secrets:set GEMINI_API_KEY`), nunca en el repositorio ni en el navegador. */
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

/**
 * Chango IA: consulta, analiza y sugiere con los datos de quien pregunta. No ejecuta acciones.
 * El 771 y el superadmin siempre pueden; el 772 solo si el 771 le habilitó el módulo `chango`.
 */
export const changoPreguntar = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 90, maxInstances: 5 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const rol = req.auth.token['role'];
  const unidad = String(req.auth.token['unidad'] ?? '');
  if (rol !== 'usuario' && rol !== 'superadmin') throw new HttpsError('permission-denied', 'No tienes permiso para usar Chango IA.');

  const parsed = PeticionChango.safeParse(req.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Escribe una pregunta (máximo 500 caracteres).');

  const db = getFirestore();
  const doc = await db.doc(`usuarios/${req.auth.uid}`).get();
  const habilitados = doc.get('modulosHabilitados');
  const modulos = new Set<string>(Array.isArray(habilitados) ? habilitados.filter((m): m is string => typeof m === 'string') : []);
  if (rol === 'usuario' && unidad === '772' && !modulos.has('chango')) {
    throw new HttpsError('permission-denied', 'El 771 aún no te habilitó Chango IA.');
  }

  return preguntarAChango(
    { db, clave: GEMINI_API_KEY.value(), fetcher: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(25_000) }) },
    { uid: req.auth.uid, unidad: rol === 'superadmin' ? '771' : unidad, modulos },
    parsed.data,
  );
});
