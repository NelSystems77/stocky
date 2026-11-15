import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { z } from 'zod';

setGlobalOptions({ region: 'us-central1', maxInstances: 5 });
initializeApp();

const Unidad = z.enum(['771', '772']);

const Peticion = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('crear'),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    nombre: z.string().trim().min(1).max(100),
    unidad: Unidad,
  }),
  z.object({ accion: z.literal('activar'), uid: z.string().min(1), activo: z.boolean() }),
  z.object({ accion: z.literal('restablecer'), uid: z.string().min(1) }),
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
    case 'restablecer': {
      const usuario = await auth.getUser(datos.uid);
      if (!usuario.email) throw new HttpsError('failed-precondition', 'La cuenta no tiene correo.');
      const enlace = await auth.generatePasswordResetLink(usuario.email);
      return { enlace };
    }
  }
});
