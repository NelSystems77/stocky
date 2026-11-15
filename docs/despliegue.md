# Despliegue de Stocky

El despliegue **no** se hace desde la sesión de Claude ni a mano: lo hace GitHub Actions.

| Cuándo | Workflow | Qué hace |
| --- | --- | --- |
| Pull request hacia `main` | `.github/workflows/preview.yml` | Lint, tipos, pruebas y build. Publica un canal de **vista previa** de Hosting (vence a los 7 días) y deja el enlace en el PR. Solo Hosting: no toca reglas, Functions ni datos. |
| Push a `main` (al fusionar) | `.github/workflows/deploy.yml` | Lint, tipos, pruebas y build; luego publica **Hosting + reglas de Firestore y Storage + Functions**. |

Si cualquier verificación falla, **no se despliega**.

## Secretos de GitHub (Settings → Secrets and variables → Actions)

| Secreto | De dónde sale |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_STOCKY_BBDA4` | Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. Se pega **el JSON completo**. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Config web de la app (`apiKey`). |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Config web de la app (`appId`). |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Config web de la app (`measurementId`). Opcional. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Console → Configuración del proyecto → Cloud Messaging → Certificados web push → Generar par de claves (clave **pública**). Sin ella no se pueden activar las notificaciones. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Clave de sitio (pública) de reCAPTCHA Enterprise registrada en App Check. Sin ella la app funciona, pero no envía tokens de App Check. |

La config web es pública por diseño; igual va como secreto para no repetirla en el repo. Los valores fijos (`authDomain`, `projectId`, `storageBucket`, `messagingSenderId`) están en los workflows.
Cuando llegue Chango IA se agrega `GEMINI_API_KEY` como secreto **de Functions** (`firebase functions:secrets:set`), no de GitHub.

## Permisos de la cuenta de servicio

Para desplegar Functions programadas necesita, además de Hosting y reglas:
`Firebase Admin`, `Cloud Functions Admin`, `Service Account User`, `Cloud Scheduler Admin` y `Artifact Registry Writer`.
Si el primer despliegue falla por un permiso o una API sin habilitar (Cloud Scheduler, Cloud Build, Artifact Registry, Eventarc), el mensaje del log dice cuál; se habilita y se vuelve a correr el workflow.
El plan **Blaze** ya está activo (requerido por las Functions programadas).

## Orden de la primera puesta en marcha

1. Crear los secretos de arriba.
2. Fusionar a `main` → corre `deploy.yml`.
3. Asignar el rol al admin (una sola vez, desde una computadora con la clave de la cuenta de servicio):
   `GOOGLE_APPLICATION_CREDENTIALS=/ruta/clave.json node scripts/set-superadmin.ts admin@nelsystems.com`
   y cerrar sesión / volver a entrar en la app. Después, borrar la clave local.
4. Entrar a `https://stocky-bbda4.web.app` con el admin → crear las cuentas 771 y 772 desde **Administración**.
5. Cada persona activa las notificaciones en **Ajustes** (en iPhone, con la app instalada en la pantalla de inicio).

## Pendiente antes de usarlo en producción real

- **Restringir la API key web** (Google Cloud Console → Credenciales) a `stocky-bbda4.web.app`, `stocky-bbda4.firebaseapp.com`, `localhost` y, si se quiere probar vistas previas, `stocky-bbda4--*.web.app`.
- **App Check, fase 2 (exigirlo).** La fase 1 ya envía tokens desde el cliente (reCAPTCHA Enterprise, sin exigirlos). Cuando Firebase Console → App Check → Métricas muestre que casi todas las peticiones a Firestore, Storage y Functions traen token válido: poner `enforceAppCheck: true` en las callables y activar la exigencia en Firestore y Storage desde la consola. Exigirlo antes cortaría a quien tenga una versión vieja de la app guardada.
- **Política TTL** para `usuarios/{uid}/avisosEnviados`: la Function guarda `expiraEn` (envío + 14 días) y la política se activa **una vez** sobre ese campo, después del primer despliegue con este cambio:
  `gcloud firestore fields ttls update expiraEn --collection-group=avisosEnviados --enable-ttl --project stocky-bbda4`
  (No usar `enviadoEn`: es una fecha pasada y el TTL borraría el aviso al instante, reenviándolo.)
- **Dominio autorizado**: si se usan vistas previas con inicio de sesión, revisar que Authentication acepte sus dominios.

## Probar localmente (sin tocar producción)

`npm run emulators` levanta Auth, Firestore, Functions y Storage. Con `NEXT_PUBLIC_USE_EMULATORS=true` la app apunta a ellos. Para las Functions, antes: `npm --prefix functions run build`.
