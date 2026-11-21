# CLAUDE.md — Stocky by NelSystems

Guía permanente para trabajar en este repositorio. Léela completa al inicio de cada sesión.
La especificación funcional vive en `docs/PRD.md`: es la fuente de verdad de **qué** construir; este archivo define **cómo**.

---

## 1. Qué es Stocky

PWA asistente de pendientes para el **Almacén Local de medicamentos 771** (usuario principal) y la **farmacia 772** (usuario secundario) del Área de Salud de Coronado (CCSS). Concentra: vencimientos, riesgo de agotamiento, bajos, agotados, agenda de pedidos, envíos a los EBAIS (C, Z, V, R), ubicaciones con QR, tareas diarias, preconteo, traslados (orden SAP 50000…), dañados, reportes PDF/Excel y el asistente **Chango IA**.

Reglas de negocio que nunca se rompen:

- **Solo datos de medicamentos y operativos. Nunca datos de pacientes.**
- Stocky **lee** reportes y **recuerda** trámites; no escribe en SIFA ni SAP y no calcula cantidades de pedido.
- Cada usuario ve **solo sus datos**; el catálogo de códigos es compartido.
- El 772 solo ve Tareas, Agotados, Vencimientos y Reportes, salvo módulos que el 771 le habilite.

---

## 2. Stack (estándar NelSystems)

| Capa | Tecnología |
| --- | --- |
| Framework | **Next.js (App Router) + React + TypeScript (strict)** |
| Build para hosting | `output: 'export'` (sitio estático, sin SSR) |
| Estilos | Tailwind CSS con tokens propios (sección 7) |
| PWA | `manifest.webmanifest` + service worker (Serwist) con precache del app shell |
| Offline | Firestore con persistencia local (IndexedDB, `persistentLocalCache` + multi-tab) |
| Auth | Firebase Auth, correo y contraseña; roles por custom claims |
| Datos | Cloud Firestore |
| Archivos | Firebase Storage (fotos de dañados) |
| Notificaciones | Firebase Cloud Messaging (web push) |
| Backend | Cloud Functions for Firebase (TypeScript, Node), región `us-central1` |
| IA | Gemini API (plan gratuito) **solo desde Cloud Functions** |
| PDF de entrada | `pdfjs-dist` en el navegador (los reportes no salen del dispositivo para leerse) |
| Reportes | `jspdf` + `jspdf-autotable` (PDF), `xlsx` / SheetJS (Excel) y `xlsx-js-style` (Excel con colores de relleno y negrita: fork de SheetJS con estilos, fijado en `1.2.0`, solo para **escribir** libros) |
| QR | `qrcode` (generar etiquetas), `@zxing/browser` (escanear con cámara), como en QR Inventarios |
| Formularios | `react-hook-form` + `zod` |
| Fechas | `date-fns` con locale `es`, zona **America/Costa_Rica** |
| Íconos | `lucide-react` |
| Pruebas | Vitest (lógica pura) |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions |

No agregues dependencias fuera de esta tabla sin justificarlo en el PR.

---

## 3. Repositorio y Firebase

- Repositorio: **https://github.com/NelSystems77/stocky** (`git clone https://github.com/NelSystems77/stocky.git`) · rama principal `main`
- Proyecto: **Stocky** · ID `stocky-bbda4` · número `316940592609`
- Hosting: `https://stocky-bbda4.web.app`
- La config web (pública por diseño) va en `.env.local` como `NEXT_PUBLIC_FIREBASE_*` y en los secretos de GitHub Actions; `lib/firebase.ts` la lee de ahí. Nunca la escribas a mano en componentes.
- **Secretos reales** (Gemini API key, cuenta de servicio) nunca en el repo: Gemini va como secreto de Functions (`defineSecret('GEMINI_API_KEY')`), la cuenta de servicio como secreto de GitHub (`FIREBASE_SERVICE_ACCOUNT_STOCKY_BBDA4`).
- Plan Blaze requerido para Functions programadas y llamadas salientes a Gemini.

### Roles

| Claim | Quién | Notas |
| --- | --- | --- |
| `role: "superadmin"` | `admin@nelsystems.com` | Se asigna una vez con `scripts/set-superadmin.ts` (Admin SDK) |
| `role: "usuario"`, `unidad: "771"` | Encargado del Almacén Local | Todos los módulos |
| `role: "usuario"`, `unidad: "772"` | Farmacia | Módulos limitados; `modulosHabilitados` en su doc |

Ningún cliente puede escribir claims ni su propio `role`. Crear, desactivar y restablecer cuentas = Cloud Function callable que verifica `superadmin`.

---

## 4. Estructura del repositorio

```
/
├─ CLAUDE.md
├─ docs/PRD.md                  # especificación funcional (no editar sin pedirlo)
├─ app/
│  ├─ (auth)/login/
│  ├─ (app)/hoy/                # pantalla de inicio
│  ├─ (app)/inventario/         # consolidado, vencimientos, riesgo, agotados, ubicaciones
│  ├─ (app)/agenda/             # tareas, pedidos, envíos, calendario
│  ├─ (app)/registros/          # preconteo, traslados, dañados
│  ├─ (app)/reportes/
│  ├─ (app)/importar/
│  ├─ (app)/ajustes/
│  └─ (admin)/admin/            # solo superadmin
├─ components/
│  ├─ ui/                       # botones, tarjetas, chips, hojas, toasts
│  ├─ layout/                   # splash, barra inferior, menú lateral, indicador de sync
│  └─ chango/                   # botón flotante y panel de Chango IA
├─ lib/
│  ├─ firebase.ts               # init única (app, auth, db, messaging, functions)
│  ├─ db/                       # acceso a colecciones tipado (un archivo por colección)
│  ├─ domain/                   # lógica pura: unidades, cobertura, reglas A1–A8, recurrencias, conteo físico
│  ├─ pdf/                      # parsers de reportes SIFA
│  ├─ reports/                  # generadores PDF/Excel
│  └─ qr/
├─ functions/src/               # Cloud Functions (programadas, callables, Chango IA)
├─ scripts/                     # set-superadmin.ts, seed del catálogo
├─ public/                      # íconos PWA, logo NelSystems, manifest
├─ firestore.rules
├─ firestore.indexes.json
├─ storage.rules
├─ firebase.json
└─ .github/workflows/
   ├─ deploy.yml                # push a main → Hosting live + rules + functions
   └─ preview.yml               # PR → canal de vista previa de Hosting
```

---

## 5. Convenciones de código

- **Idioma:** interfaz, mensajes, comentarios y nombres de dominio en **español** (`existencia`, `cuotaMinima`, `trasladoPendiente`). Términos técnicos genéricos pueden quedar en inglés (`useAuth`, `Button`).
- TypeScript estricto, sin `any`. Tipos de dominio en `lib/domain/types.ts`, validados con `zod` al leer de Firestore y al importar PDF.
- Componentes funcionales; lógica de negocio **fuera** de los componentes, en `lib/domain` (funciones puras y testeadas).
- Toda escritura a Firestore pasa por `lib/db/*`, nunca directo desde un componente.
- IDs generados en el cliente (`crypto.randomUUID()`) para que los registros creados offline no colisionen.
- Fechas guardadas como `Timestamp` de Firestore; se muestran con `date-fns` en `America/Costa_Rica`.
- Cantidades siempre en **unidades base** internamente; la UD solo se usa al importar y al mostrar.
- Nada de `alert()`/`confirm()`: usar toasts con **Deshacer** y hojas de confirmación propias.

### Reglas de dominio críticas (con pruebas obligatorias en Vitest)

- **Códigos:** `X-XX-XX-XXXX` o `XXX-XX-XXXX` (ej. `110-16-0010`). Normalizar antes de comparar.
- **UD:** `CN` = cientos (`1.5 CN = 150` unidades). FC, TR, tubo, ampolla, frasco: factor 1 salvo que la tabla editable de UD diga otra cosa.
- **Consumo diario** = consumo del período ÷ días hábiles; media móvil de las últimas 4 cargas.
- **Cobertura** = existencia en unidades ÷ consumo diario. Sin consumo → `null` (nunca dividir entre cero).
- **Próximo ingreso** = segundo sábado del mes (actual si no ha pasado, si no el siguiente).
- **Reglas A1–A8** exactamente como en `docs/PRD.md` §6. Umbrales leídos de los ajustes del usuario.
- **Calendario laboral:** lunes a viernes + segundo sábado del mes; feriados configurables. Ninguna recurrencia ni aviso fuera de ese calendario.
- **Conteo físico (§13):** la persona escribe **unidades sueltas** (ej. `20000`); el sistema guarda unidades base y muestra en la UD del producto (`200 CN`). Diferencia = contado − SIFA, con signo `-` cuando falta.

---

## 6. Offline y sincronización

- Toda pantalla debe abrir y permitir registrar **sin conexión**.
- Indicador global: "Sin conexión · N cambios por sincronizar" (usar `onSnapshotsInSync` y `metadata.hasPendingWrites`).
- No bloquear la UI esperando confirmación del servidor: escribir y seguir.
- La importación de PDF se procesa local; si no hay red, queda en cola y sube al reconectar.
- Chango IA y la gestión de cuentas son las únicas funciones que requieren red; mostrar estado claro cuando no haya.

---

## 7. Diseño

Modo **oscuro inmersivo por defecto**, claro opcional. El color se reserva para lo urgente.

| Token | Valor |
| --- | --- |
| `bg` | `#0B1220` |
| `surface` / `surface-2` | `#121A2B` / `#1A2438` |
| `accent` (marca, Chango IA) | `#2DD4BF` |
| `critical` | `#F87171` |
| `warning` (riesgo) | `#FBBF24` |
| `low` (bajo) | `#FDE68A` |
| `info` | `#60A5FA` |
| `ok` | `#34D399` |
| `text` / `text-muted` | `#E5E7EB` / `#94A3B8` |

- Tipografía: Inter para UI, **JetBrains Mono para códigos de producto**.
- Tarjetas `rounded-2xl` (16 px), objetivos táctiles ≥ 44 px, transiciones 150–250 ms.
- Celular: barra inferior (Hoy, Inventario, Agenda, Registros, Más). PC (≥ 1024 px): menú lateral.
- Botón flotante **Chango IA** abajo a la derecha en todas las pantallas autenticadas.
- Splash NelSystems (1–1,5 s) → login (solo si no hay sesión) → **Hoy**.
- Mobile first, probado desde 360 px de ancho.
- Accesibilidad: contraste AA, `aria-label` en botones de ícono, foco visible.
- **Filas con diferencia** (conteo físico): fondo **gris** (`surface-2` más claro en pantalla, gris claro en PDF/Excel) para distinguirlas a simple vista, sin gastar los colores reservados a lo urgente. El signo `-` y el valor en negrita refuerzan la señal (no depender solo del color).

---

## 8. Seguridad

- `firestore.rules`: `catalogo/*` lectura para autenticados, escritura solo vía importación validada; `usuarios/{uid}/**` solo el dueño (`request.auth.uid == uid`) o superadmin; el 772 no puede leer módulos no habilitados.
- Validar tipos y campos obligatorios en las reglas, no solo en el cliente.
- Restringir la API key web a los dominios de Hosting y `localhost`; activar App Check (reCAPTCHA Enterprise) antes de producción.
- Chango IA: la Function arma el contexto **solo** con datos del usuario autenticado y nunca envía datos de pacientes.

---

## 9. Chango IA (Cloud Function)

- Callable `changoPreguntar` → valida auth → arma contexto compacto (alertas, consolidado resumido, tareas, registros del período) → llama a Gemini.
- Cascada de modelos dentro de la cuota gratuita: Flash → Flash-Lite. Si ambos fallan por cuota, responder "Chango vuelve mañana" sin romper la app.
- Una sola API key. No rotar varias cuentas para evadir límites.
- Prompt de sistema: responder solo con datos de Stocky, citar la fecha del dato, decir "no tengo ese dato" cuando falte, sugerir sin decidir, español de Costa Rica.
- En esta versión **no ejecuta acciones** (solo consulta, analiza y sugiere).

---

## 10. Comandos

```bash
npm run dev          # desarrollo local
npm run build        # build estático en /out
npm run lint
npm run test         # Vitest
npm run emulators    # emuladores de Firebase (auth, firestore, functions, storage)
```

El despliegue **no** se hace desde la sesión de Claude: lo hace GitHub Actions al fusionar en `main`.

---

## 11. Forma de trabajo con Claude

0. **Al empezar, lee `docs/estado.md`** (qué está hecho, PR abiertos y pendientes); al cerrar la sesión, actualízalo.
1. **Una fase del PRD por sesión** (`docs/PRD.md` §11). No adelantes módulos de fases futuras.
2. Antes de escribir código, resume en 5–10 líneas qué vas a construir y qué archivos tocarás.
3. Lógica de dominio primero, con pruebas; luego UI.
4. Antes de dar algo por terminado: `npm run lint`, `npm run test` y `npm run build` sin errores.
5. Commits pequeños en español con prefijo: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
6. Trabajar en una rama por fase (`fase-1-base`, …) y abrir PR; la vista previa de Hosting sale sola.
7. Si el PRD es ambiguo o contradictorio, **pregunta** antes de suponer; anota la decisión en `docs/decisiones.md`.
8. No modificar `docs/PRD.md` ni este archivo salvo que se pida.

---

## 12. Datos pendientes (no inventar)

- ~~Día de envío a V~~ → resuelto el 2026-11-20 (R lunes y último jueves, C martes, V y Z miércoles; configurables). Ver `docs/decisiones.md`.
- Cantidad y nombres de estantes, tarimas y filas del 771 → el mapa se construye desde ajustes, sin valores fijos.
- Lista completa de UD y factores → tabla editable con `CN = 100` precargado.
- PDF reales de existencias, lotes/vencimientos y consumos → el parser se diseña por columnas detectadas en el encabezado (`CODIGO`, `UD`, `DESCRIPCION DEL PRODUCTO`, `CUOTA`, `Cuota Mínima`, `EXISTENCIA`, …) y se ajusta con muestras reales.

---

## 13. Conteo físico con diferencias contra SIFA (idea acordada, aún no construida)

Función nueva **no incluida en `docs/PRD.md`**. Vive en Inventario (conteo) y en Reportes (PDF/Excel). Se construye después del consolidado de Inventario; no adelantarla a otras fases sin pedirlo.

**Qué es:** la persona cuenta físicamente los productos, escribe lo contado y Stocky lo compara con la existencia que dice SIFA (importada por PDF), señalando las diferencias.

**Cómo se espera que funcione**

1. **Alcance:** contar todos los productos o un subconjunto (p. ej. por ubicación cuando exista ese módulo).
2. **Foto de SIFA:** al iniciar el conteo se congela la existencia de SIFA y la fecha de su reporte. Importar otro reporte después **no** cambia las diferencias de un conteo ya iniciado.
3. **Captura en unidades sueltas.** La persona escribe, por ejemplo, `20000`. El sistema lo convierte con el factor de la UD y lo muestra en la UD del producto: `20000` unidades de un producto `CN` (factor 100) = `200 CN`. Internamente todo sigue en unidades base. Productos con factor 1 (FC, TR, tubo, ampolla, frasco…) se muestran igual que se escribieron. Debe aceptar decimales (`20050` → `200.5 CN`).
4. **Diferencia = contado − SIFA**, expresada en la UD del producto y calculada en unidades base:
   - Falta producto → signo **`-`** (ej. `-50 CN`).
   - Sobra producto → signo `+` (ej. `+12 CN`).
   - Coincide → `0` sin marca.
   - Producto sin contar → no tiene diferencia (queda “sin contar”, no cuenta como 0).
5. **Resaltado:** las filas con diferencia ≠ 0 se pintan en **gris** (pantalla, PDF y Excel) y el valor de la diferencia va en negrita. Hay un filtro “solo con diferencias”.
6. **Offline:** capturar y guardar el conteo sin conexión; se sincroniza al volver la red.
7. **Exportación PDF** (`jspdf` + `jspdf-autotable`) y **Excel** (`xlsx`). Columnas: Código, Descripción, UD, SIFA, Contado, Diferencia, Observación. Encabezado con logo Stocky by NelSystems, nombre del usuario, unidad (771/772), fecha del conteo y fecha del reporte de SIFA usado. Resumen al pie: productos contados, con diferencia, faltantes y sobrantes.
8. **Pruebas obligatorias (Vitest):** conversión sueltas → UD (`20000 → 200 CN`, decimales, factor 1), signo de la diferencia, producto sin contar, y que el conteo conserve su foto de SIFA.

**Pendiente de confirmar (no inventar):** si se cuenta también **por lote** (requiere el reporte de lotes y vencimientos, aún sin muestra) y qué hacer con productos contados que no estén en el reporte de SIFA.
