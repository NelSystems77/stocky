/**
 * Asigna el claim `role: "superadmin"` a una cuenta existente (una sola vez).
 *
 * Uso (con credenciales de cuenta de servicio del proyecto en GOOGLE_APPLICATION_CREDENTIALS):
 *   node scripts/set-superadmin.ts [correo]        # por defecto admin@nelsystems.com
 *
 * La cuenta debe existir ya en Firebase Auth. La persona debe cerrar sesión y volver a entrar
 * para que el nuevo claim llegue a su token.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROYECTO = 'stocky-bbda4';
const correo = process.argv[2] ?? 'admin@nelsystems.com';

initializeApp({ credential: applicationDefault(), projectId: PROYECTO });

const usuario = await getAuth().getUserByEmail(correo);
await getAuth().setCustomUserClaims(usuario.uid, { role: 'superadmin' });
console.log(`Listo: ${correo} (${usuario.uid}) ahora es superadmin en ${PROYECTO}.`);
