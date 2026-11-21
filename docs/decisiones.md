# Decisiones de diseño

Decisiones tomadas donde el PRD era ambiguo. Revisar y corregir si no coinciden con la operación real.

## 2026-11-15 · Fase 1

- **Cobertura y próximo ingreso en días hábiles.** El consumo diario se calcula sobre días hábiles (PRD §6), así que la cobertura queda en días hábiles. Para compararla con el próximo ingreso se usan los días hábiles desde mañana hasta el segundo sábado (`diasHabilesAlIngreso`), no los días calendario.
- **Fechas como `YYYY-MM-DD`.** La lógica de dominio usa fechas civiles de Costa Rica (UTC−6, sin horario de verano) para evitar errores de zona. Se convierten a `Timestamp` solo al guardar en Firestore.
- **Recurrencias fuera de calendario.** Semanales, quincenales y por día de semana que caen en feriado se omiten; las mensuales se corren al siguiente día laboral del mes. Las tareas únicas respetan la fecha elegida.
- **Códigos sin guiones.** Un código de 9 dígitos sin guiones es ambiguo (`X-XX-XX-XXXX` y `XXX-XX-XXXX` tienen 9 dígitos), así que no se reconstruye; se rechaza.
- **Zona horaria sin `date-fns-tz`.** No está en la tabla del stack; se usa `Intl.DateTimeFormat` con `America/Costa_Rica`.

## 2026-11-15 · Parser de reportes SIFA (muestras reales)

- **Un mismo código se imprime de dos formas.** `110-16-0010` (existencias del 771) y `1-10-16-0010` (reportes de despacho). La forma canónica es `XXX-XX-XXXX`: se quita el primer guion.
- **Dos tipos de reporte reconocidos:** `Rpt_ExistenciasDespacho` (columnas `CUOTA · Cuota Mínima · EXISTENCIA`) y `RptSIFA032 «Reporte de Productos en Despacho»` (columnas `EXISTENCIA · CUOTA · CONSUMO`). El orden de columnas se lee del encabezado, no se supone.
- **Cantidades en la UD del reporte.** Tanto existencia como cuota y cuota mínima vienen en esa UD (`CN` = cientos); la conversión a unidades base se hace al consolidar.
- **Miles con coma** (`5,220.000`): se eliminan antes de convertir.
- **Descripciones truncadas por SIFA (~35 caracteres).** Algunas celdas traen una 2.ª línea oculta dibujada encima de la 1.ª; se descarta y se conserva el texto visible.
- **Cuadre contra el total del reporte.** El de existencias imprime un entero suelto al final y el de despacho `TOTAL PRODUCTOS: N`. Si no coincide con las filas leídas, se muestra una advertencia.
- **UD observadas en las muestras:** A, AM, CJ, CN, DO, EV, FA, FC, G, KG, LA, LT, RO, SB, SO, TA, TB, TR, TU, UD. Solo `CN` tiene factor ≠ 1 confirmado; el resto queda en 1 hasta que se confirme en la tabla editable.
- **Datos de personas.** Los reportes de EBAIS traen al pie el nombre de quien firma como jefatura/encargado: no se lee ni se guarda.
- **Muestras reales fuera del repo.** `lib/pdf/reales.test.ts` corre contra ellas solo con `STOCKY_PDF_DIR=/ruta npm run test`.

## 2026-11-15 · Importación de reportes (paso 5b)

- **Un reporte solo se guarda en el despacho al que pertenece.** Un usuario 771 no puede guardar el reporte de un EBAIS (despacho 13, 11…); se muestra el motivo y el botón Guardar queda deshabilitado. El superadmin queda exento (no tiene datos propios de inventario).
- **Primera carga siembra el catálogo.** Con el catálogo vacío, todos los códigos se crean con `nuevo: false`. Desde la segunda carga, los códigos que no estén se crean con `nuevo: true`.
- **Catálogo en lotes aparte.** Si otra persona crea el mismo código a la vez, solo falla ese paso (la regla permite crear, nunca editar) y las existencias del usuario ya quedaron guardadas.
- **Existencias con `merge`.** Cada importación actualiza solo los campos que el reporte trae (el de existencias trae cuota mínima; el de productos en despacho trae consumo). Los productos que no aparecen en un reporte no se borran.
- **Consumos pendientes de definir.** `RptSIFA032` trae «consumo» sin período explícito. Por ahora se guarda crudo por importación (`consumos/{importación}_{código}`) y **no** se calcula consumo diario ni cobertura hasta confirmar qué período cubre (¿mes en curso, desde la última carga?).
- **No se espera al servidor.** Guardar escribe en local y sigue; el indicador global cuenta los cambios por sincronizar. Si el servidor rechaza algo, aparece un aviso.
- **Lectura del catálogo con límite de 6 s.** Si el servidor no responde, se usa la copia local; si tampoco hay, se guarda igual y se avisa que el catálogo se actualiza en la próxima importación.
- **Probado con emuladores.** Login real, PDF real de 24 páginas (lectura ≈ 0,9 s), 1039 existencias y 1039 códigos escritos bajo las reglas de seguridad. En el emulador la sincronización completa tarda ~14 s; en producción debería ser menor.

## 2026-11-15 · Inventario consolidado (paso 5c)

- **Estado en la lista = solo A5 y A6.** «Agotado» (cuota > 0 y existencia 0) y «Bajo» (existencia < cuota mínima). Los demás estados (A1–A4: vencimiento por rotación, riesgo) dependen de consumo y lotes y llegan en la Fase 2.
- **Productos sin cuota no se alertan.** Cuota y cuota mínima en 0 = sin política de stock; no aparecen como agotados aunque la existencia sea 0.
- **Cantidades mostradas en la UD del producto** (`474 CN`) y, si la UD no vale 1, también en unidades sueltas (`47 400 u`). Internamente siempre unidades base.
- **Búsqueda sin tildes ni guiones**, por código o por nombre; todas las palabras deben coincidir. Los códigos que vienen con descripción partida solo se encuentran por el texto visible.
- **Verificado contra el PDF real (1039 productos):** 215 agotados y 154 bajos.

## 2026-11-15 · Tareas y agenda (paso 6a)

- **Cambio respecto al modelo de datos del PRD §9.** El PRD pone `estado` y `fechaObjetivo` en cada tarea. Aquí cada tarea es una **plantilla** (`tareas/{id}`: título, recurrencia, hora, prioridad, notas, activa, desde) y lo que pasó con cada ocurrencia se guarda en `cumplimientos/{tareaId}_{fecha}` (`hecha` · `pospuesta` con `fechaProgramada` · `descartada` con `motivo`). Motivo: funciona sin conexión, las ocurrencias no se duplican y no hace falta una Function que las genere.
- **Las ocurrencias se calculan, no se almacenan.** `lib/domain/tareas.ts` las deriva de la plantilla y el calendario laboral. Una recurrente no genera pendientes anteriores a su creación (`desde`).
- **Pendientes de días anteriores:** ventana de 30 días. Lo no hecho más viejo que eso deja de mostrarse (no se borra).
- **Posponer** manda a la nueva fecha; la ocurrencia original ya no aparece en su día. «Próximo día laboral» salta fines de semana, sábados que no son el 2.º y feriados.
- **Tareas sugeridas (RF-7.2), solo 771:** Temperatura AM, Temperatura PM, Cargar reportes (jueves 07:00), Preconteo (L-Mi-J-V) y Revisar traslados pendientes (diaria; nota de los martes). El PRD no da horas para temperatura ni preconteo: quedan **sin hora**, editables. Para el 772 no se precarga nada. Se siembran a pedido, con IDs fijos (no se duplican).
- **Feriados:** `FERIADOS` está vacío hasta que exista Ajustes. Ya lo respetan recurrencias y «próximo día laboral».
- **Calendario:** día, semana (empieza en lunes) y mes. Marca el segundo sábado como «Ingreso de mercadería». En esta versión es de solo lectura: las tareas se cierran desde Hoy. Pedidos y envíos se suman en la Fase 2.
- **Gestos en celular:** deslizar a la derecha completa, a la izquierda pospone (umbral 90 px). Probado con eventos táctiles reales.
- **Pendiente:** notificaciones push (7:00 / 12:00 y por hora de tarea), que requieren Functions programadas, plan Blaze y el service worker del PWA.

## 2026-11-15 · PWA y notificaciones (paso 6b)

- **Build con webpack.** `npm run build` ahora corre `next build --webpack`: el plugin de Serwist (`@serwist/next`) no funciona con Turbopack, que es el predeterminado de Next 16. El service worker (`app/sw.ts`) se compila a `public/sw.js` (ignorado por git y por ESLint) y se revisa de tipos aparte con `npm run typecheck:sw`.
- **App shell en precache:** JS, CSS, íconos y las 10 pantallas (`/`, `/login/`, `/hoy/`, …) para abrir sin conexión desde la primera visita.
- **Íconos provisionales.** No hay logo de NelSystems en el repo: los íconos (`public/icons/`) son una «S» turquesa sobre el fondo de la marca. Reemplazar cuando haya el logo oficial.
- **Avisos push sin SDK en el worker.** El servidor manda un mensaje FCM con `notification`; el service worker lo muestra con `showNotification` y al tocarlo abre `/hoy/`. La clave VAPID pública va en `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- **Una sola Function programada** (`tickNotificaciones`): cada 5 minutos, lunes a sábado de 6:00 a 19:55, hora de Costa Rica. Decide por franja de 5 min: resumen 7:00, resumen 12:00 y recordatorio a la hora de cada tarea. Domingos, sábados que no son el segundo y feriados los descarta `lib/domain/notificaciones.ts`.
- **Sin avisos repetidos.** Cada aviso reserva un documento `usuarios/{uid}/avisosEnviados/{clave}` con `create()` (atómico): si la función corre dos veces en la misma franja, la segunda no envía. Estos documentos crecen unos pocos por día; cada uno guarda `expiraEn` (envío + 14 días) y una política TTL de Firestore sobre ese campo los borra. El TTL no va sobre `enviadoEn`: sería una fecha pasada y se borraría el aviso al instante.
- **Código compartido, no duplicado.** `scripts/copiar-dominio.mjs` copia `lib/domain/{types,calendario,recurrencia,tareas,notificaciones}.ts` a `functions/src/dominio/` en el `prebuild` (carpeta ignorada por git). El cliente y el servidor deciden con el mismo código.
- **Tokens inválidos se borran** de la cuenta cuando FCM los rechaza.
- **Cada tipo se puede silenciar** en Ajustes (`ajustes.notificaciones.*`). Falta el aviso «2 días antes de cada envío» y «según anticipación de cada pedido»: llegan con envíos y pedidos (Fase 2).
- **Requisito de cuenta:** guardar el token y los ajustes necesita que exista `usuarios/{uid}` (lo crea la Function de cuentas). Una cuenta sin ese documento ve el aviso y el botón queda bloqueado.
- **iPhone:** las notificaciones solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4+).
- **Indicador de sincronización.** Antes perdía el conteo al recargar sin conexión. Ahora detecta cambios en cola de una sesión anterior con `waitForPendingWrites` y muestra «cambios por sincronizar» (sin número, que ya no se conoce).
- **Verificado en emulador:** apertura de la app y de pantallas sin conexión; cambio hecho sin conexión llega al servidor ~0,4 s tras reconectar; la Function (franjas, dedupe, tokens inválidos, domingos y feriados). **No verificado:** entrega real de push (necesita VAPID y un navegador real).
- **Intermitencia sin explicar.** En pruebas automatizadas de navegación completa sin conexión hacia `/agenda/` justo después de un cambio offline, ~5 de 17 corridas no mostraron el calendario (en una la página terminó en `/hoy/`). Las últimas 6 corridas seguidas pasaron. Abrir la app sin conexión (recarga de `/hoy/`) pasó siempre. Hipótesis: relevo del «líder» multi-pestaña de Firestore tras una recarga completa sin red. Pendiente de investigar con un dispositivo real.

## 2026-11-15 · Administración de cuentas (paso 7)

- **Pantalla `/admin/` solo para el superadmin.** El layout redirige a quien no lo sea (a `/hoy/` o a `/login/`); la protección real está en el servidor: las reglas solo dejan al superadmin listar `usuarios` y las Functions verifican el claim. El superadmin entra directo a `/admin/` al iniciar sesión y tiene un enlace en «Más».
- **Contraseñas las genera Stocky, no se envían por correo.** Al crear una cuenta o cambiar la contraseña se genera una de 12 caracteres (mayúscula, minúscula y dígito, sin caracteres ambiguos como `0/O/1/l/I`) con `crypto.getRandomValues`. Se muestra **una sola vez** para copiarla; no se guarda en ningún lado. Se eligió esto porque no se sabe si las cuentas 771/772 tienen un correo real al que llegue un enlace. La acción `restablecer` (enlace por correo) sigue existiendo en la Function pero no se usa en la pantalla.
- **Nueva contraseña cierra las sesiones abiertas** del usuario (`revokeRefreshTokens`).
- **Guardas en el servidor:** el superadmin no puede desactivarse a sí mismo ni tocar a otro superadmin; las acciones solo aplican a cuentas `usuario` (771/772). Correo en minúsculas. Desactivar también revoca sesiones.
- **`habilitarModulos` (nueva callable):** solo para cuentas 772. La pueden usar el superadmin y el usuario 771 (el PRD dice que el 771 habilita funciones al 772). Los módulos permitidos están fijos en la Function y en `firestore.rules` (`pedidos`, `envios`, `ubicaciones`, `preconteo`, `traslados`, `danados`, `chango`). Un 772 no puede habilitarse módulos a sí mismo. **Pendiente:** pantalla para que el 771 lo haga él mismo (hoy solo el panel del superadmin la usa), y que la navegación del 772 muestre los módulos habilitados (hoy no ve «Registros» aunque tenga alguno).
- **Corrección de un error mío:** en `firestore.rules` el módulo de preconteo estaba escrito `precontEo` / colección `precontEos`. Ahora es `preconteo` / `preconteos` (como el PRD).
- **La gestión de cuentas requiere conexión** (así lo dice `CLAUDE.md` §6): sin red los botones se deshabilitan con un aviso claro.
- **Probado en emulador de punta a punta** (Auth + Firestore + Functions): crear cuenta por la interfaz, módulos, contraseña nueva (la anterior deja de servir), desactivar/reactivar (mensaje claro al intentar entrar) y 12 protecciones del servidor llamando directo a las Functions.

## 2026-11-15 · Fase 2: agotados y bajos (primer bloque)

- **Orden de la Fase 2.** Se empieza por agotados y bajos (usan solo la existencia ya importada). Después, pedidos y envíos. Riesgo (A3/A4) y vencimientos (A1/A2) quedan para cuando haya consumo confirmado y un PDF real de lotes.
- **Período del consumo (RptSIFA032): mes en curso.** Se confirmó con la persona usuaria. Cuando se construya el riesgo, el consumo diario = consumo ÷ días hábiles transcurridos del mes hasta la fecha del reporte.
- **Agotados se confirman con un toque** (RF-3.3): la pantalla propone los productos con cuota > 0 y existencia 0 y la persona los confirma uno a uno o todos. No se crean solos.
- **Fechas del registro como `YYYY-MM-DD`** (`fechaAgotado`, `fechaIngreso`), no `Timestamp`: son fechas civiles, igual que en las tareas. El campo de observaciones se llama `notas`, como en el PRD §9.
- **Fecha de agotamiento = fecha del reporte** donde se vio la existencia en 0 (no la fecha en que se confirmó).
- **El registro se cierra solo** cuando un reporte posterior trae existencia > 0; `fechaIngreso` es la fecha de ese reporte. Se hace al abrir la pantalla de Agotados (es idempotente), no durante la importación.
- **Días agotado en días calendario**, hasta el ingreso o hasta hoy si sigue agotado.
- **Un producto que vuelve a agotarse** genera un registro nuevo; el anterior queda en el historial.
- **Chips en Hoy:** Agotados y Bajos se cuentan desde la existencia importada (no desde el registro), con guion mientras no haya existencias.
- **Pendiente de este bloque:** exportar a PDF/Excel la lista de bajos y el reporte de agotados (RF-3.2, RF-3.5) y el alta manual de un agotado.

## 2026-11-15 · Exportaciones PDF y Excel (agotados y bajos)

- **Dependencias nuevas** (ya estaban en el stack de `CLAUDE.md`): `jspdf`, `jspdf-autotable` y `xlsx`. Se cargan con `import()` solo al pulsar PDF o Excel, para no pesar en la carga inicial. Los archivos se generan en el dispositivo (funciona sin conexión) y no pasan por ningún servidor.
- **`xlsx` 0.18.5 de npm tiene dos avisos de `npm audit`** (contaminación de prototipo y ReDoS). Solo aplican al **leer** archivos de terceros; aquí únicamente se **escribe**. Si el aviso molesta, la alternativa es instalar la versión corregida desde el sitio oficial de SheetJS (`cdn.sheetjs.com`), que queda fuera de npm.
- **Encabezado de los reportes:** texto «Stocky by NelSystems» sobre una banda azul noche, usuario, unidad (771/772) y fecha de generación. Todavía no hay logo oficial en el repo.
- **Lista de bajos:** del más escaso al menos escaso (existencia ÷ cuota mínima). Cantidades en la UD del producto; los agotados (existencia 0) no se incluyen, tienen su propio reporte.
- **Reporte de agotados por período:** «esta semana» (de lunes a hoy), «este mes» (del día 1 a hoy) o personalizado. Incluye los registros que tocan el período: los que se agotaron en él y los que ya estaban agotados y siguieron así dentro de él.
- **Pendiente:** el resumen mensual de labores (PRD §7) reutilizará este mismo generador.

## 2026-11-15 · Riesgo de agotamiento (A3 y A4)

- **Consumo = mes en curso.** Cada carga de «Productos en despacho» trae el consumo acumulado desde el día 1 del mes hasta la fecha del reporte, así que sus días hábiles van de esa fecha hacia atrás hasta el día 1. El consumo diario es la media móvil de las últimas 4 cargas (`lib/domain/riesgo.ts`).
- **Riesgo medido al día del reporte de existencias**, no al de hoy: la cobertura se compara con los días hábiles que faltaban entonces para el segundo sábado. Así un reporte viejo no «regala» días. Si el reporte tiene más de unos días, la pantalla lo muestra en el encabezado («Reporte del …»).
- **Niveles:** *Crítico* (A3) si la cobertura es menor que los días hábiles al próximo ingreso; *En riesgo* (A4) si alcanza pero con menos de `margen` días de sobra (7 por defecto, editable de 0 a 30 en Ajustes → `ajustes.umbrales.margenRiesgo`). Sin consumo: «sin datos de consumo», sin riesgo. Existencia 0: «agotado» (A6), no riesgo.
- **Día del ingreso.** Si hoy (o el día del reporte) es el segundo sábado, los días al ingreso son 0: el producto no se marca crítico porque la mercadería llega ese mismo día.
- **Lecturas acotadas.** Solo se leen los consumos de las últimas 4 cargas (se buscan en las 16 importaciones más recientes), no todo el historial, para cuidar las lecturas de Firestore. No hace falta un índice nuevo.
- **Primeras semanas del mes.** Una carga de los primeros días del mes se basa en pocos días hábiles y es más ruidosa; la media móvil de 4 cargas la suaviza.
- **Pendiente:** reporte PDF/Excel de «Bajos y riesgo» (PRD §7) y la alerta A8 (reporte desactualizado).

## 2026-11-16 · PRD en el repo y pendientes de Fase 2

- **`docs/PRD.md` ya vive en el repositorio** (copia del documento de Claude Docs). Es la fuente de verdad de qué construir.
- **Fase 3 (registros)** se desarrolla en orden: dañados (M10) → preconteo (M8) → traslados (M9) → reportes y resumen mensual (§7). Rama `fase-3-registros`, base `feat-riesgo-agotamiento` (aún sin fusionar).
- **Pendientes de Fase 2 que NO se pierden** (se retoman después, o en el momento en que un bloque de Fase 3 los necesite):
  - Vencimientos A1/A2 (M2): falta un PDF real de lotes y vencimientos.
  - Agenda de pedidos (M4) y envíos a puestos (M5); día de envío a V por confirmar.
  - Reporte PDF/Excel «Bajos y riesgo» (PRD §7).
  - Alerta A8 (reporte desactualizado).
  - Alta manual de un agotado (RF-3.4).
  - Pantalla para que el 771 habilite módulos al 772 y navegación del 772 con los módulos habilitados.
  - Seguridad: exigir App Check (`enforceAppCheck`) tras revisar métricas, solo con visto bueno.

## 2026-11-16 · Fase 3, bloque 1: Dañados (M10)

- **Cantidad en unidades sueltas**, como en el conteo físico (§13): la persona escribe lo que se dañó (`50`) y Stocky guarda unidades base; en pantalla se muestra en la UD del producto (`0.5 CN`). El PRD no lo precisa; se eligió por consistencia.
- **Foto: se guarda la ruta en Storage (`fotoRuta`), no una URL** (el PRD decía `fotoUrl`): la ruta no caduca ni necesita red para existir. La foto se reduce a JPEG ≤ 1280 px antes de subir (las reglas de Storage limitan a 5 MB).
- **La foto requiere conexión.** El registro se guarda siempre (también sin red); si no hay red, se avisa y la foto no se adjunta. Subir fotos offline en cola queda pendiente si hace falta.
- **Producto fuera del último reporte:** se permite escribir el código completo (válido por formato).
- **Totales para el resumen mensual** (`totalesDanados`, RF-10.2) por motivo y por producto; el generador PDF/Excel llega en el bloque de reportes.
- **Reglas de Firestore** de `danados` ahora validan campos (antes solo permiso por módulo). Probadas en el emulador el 2026-11-16 (ver abajo).
- **Arreglo local:** `components/layout/navegacion.ts` se renombró a `itemsNavegacion.ts`; en Windows chocaba con `Navegacion.tsx` y rompía `npm run build` (en Linux/CI no).
- **Pendiente del bloque:** editar observaciones de un dañado ya guardado, y probar subida/lectura de fotos contra el emulador de Storage.

## 2026-11-16 · Fase 3, bloque 2: Preconteo (M8)

- **Cantidad entregada en la UD del producto** (cientos para `CN`), como lo pidió la persona usuaria: `5` CN = `500` unidades base internamente. El PRD hablaba de «cajas cerradas y unidades»; se simplificó a una sola cantidad.
- **Producto elegido con buscador** entre los del último reporte importado (código o nombre). Si no está, se acepta un código completo válido. El buscador es un componente compartido con Dañados (`BuscadorProducto`).
- **Presentación:** botones 30 / 60 / 90 y «Otra» (número entero libre). Se guarda por entrega.
- **Recepción (RF-8.2):** botón «Volvió completo» o la cantidad que volvió (en la UD); `recibida` es `null` mientras esté pendiente. Diferencia = recibido − entregado (`-` si falta). Recibir 0 cuenta como diferencia, no como pendiente. Se puede deshacer.
- **Campos en Firestore:** `fecha, codigo, cantidad, presentacion, recibida, notas` (el PRD listaba `cajas, unidades, recibidoCompleto, diferencia`; la diferencia se calcula, no se guarda).
- **Totales mensuales por producto y presentación** (`totalesPreconteo`, RF-8.3) listos para el resumen de labores; el generador PDF/Excel llega en el bloque de reportes.
- **No se limita a L-Mi-J-V** el día de entrega: se muestra el día de la semana pero no se bloquea.
- **Reglas de Firestore** de `preconteos` validan campos. Probadas en el emulador el 2026-11-16 (ver abajo).
- **Pendiente del bloque:** editar notas/cantidad de una entrega ya guardada; recordatorio para entregas sin recibir (tarea sugerida) y su aviso en Hoy.

## 2026-11-16 · PRD: contenido elegible del resumen mensual y vencidos

- El PRD **no** permitía elegir el contenido del resumen mensual ni incluía **vencidos**. Se agregó al PRD: **RF-7.6** (el usuario elige qué secciones incluir; todas marcadas por defecto; misma selección para PDF y Excel; el resumen automático usa la selección guardada) y **RF-2.5** (registro de vencidos).
- **Por confirmar:** de dónde salen los vencidos (registro manual propio, o los lotes del reporte de lotes y vencimientos cuando exista). Hasta entonces se propone un registro manual, como Dañados.
- **Orden de trabajo:** el registro de Vencidos y el selector de secciones se construyen en el bloque de reportes (fase 3), después de Traslados.
- La copia original del PRD en Claude Docs no se modificó: la del repo es ahora la vigente.

## 2026-11-16 · Vencidos: del reporte y a mano; prioridad a la prevención

- **Decidido:** los vencidos se toman **del reporte de lotes y vencimientos y también a mano** (RF-2.5).
- **Prioridad del producto:** que no haya productos vencidos (objetivo 1 del PRD). El registro de vencidos solo mide cuándo falló la prevención; lo que la evita son las alertas A1 (rotación) y A2 (90 días), del módulo Vencimientos (M2, pendiente de fase 2).
- **Bloqueo:** falta un PDF real del reporte de lotes y vencimientos para diseñar el lector. La lógica de dominio (cobertura por lote consumiendo primero lo que vence antes, A1/A2) sí se puede hacer y probar sin él.

## 2026-11-16 · Historial de ingresos por lote

- Cada mes cambian lotes y vencimientos por la mercadería nueva. Se agregó al PRD **RF-1.9** y los campos `cantidadIngresada` y `fechaIngreso` en `lotes`: se conservan los ingresos anteriores (lote, vencimiento, cantidad, fecha) y cada ingreso nuevo se suma al historial.
- Un producto puede tener varios lotes vivos; el consumo se asigna primero al que vence antes (base de A1).
- **Por confirmar:** de dónde salen la cantidad y la fecha de ingreso de cada lote (el reporte, comparar reportes sucesivos, o a mano al recibir).
- Vencimientos (M2) sigue bloqueado hasta tener el reporte real; Traslados continúa mientras tanto.

## 2026-11-16 · Ciclo de reportes de lotes y proyección

- **Reporte de existencias con lotes y vencimientos: cada tercer jueves del mes** (salvo cambios; configurable). Trae existencias, número de lote y fecha de vencimiento.
- **15 días después:** recordatorio para cargar un reporte de existencias; con él se ajusta la proyección por lote y se reevalúa el riesgo de vencimiento (**RF-2.6**, nuevo en el PRD). Si cae en día no laborable, pasa al siguiente.
- Cambios en el PRD: RF-1.8, RF-2.6, tabla de notificaciones y RF-7.2.
- **Pendiente de código (con Vencimientos):** la tarea sugerida y el aviso de «jueves» que hoy existen (semanales) se cambian a «tercer jueves» y «+15 días». No se tocan hasta construir M2.

## 2026-11-16 · Fase 3, bloque 3: Traslados (M9)

- **Orden SAP:** solo dígitos, empieza con 50000 y tiene más de 5 dígitos (las reglas de Firestore exigen `^50000[0-9]*$`). No se inventó un largo máximo.
- **Estados según el tipo** (RF-9.2): recepción = pendiente por llegar → recibido; envío = pendiente → enviado. Al cerrar se guarda `fechaCierre` (la de hoy). Se puede deshacer.
- **Unidad de origen/destino:** texto libre con sugerencias (Hospital, Área de Salud).
- **Productos:** se buscan entre los del último reporte (o código completo) y la cantidad va en la UD del producto; un producto repetido se suma en una sola línea.
- **Checklist SAP/SIFA** (RF-9.3) solo para el 771 y el superadmin; «trámite sin completar» = traslado ya cerrado con SAP o SIFA sin marcar.
- **Pendientes (A7, RF-9.4):** lista ordenada del más antiguo, con los días que lleva pendiente. La tarea diaria «Revisar traslados pendientes» ya existía; el chip de Hoy ahora cuenta los pendientes y lleva a Traslados. El énfasis de los martes (encomiendas) queda solo en la nota de la tarea.
- **Totales para el resumen mensual** (`totalesTraslados`): enviados, recibidos, pendientes, trámite sin completar y unidades. El detalle con orden SAP sale de los propios registros.
- **Reglas de Firestore** de `traslados` validan campos. Probadas en el emulador el 2026-11-16 (ver abajo).
- **Pendiente del bloque:** editar un traslado ya guardado (productos, orden) y cantidades recibidas distintas de las enviadas.

## 2026-11-16 · Fase 3, bloque 4: Reportes y resumen mensual (RF-7.6, RF-2.5)

- **Resumen mensual con secciones elegibles** (Reportes): Tareas, Preconteo, Traslados, Dañados, Vencidos y Agotados, con casillas. Todas vienen marcadas la primera vez; la elección se guarda en `usuarios/{uid}.ajustes.resumenSecciones` y se recuerda (también entre meses y dispositivos). Se puede elegir cualquier mes, no solo el actual.
- **El orden de las secciones es fijo** (el de la lista), no el orden en que se marcan. Una sección elegida sin registros sale con «Sin registros»; solo se omite lo que se desmarca. Con todo desmarcado no se puede generar.
- **PDF** apaisado, una sección tras otra con su tabla y sus totales; **Excel** con una hoja por sección. Se generan en el dispositivo (sin conexión). El PDF y el Excel de siempre (agotados, bajos) no cambiaron; solo se extrajeron el encabezado y el pie para reutilizarlos.
- **Disponibilidad por módulo:** el 771 y el superadmin ven las seis; el 772 ve Tareas, Vencidos y Agotados, más las de módulos que el 771 le haya habilitado (`modulosHabilitados`). Solo se leen las colecciones de las secciones disponibles.
- **Tareas del mes:** se cuentan hechas, pospuestas, descartadas y sin hacer **hasta hoy** (los días futuros del mes en curso no cuentan como «sin hacer»); cumplimiento = hechas ÷ total. Una tarea pospuesta a otro mes aparece en el mes de su nueva fecha.
- **Vencidos:** nueva pantalla Registros → Vencidos con registro manual (producto, lote obligatorio, fecha de vencimiento, cantidad en unidades sueltas, observaciones). El campo `origen` admite `'reporte'` para cuando exista el reporte de lotes. Las reglas de Firestore usan el módulo `inventario` (lo ve el 772).
- **Aún no incluidas:** «Envíos a puestos» y «Pedidos tramitados» (sus módulos son de fase 2, pendientes) y la nota de análisis opcional de Chango IA (fase 4). **El resumen automático del último día hábil** (PRD §7) tampoco está: requiere una Cloud Function programada; queda pendiente.
- **Reglas de Firestore** de `vencidos` validan campos. Probadas en el emulador el 2026-11-16 (ver abajo).

## 2026-11-16 · Pruebas en emulador de la fase 3

- **Reglas de Firestore y Storage: 54 de 54 comprobaciones correctas** contra los emuladores (Auth + Firestore + Storage), con cuentas 771 y 772 reales del emulador (claims `role` y `unidad`):
  - Dañados, preconteo, traslados y vencidos: aceptan datos válidos y rechazan cantidad 0 o negativa, fechas mal escritas, motivo, estado, tipo y origen inválidos, orden SAP que no empieza con 50000 o con letras, traslado sin productos, lote vacío en vencidos y notas de más de 500 caracteres.
  - Aislamiento: otro 771 no lee ni escribe lo ajeno; el 772 sin módulo no escribe en dañados, preconteo ni traslados; con `danados` habilitado sí; en vencidos (módulo `inventario`) el 772 sí.
  - Cuentas: nadie puede cambiarse `modulosHabilitados` ni `unidad`; sí se guarda `ajustes.resumenSecciones`.
  - Storage: sube jpg el 771 dueño; rechaza archivo que no es imagen, más de 5 MB, al 772 y a quien escribe o lee la carpeta de otro.
- **Pantallas en el navegador** (servidor local + emuladores): Dañados (buscador, conversión `50` → `0,5 CN`, foto de 2400×1800 reducida a 1280×960, subida y «Ver foto»), Traslados (registro de una recepción completa; muestra pendientes y trámite) y Reportes (casillas, y la elección se guarda y sobrevive a recargar).
- **No probado en el navegador:** Preconteo y Vencidos (solo prueba de reglas y de dominio), la descarga real del PDF/Excel (los generadores sí tienen prueba automática de que producen un PDF y un xlsx válidos), el modo sin conexión de las pantallas nuevas y Chango.
- Las pruebas de emulador se hicieron con un script desechable fuera del repositorio; no se agregó la dependencia de pruebas de reglas. Si se quiere dejarlas como pruebas permanentes en el repo, hay que justificarla (`@firebase/rules-unit-testing`).

## 2026-11-16 · Chango IA (primera versión: consulta, analiza y sugiere)

- **Alcance:** solo consulta. No crea ni modifica registros (acciones por voz o texto quedan para la fase 5 del PRD). Se adelantó a la fase 4 a pedido de la persona usuaria, **sin** el mapa de espacios con QR ni la reubicación del mes.
- **Callable `changoPreguntar`** (Functions, `us-central1`): valida sesión; el 771 y el superadmin siempre pueden, el 772 solo con el módulo `chango` habilitado. Arma el contexto **solo con los datos de quien pregunta** y solo de los módulos que su cuenta tiene (un 772 sin `traslados` no ve traslados), y llama a Gemini por REST (sin librería nueva) con la clave en un **encabezado** (`x-goog-api-key`), nunca en la URL.
- **Contexto compacto** (`lib/domain/chango.ts`, tope de 14 000 caracteres): resumen, agotados (con sus notas), críticos y en riesgo (con cobertura en días hábiles), bajos, los productos que la pregunta nombra (por código o por palabras de la descripción), tareas de hoy y atrasadas, traslados pendientes, preconteo sin recibir, y dañados y vencidos del mes. Cada dato lleva su fecha. Le avisa a Chango qué datos **todavía no existen** (ubicaciones, lotes y vencimientos por lote, pedidos y envíos) para que diga «aún no está disponible» en vez de inventar.
- **Riesgo calculado en el servidor** con el mismo código del cliente (el dominio se copia a Functions con `scripts/copiar-dominio.mjs`, ahora con más archivos).
- **Cascada de modelos:** `gemini-3-flash-preview` → `gemini-3.1-flash-lite` (nombres verificados el 2026-11-16 en la documentación de Google; **cambian seguido** y los límites gratuitos se reportan inestables: hay quejas de 20 consultas/día en Flash). Cuota agotada, falla temporal o respuesta vacía pasan al siguiente; si ninguno responde por cuota: «Chango vuelve mañana». Un error de clave o de petición no se reintenta.
- **Tope diario por persona: 40 preguntas** (contador `usuarios/{uid}/changoUso/{fecha}`, cerrado a los clientes): protege la cuota gratuita de una sola API key compartida.
- **Historial** `usuarios/{uid}/changoIA` (pregunta, respuesta, modelo, fecha) lo escribe solo la Function; las reglas ahora impiden que el cliente escriba. Caduca a los 90 días (política TTL por activar, ver `docs/despliegue.md`).
- **Conversación en pantalla:** viaja el historial de los últimos 6 turnos; lo que terminó en aviso (sin cuota, error) no se reenvía. El texto de Gemini se pinta como nodos de React (negritas y viñetas), nunca como HTML.
- **Panel:** hoja inferior en celular y panel lateral en PC, con cuatro preguntas sugeridas, botón de cerrar dentro del panel, Escape para cerrar y aviso claro sin conexión (Chango y la gestión de cuentas son lo único que exige red).
- **Privacidad:** el prompt le prohíbe usar datos de pacientes y lo que venga dentro de los datos o la pregunta como instrucciones. En el plan gratuito Google puede usar lo enviado para mejorar sus productos; solo viajan datos de medicamentos y operación (PRD §8).
- **Pruebas:** 21 de dominio, 22 de la lógica de la Function contra el emulador de Firestore con un Gemini simulado (privacidad entre usuarios, módulos del 772, cascada, tope diario, clave en encabezado, historial) y 61 de reglas; el panel se vio en el navegador (escritorio y celular) con la Function simulada. **No se probó contra Gemini real**: falta la clave.
- **Antes de fusionar:** crear el secreto `GEMINI_API_KEY` (ver `docs/despliegue.md`); sin él el despliegue de Functions falla.

## 2026-11-16 · Ubicaciones con Chango IA (PRD)

- Se agregó al PRD **RF-6.7, RF-6.8 y RF-6.9** y la «primera acción» de Chango IA (§8): guardar ubicaciones propuestas y confirmadas.
- **Decidido:** un producto puede tener **varias ubicaciones vigentes a la vez**. Las ubicaciones se escriben en **texto libre** (sin mapa fijo, porque los nombres de estantes, tarimas y filas siguen sin confirmar); lo que no cambia se conserva y se confirma cada mes.
- **Chango propone, la persona confirma, la app escribe.** La Function no escribe ubicaciones.
- **No incluido en el PR 9** (Chango sigue de solo consulta): se construye en un PR siguiente junto con el módulo de ubicaciones.

## 2026-11-20 · Calendario de envíos y pedidos semanales (dato confirmado)

Dato dado por la persona usuaria del 771. Resuelve el pendiente «día de envío a V y confirmación de R, C y Z» (CLAUDE.md §12, PRD §3 y RF-5.1). Los módulos de envíos y pedidos (Fase 2) aún no están construidos: esto es la configuración inicial que traerán precargada.

| Día | Qué sale o se tramita |
| --- | --- |
| Lunes | Envío a **R** (Rancho Redondo) |
| Último jueves del mes | Envío a **R** (Rancho Redondo), además del lunes |
| Martes | Envío a **C** (Cascajal) |
| Miércoles | **Pedido semanal 772**, envío a **V** (Vista de Mar) y envío a **Z** (Zetillal) |
| Jueves | **Pedido de sueros** |

- Los días siguen siendo **configurables** (lo acordado en el PRD); estos son los valores iniciales.
- «Último jueves del mes» es una regla de recurrencia distinta a «cada semana»: el modelo de `puestos`/`diaEnvio` debe poder expresar «cada semana el día X» y «último jueves del mes».
- Los días siguen el calendario laboral (§5): si el día cae en feriado, no hay aviso ni recurrencia ese día. **Pendiente de confirmar:** si un envío que cae en feriado se corre al día hábil anterior o siguiente.
- El pedido semanal 772 y el de sueros son **pedidos** (M4), no envíos a puestos; V y Z comparten el miércoles con el pedido del 772.

## 2026-11-20 · Pedidos y envíos a puestos (M4 y M5)

- **Alcance:** solo el 771. Recuerda el trámite (pendiente → en trámite → enviado); no maneja cantidades. Un envío pasa directo de pendiente a enviado; un pedido pasa por «en trámite».
- **Modelo:** `tiposPedido` (pedidos) y `puestos` (envíos), con la misma forma: nombre, `recurrencias[]`, `anticipacion`, `activo`, `desde`, `notas`. La clase la da la colección. Lo hecho vive en `seguimientos/{programadoId_fecha}` (como `cumplimientos` en las tareas). Un programado puede tener **varias periodicidades**: R es «los lunes» + «el último jueves del mes» (nueva `ultimoDiaSemana`, solo para pedidos y envíos; las tareas no la usan).
- **Anticipación en días hábiles** (no calendario): «2 días antes» de un lunes es el jueves. Valores iniciales: **envíos 2** (RF-5.2), **pedidos 1** (el PRD no lo fija; editable por cada uno). Va de 0 a 10.
- **Precargados** (botón «Cargar pedidos y envíos», IDs fijos): R lunes y último jueves, C martes, V y Z miércoles, pedido semanal 772 miércoles, pedido de sueros jueves. Los demás tipos del RF-4.1 (rayos X, odontología, laboratorio, vacunas, psicotrópicos, bajos) **no tienen día confirmado: no se precargan**; se agregan con «Nuevo pedido o envío».
- **Dónde se ve:** Hoy (atrasados de hasta 7 días, hoy, «para preparar» cuando ya toca avisar, y los próximos 7 días), chip «Pedidos y envíos», Agenda (pestaña nueva para editar y pausar) y Calendario. Cada acción tiene «Deshacer».
- **Avisos:** a las 7:00 a. m., el día de `fechaAviso`, solo si sigue pendiente («Preparar envío · Cascajal (C) — Sale el martes 24.», «Poner en trámite · Pedido de sueros — Toca el jueves 19.»). Se pueden silenciar en Ajustes («Preparar envíos y pedidos»). Reglas y clave anti-repetición como el resto.
- **Feriados (actualizado 2026-11-20):** si la fecha que toca cae en feriado, se **traslada al día hábil anterior** (decidido por la persona usuaria «por el momento»; puede cambiar). Retrocede varios días si también son feriados o fin de semana, y si dos fechas caen el mismo día cuenta una sola vez. El seguimiento y el aviso usan la fecha ya trasladada.
- **Reglas de Firestore:** los dos tipos validan campos y tipos; `seguimientos` solo acepta `programadoId`, `fecha` y `estado`.
- **Resumen mensual (RF-7.6):** nuevas secciones **«Envíos a puestos»** (puesto, fecha, enviado o sin enviar) y **«Pedidos tramitados»** (pedido, fecha, sin tramitar / en trámite / enviado, con el conteo de tramitados). Cuentan solo hasta hoy (o el fin del mes) y usan las fechas ya trasladadas por feriados. Van al final del resumen. Las ve el 771 siempre; el 772 solo si el 771 le habilita los módulos `envios` o `pedidos`, igual que las demás secciones con módulo.
- **Aún no incluido:** que Chango IA conozca la agenda de pedidos y envíos.
- **Pruebas:** unitarias de dominio, avisos y resumen, y una prueba desechable contra el emulador de Firestore (fuera del repo) con las reglas (el 771 sí; otro usuario y el 772 sin módulo no; campos extra, anticipación fuera de 0–10, nombre vacío y estados inválidos se rechazan; el 772 con módulos habilitados sí) y la Function programada (aviso a las 7:00, sin repetir en la misma franja, con el feriado trasladado). **No probado en el navegador:** las pantallas nuevas solo pasan tipos, lint y build.

## 2026-11-20 · Reporte de lotes y vencimientos (primer bloque de Vencimientos, M2)

Primer PDF real de lotes: `Rpt_VenceBodega.rpt` («Reporte por Lotes Próximos a Vencer como límite al 20/11/2070»), despacho 771, 11 páginas, 551 filas. **Alcance de este bloque:** lector + revisión de cambios + guardado. Todavía **no** están las alertas A1/A2, la pantalla de Vencimientos, gestionar lotes ni la proyección (RF-2.6).

- **Códigos en cualquier forma (pedido de la persona usuaria):** los PDF pueden traer `XXX-XX-XXXX` o `X-XX-XX-XXXX`, y el lector de lotes además entiende el código en cuatro columnas del reporte real (`1 10 16 10`). Las tres formas se unifican a `XXX-XX-XXXX` (misma regla que `normalizarCodigo`), así que un producto nunca se duplica aunque dos reportes lo impriman distinto. Hay pruebas con las tres formas mezcladas en un mismo reporte.
- **Formato del PDF:** una fila por lote (producto, lote, vence, existencia, valor en colones). El código sale en **cuatro columnas** (`1 10 16 10` = `110-16-0010`; los ceros a la izquierda no se imprimen). La existencia viene en la UD del producto (`2544.360 CN` = 254 436 unidades). Fechas como `31-ene-2029` (septiembre es «sept»). Trae un **«Total general»** en colones. Algunas descripciones largas se parten en dos líneas (13 filas dudosas); a veces existencia y valor salen pegados (`384000.0001,442,995,200.00`).
- **Se cuadra el valor:** la suma de las filas debe coincidir con el «Total general» (con tolerancia de medio céntimo por fila, porque el reporte redondea cada fila pero no el total: con el PDF real la diferencia fue de ₡0,03). **Si no cuadra, no se guarda**: significa que falta o sobra una fila. Las líneas que no se pudieron leer se avisan, nunca se descartan en silencio.
- **Cada carga se revisa antes de guardar** (pedido de la persona usuaria): la vista previa compara contra la carga anterior y la persona debe marcar «Revisé los cambios, las cantidades y las fechas de vencimiento contra el PDF». Se muestra: **cambió el vencimiento** de un mismo lote (se resalta como crítico), cantidad que **subió** (solo debería pasar con un ingreso o una corrección), lotes **vencidos con existencia**, lotes que **salieron**, lotes **nuevos**, cantidad que **bajó** (consumo), el **cuadre con las existencias de SIFA** (suma de lotes contra el reporte de existencias guardado; solo comparable si son de la misma fecha) y las filas dudosas.
- **Un lote** se identifica por producto + número de lote + vencimiento: el mismo número con dos vencimientos son lotes distintos (en el PDF real, el alfacalcidol 9442501). Tres lotes vienen repetidos con la misma fecha: se **suman** y se avisa. Un mismo lote que cambia de fecha se detecta solo si queda uno sin pareja a cada lado; si hay ambigüedad no se adivina (salida + entrada).
- **Guardado** (`usuarios/{uid}/lotes`): cada lote queda con su cantidad real (unidades base), `ultimaVez`, `cantidadIngresada` y `fechaIngreso` (RF-1.9: si la cantidad sube se suma al ingreso). Lo que **ya no aparece** queda en cantidad 0 y estado `agotado` (**no se borra**); si reaparece vuelve a `activo`; un lote `gestionado` sigue gestionado. La importación guarda el resumen de cambios revisado.
- **No medicamentos** (condones, etiquetas, bolsas: códigos que no empiezan con 1): se **importan y se marcan** (`noMedicamento`, solo como etiqueta). **También entran en las alertas de vencimiento** (aclarado el 2026-11-20: siempre que tengan existencia y fecha de vencimiento hay que incluirlos). En el PDF real son 23 lotes (condones, etiquetas, bolsas), todos con existencia y fecha, y ninguno se descartó.
- **Se bloquea** guardar si: el despacho del reporte no es el del usuario, el valor no cuadra, no se pudieron leer los lotes guardados (sin red ni copia local; marcaría como agotado lo que no se pudo comparar) o el reporte es **más antiguo** que la última carga. Misma fecha que la última carga: solo aviso.
- **Pruebas:** unitarias del lector (formato real), del dominio y de los cambios; el PDF real se verifica con `STOCKY_PDF_DIR` (551 filas, total cuadra, 13 dudosas, 3 repetidos); reglas de `lotes` probadas contra el emulador de Firestore (estado y cantidad inválidos, fecha mal formada, merge de salidas). **No probado en el navegador** la pantalla de importar con este reporte.
- **Pendiente de este bloque:** pantalla de Vencimientos (RF-2.1) y alertas A1/A2; gestionar lotes (RF-2.4); vencidos automáticos (RF-2.5); proyección entre cargas (RF-2.6) y la tarea del «tercer jueves» (RF-1.8); guardar el detalle de cada cambio por carga (hoy solo se guarda el conteo).

## 2026-11-20 · Vencimientos: pantalla, alertas A1/A2, proyección, gestión de lotes y vencidos automáticos

Segundo bloque del M2, sobre el lector de lotes. Reglas del PRD §6 (A1, A2) y RF-2.1, 2.4, 2.5, 2.6, 1.8.

- **Pantalla** `Inventario → Vencimientos y lotes` (`/inventario/vencimientos/`, también desde el chip «Vencimientos» de Hoy, que ahora cuenta vencidos + prioridad alta). Lotes de la más urgente a la menos, con filtros (Urgentes, Prioridad media, Todos, Gestionados), búsqueda por código, nombre o lote, «Gestionar» y «Reabrir», y una pestaña **Historial de cargas** con el detalle de cada cambio.
- **A2 (fecha fija):** faltan 90 días o menos → media; 30 o menos → alta (exactamente 30 y 90 cuentan). Días de calendario. Los umbrales están como constantes (`DIAS_A2_MEDIA`, `DIAS_A2_ALTA`); **aún no son editables en Ajustes**.
- **A1 (rotación):** consumiendo en orden de vencimiento (primero lo que vence antes) al consumo diario promedio, el lote no se agota antes de vencer → alta, aunque falte mucho. Se simula lote por lote con **días hábiles** (los mismos del riesgo de agotamiento: calendario laboral, feriados): un lote solo se consume mientras no haya vencido, y si el de antes se pierde con sobrante, el siguiente no recupera esos días. Muestra el **excedente** (unidades que no se consumirán) y la cobertura acumulada, con la sugerencia «trasladar el excedente o priorizar su despacho». **Sin consumo del producto no se evalúa A1** (solo A2) y la pantalla lo indica.
- **Vencido:** la fecha ya llegó (o es hoy) y todavía hay existencia. Nivel propio, el más alto; meta cero.
- **No medicamentos** (condones, etiquetas, bolsas) alertan igual que los medicamentos.
- **Gestionar (RF-2.4):** motivo (trasladado a otra unidad, consumido, dado de baja en SIFA, otro) con nota. Un lote gestionado **deja de alertar y de proyectarse**, sigue gestionado en las cargas siguientes y se puede reabrir (vuelve a `vencido` o `activo`). Con «Deshacer».
- **Vencidos automáticos (RF-2.5):** al guardar una carga, cada lote cuya fecha ya llegó y tiene existencia queda `vencido` y se registra en Vencidos con origen `reporte`, **una sola vez** (id fijo `lote-<id del lote>`; no se vuelve a crear en la carga siguiente, así lo que la persona edite en el registro no se pisa). Un lote gestionado no se registra. Aparece en el resumen mensual de labores.
- **Proyección (RF-2.6):** entre dos cargas de lotes, la cantidad de cada lote se proyecta restando el consumo diario promedio de los días hábiles transcurridos, primero lo que vence antes (se muestra con «≈» y la cantidad real del último reporte). Si hay un **reporte de existencias posterior** a la carga, la proyección se ajusta a lo real en esa fecha: la diferencia se descuenta de los lotes que vencen antes, y sigue desde ahí hasta hoy. Si la existencia real es **mayor** que la proyectada no se inventa en qué lote está: se avisa («¿un ingreso sin registrar?»). Sin consumo no se proyecta (salvo el ajuste a lo real). La proyección **no se guarda**: se calcula al abrir, y el reporte de lotes del tercer jueves la reemplaza por lo real. Aproximación conocida: un lote que vence a mitad del tramo deja de consumirse desde su vencimiento, no antes.
- **Detalle de cada cambio:** al guardar una carga se guarda cada cambio revisado (vencimiento, subió, bajó, nuevo, salió) en `importaciones/{id}/cambios`, con críticos primero; se consulta en la pestaña Historial. **La primera carga no se detalla** (todo sería «nuevo»; queda el conteo).
- **Tareas de reportes (RF-1.8, RF-7.2):** nuevas recurrencias `tercerJueves` y `tercerJuevesMas15` (+15 días del tercer jueves; si no es laborable, el siguiente día laborable, aunque sea del mes siguiente). La tarea precargada «Cargar reportes» deja de ser semanal: ahora **«Cargar reporte de lotes y vencimientos» el tercer jueves a las 7:00** y **«Cargar reporte de existencias» 15 días después a las 7:00**. A quien ya la tenía sembrada se le **migra solo si no la había editado** (conserva pausa y fecha de inicio); si la editó, no se toca. Los avisos de las 7:00 salen por el recordatorio normal de tareas con hora. Nota: el recordatorio semanal de **consumos** ya no existe como tarea precargada (el PRD no lo lista en RF-7.2); la alerta A8 (más de 8 días sin consumos) sigue pendiente.
- **Pruebas:** unitarias de simulación FEFO, A1/A2 (incluidos los límites 30/31 y 90/91 días y el orden), proyección (con y sin existencia real), vencidos automáticos, detalle de cambios, recurrencias del tercer jueves y migración de la tarea; contra el emulador de Firestore: reglas de gestionar/reabrir, detalle de cambios, vencido con origen `reporte`, tareas nuevas, y la Function programada (recordatorio del tercer jueves a las 7:00, ninguno otro jueves, y +15 días). **No probado en el navegador:** la pantalla de Vencimientos y la importación.
- **Pendiente de este bloque:** resuelto en la sección siguiente (umbrales, aviso, exportar, Chango e ingresos).

## 2026-11-20 · Vencimientos: umbrales editables, aviso push, exportar, Chango IA e ingresos

Cierra los pendientes del bloque anterior.

- **Umbrales de A2 editables** (Ajustes → «Alertas de vencimiento», `ajustes.umbrales.vencimiento = { alta, media }`): alta de 1 a 365 días, media hasta 730 y **siempre mayor que la alta**; por defecto 30 y 90. Un valor guardado inválido vuelve a 30/90 (nunca rompe una alerta). Los usan la pantalla, el chip de Hoy, el aviso, el reporte exportado y Chango.
- **Una sola evaluación, en cliente y en servidor:** `evaluarVencimientos` (proyección + A1/A2) la corren igual la pantalla, la Function programada y Chango; `lotes.ts` y `vencimientos.ts` se copian a Functions con `scripts/copiar-dominio.mjs` (por eso `lotes.ts` ya no importa nada con alias `@/`).
- **Aviso push de lotes por vencer** (7:00 a. m., silenciable en Ajustes → «Lotes por vencer»): **cada día laborable mientras haya lotes vencidos con existencia** (meta: cero; mismo aviso hasta que se gestionen o salgan), y, si no hay vencidos, **una vez por semana** (el primer día laborable) cuando haya lotes de prioridad alta. La prioridad media no avisa (se ve en la pantalla). Mismo mecanismo anti-repetición que los demás avisos. Costo: ~1 600 lecturas al día por cuenta a las 7:00 (lotes + existencias + consumos).
- **Exportar a PDF y Excel:** botones sobre la lista de Vencimientos; exportan **la lista filtrada que se ve** (urgentes, media, todos o gestionados). Columnas: código, descripción, lote, vence, días, existencia (≈ si es proyección), prioridad, excedente de A1 y nota (gestionado con su motivo, o desde qué reporte se proyectó). Encabezado con la última carga y los umbrales, resumen al pie. Funciona sin conexión.
- **Chango IA conoce los lotes:** su contexto ahora trae «Vencimientos (lotes)»: fecha del último reporte de lotes, conteos por nivel (vencidos, alta, media, A1), los vencidos y los de prioridad alta (hasta 25 de cada uno) y **los lotes de los productos que nombre la pregunta**; avisa si no hay reporte de lotes o si hubo ingresos sin cargar. Sigue siendo solo consulta. Lo que aún no tiene: ubicaciones y agenda de pedidos y envíos.
- **Ingresos que la proyección no suma:** Stocky no puede saber qué lotes entraron ni cuánto entre dos cargas (eso lo trae el reporte real), así que **no los inventa**. Lo que hace: si pasó un segundo sábado desde la última carga, la pantalla de Vencimientos avisa («hubo ingreso de mercadería… que la proyección no incluye; carga el reporte de lotes»), Chango también lo dice, y si la existencia real de un producto resulta mayor que la proyectada se marca para revisar (ya existía). El reporte de lotes del tercer jueves reemplaza la proyección por lo real.
- **Pruebas:** unitarias (umbrales y sus límites, evaluación, ingresos, aviso de vencimientos incluido el feriado del lunes, reporte exportado con PDF y Excel, contexto de Chango); contra el emulador de Firestore, la Function programada (aviso diario con vencidos, semanal con prioridad alta, silenciado, umbrales propios, sin repetir en la misma franja) y la carga de datos de Chango con lotes. **No probado en el navegador:** Ajustes, la pantalla de Vencimientos y la exportación.

## 2026-11-20 · Diferencias permanentes entre lotes y existencias de SIFA

Con el reporte de existencias del 20/11/2026 y el de lotes del mismo día se cruzaron a mano: 1 039 productos leídos sin advertencias, 436 coinciden exactamente y **1 difiere** (110-46-2660 fusidato: lotes 154 tubos contra 233 de existencia: 79 sin lote registrado, un problema de SIFA). Hasta ahora esa comparación solo se veía en la vista previa de la importación de lotes y después desaparecía.

- **Pestaña «Diferencias con SIFA»** en Inventario → Vencimientos, con el conteo en la pestaña, y **chip «Lotes vs SIFA»** en Hoy (enlaza a la pestaña). **Sin aviso push** (decisión de la persona usuaria).
- **Qué compara:** la suma de lotes de la última carga (incluidos los **gestionados**: el reporte los sigue trayendo mientras tengan existencia; los agotados no) contra la existencia del último reporte de existencias. Lista tres cosas: suma de lotes distinta de la existencia (con la diferencia con signo: negativa = existencia sin lote), productos con existencia y **sin ningún lote**, y productos con lotes y **sin existencia guardada**.
- **Solo si ambos reportes son de la misma fecha.** Si no lo son, la pestaña lo dice y el chip muestra un guion: entre dos reportes hay consumo e ingresos y la diferencia no sería un error. (La proyección de lotes ya se ajusta a la existencia real cuando esta es más nueva.)
- Se calcula siempre con lo guardado, así que **da igual el orden de importación** (primero lotes o primero existencias): al cargar el segundo reporte la diferencia aparece.
- **Pruebas:** unitarias (el caso del fusidato, sin lotes, sin existencia, fechas distintas, gestionados y agotados) y una prueba con los dos PDF reales (`STOCKY_PDF_DIR`, archivos `rpt_vencebodega.pdf` y `rpt_existenciasdespacho20112026.pdf`): 436 coinciden y 1 difiere. **No probado en el navegador.**

## 2026-11-20 · «13 filas dudosas» del reporte de lotes: solo se toma lo que se necesita

La persona usuaria cargó primero las existencias y luego los lotes y vio «13 filas dudosas… la descripción venía partida». Causa: en esas filas el PDF imprime la **segunda línea de la descripción** cerca de la fila vecina, y al agrupar los fragmentos por altura se mezclaba con la descripción de otro producto (p. ej. 110-04-0045 salía como «MOFETILO 250 MG (COMO» cuando es ABACAVIR 600 MG; el trozo era de la fila de arriba). **El código, el lote, el vencimiento y la cantidad vienen de columnas propias y estaban bien**: los 13 productos cuadraron con las existencias y el valor total cuadró.

- **Principio (pedido de la persona usuaria): de cada reporte, Stocky toma solo la información que necesita.** Del reporte de lotes: código, lote, vencimiento, existencia (y el valor, solo para cuadrar el total). **El nombre del producto sale del reporte de existencias** (completo); el del PDF de lotes solo se usa si no hay existencias guardadas.
- Con las existencias cargadas antes, ya **no aparece la advertencia de filas dudosas**: la vista previa solo dice cuántas filas traían la descripción partida y que se usó el nombre de existencias. Sin existencias guardadas, se avisa con otro texto («nombre incompleto; el código, lote, vencimiento y cantidad sí se leyeron bien; el nombre se completa al importar las existencias»).
- **Sin duplicados** (pedido explícito): un lote es código + lote + vencimiento; cargar el mismo reporte dos veces no cambia cantidades, ingresos ni la cantidad de lotes, y la revisión dice «sin cambios». Medicamentos y no medicamentos (23 lotes en el PDF real) quedan una vez cada uno. Los 3 lotes que el PDF imprime en dos filas con la misma fecha **se suman, no se duplican**: la suma por producto cuadra exactamente con las existencias de SIFA (436 productos) y con el total del reporte.
- **Pruebas:** unitarias (el nombre sale de existencias, la segunda carga idéntica, medicamentos y no medicamentos una vez, lote en dos filas) y con los PDF reales (los 13 toman su nombre completo de existencias; la segunda carga no cambia nada).
- **Pendiente anotado:** que la persona **elija qué hace con el archivo que sube** (cargar existencias, cargar lotes, actualizar consumos…) en vez de que Stocky lo adivine por el encabezado; hoy se detecta solo.

## 2026-11-20 · «Lote repetido» deja de ser una advertencia

La persona usuaria preguntó si los avisos «Lote repetido en el reporte… 2 filas. Se suman sus cantidades» significaban duplicados. **No lo son:** SIFA guarda una fila por cada entrada de mercadería, así que un mismo lote (mismo producto, número y vencimiento) puede salir en dos filas con cantidades distintas. En el PDF real son tres: metformina 4162601 (1 060 + 3 200 = 4 260 CN), indometacina T1AIZ01 (42 + 16 = 58 CN) y bupivacaína 75WH104 (132 + 80 = 212 FA), y cada suma coincide exactamente con la existencia de SIFA.

- El lector ya **no las pone en «Revisa antes de guardar»**: las informa como dato (`repetidos`, con las cantidades de cada fila).
- La vista previa tiene un bloque propio: «N lotes vienen en dos filas (varias entradas del mismo lote)… no se duplica nada», con cada suma («1 060 + 3 200 = 4 260 CN») y su estado: **coincide con SIFA**, **el producto NO coincide con SIFA: revisa** (esa sí lleva borde de advertencia) o **sin existencias guardadas para comparar**.
- Sigue guardándose un solo lote con el total; cargar el mismo reporte otra vez no vuelve a sumar.

## 2026-11-21 · Conteo físico contra SIFA (CLAUDE.md §13): decisiones de la primera versión

La persona usuaria fijó el orden de prioridad y el conteo físico quedó primero. Decisiones para lo que el §13 dejaba abierto:

- **Solo por producto** (no por lote) en esta versión. Contar por lote se agrega cuando haya muestra del reporte de lotes; se anotó como pendiente.
- **Producto contado que no está en SIFA:** se puede agregar con código, nombre y UD; **SIFA = 0**, todo lo contado cuenta como sobrante y la fila queda marcada «No está en SIFA».
- **Alcance:** todos los productos o una lista que se arma buscando por código o nombre. El filtro por ubicación llega con Ubicaciones (M6).
- **Datos:** `usuarios/{uid}/conteos/{id}` guarda la **foto** de SIFA (código → descripción, UD y existencia en unidades base) y la fecha del reporte; **no se edita** (las reglas niegan `update`). Lo contado vive en `conteos/{id}/lineas/{codigo}` (una por producto contado; sin línea = «sin contar», no 0). Así una captura es una sola escritura pequeña, también sin conexión.
- **Captura:** unidades sueltas; acepta `20000`, `20 000`, `20.050` (miles) y decimales con coma. Un punto con exactamente tres dígitos se toma como miles (`20.050` = 20050).
- **Gris:** token nuevo `diferencia` (`#3b4660`) en pantalla; en el PDF el rayado alterno se desactiva cuando hay filas resaltadas (el gris significaría dos cosas) y las filas con diferencia van en gris con la diferencia en negrita.
- **Excel con gris:** SheetJS (`xlsx`) no escribe colores de relleno (verificado: el `styles.xml` no los trae), así que se suma **`xlsx-js-style` 1.2.0** (fork de SheetJS con estilos; Apache-2.0; versión fijada; publicada en abril de 2022, sin cambios desde entonces; **solo escribe** libros, nunca lee archivos ajenos) y se agrega al stack de `CLAUDE.md`. Solo `generarExcel` lo usa (carga dinámica); el resumen mensual sigue con `xlsx`. Las filas con diferencia salen con fondo gris `D1D5DB` y la diferencia en negrita, y además llevan «(falta)» o «(sobra)» en texto para no depender solo del color. `npm audit` no suma hallazgos nuevos (el aviso sobre `xlsx` ya existía). Verificado en el archivo generado (relleno y negrita en `styles.xml`).
- **Pruebas (Vitest):** conversión sueltas → UD (`20000 → 200 CN`, decimales, factor 1), signo de la diferencia, sin contar ≠ 0, foto que se conserva al importar otro reporte, resumen, `leerCantidad` y el reporte (columnas, resalte, solo diferencias, PDF y Excel válidos). Reglas de Firestore verificadas contra el emulador (dueño, foto inmutable, línea inválida, otro usuario). **La pantalla no se ha probado en el navegador.**

## 2026-11-21 · Reporte «Bajos y riesgo» (PRD §7): qué lista y dónde vive

- **Qué lista:** productos en A3 (crítico), A4 (en riesgo) y A5 (bajo cuota mínima). Un producto que cumple varias reglas sale **una sola vez**, con la más urgente, y una nota «También bajo cuota mínima». Los **agotados (A6) no entran**: tienen su propio reporte.
- **Orden:** crítico (menos días hábiles primero), en riesgo (igual) y bajos (el más lejos de su mínima primero).
- **Columnas:** Código, Descripción, Prioridad, Existencia, Cuota mínima, Alcanza (días hábiles), Ingreso en (días), Nota. Resumen por nivel.
- **Sin consumos cargados** el riesgo no se puede calcular: el reporte lista solo los bajos y lo dice en el resumen y en pantalla.
- **Dónde:** sección «Bajos y riesgo» en Reportes, **solo para el 771** (usa existencias y consumos del módulo de inventario). Al día (sin selector de período). La lista simple de bajos sigue disponible en Inventario.
- **Pruebas:** orden, deduplicación, exclusión de agotados y sin consumo, sin consumos cargados, resumen y el reporte (columnas, UD, nota). **La pantalla no se probó en el navegador.**

## 2026-11-21 · Punto 3: alerta A8, alta manual de agotados y módulos de la 772

- **A8 (reporte de consumos desactualizado):** salta con **más de 8 días calendario** desde la fecha del último reporte «Productos en despacho» (8 días exactos todavía está al día; sin ninguna carga se muestra «aún no hay consumos»). Es un chip en Hoy, **solo para el 771**, que lleva a Importar. **Sin aviso push** (igual que las diferencias de lotes: solo pantalla). La fecha sale de la importación más reciente de ese tipo, con la misma consulta de los consumos (sin índice nuevo).
- **Alta manual de un agotado (RF-3.4):** botón «Registrar a mano» en Agotados: producto (buscador o código), fecha de agotamiento (no futura) y observación. Origen `manual`; no se permite si el producto ya tiene un agotado abierto; se cierra solo con el siguiente reporte con existencia, como los detectados.
- **Módulos de la 772:** los clientes no pueden listar `usuarios`, así que el 771 ve la cuenta de la farmacia con la callable nueva **`cuentas772`** (solo 771 y superadmin; devuelve nombre, si está activa y módulos habilitados, sin correo). Sección **Ajustes → Farmacia 772** (solo 771) con interruptores por módulo, reutilizando `HojaModulos` y la callable `habilitarModulos`. Requiere conexión.
- **Navegación de la 772:** **Registros** aparece solo si tiene Preconteo, Traslados o Dañados, y la pantalla lista solo lo habilitado. **Vencidos** (registro manual) es solo del 771. Pedidos, Envíos y Ubicaciones habilitados aún no aparecen en la navegación de la 772: quedan pendientes.
- **Corrección al conteo físico (PR 23):** la 772 tiene `inventario` de base en las reglas, y los conteos usaban ese permiso, así que podía crearlos. Ahora las reglas de `conteos` y `lineas` son solo del 771 y el superadmin (verificado contra el emulador: 771 crea, 772 recibe 403) y el enlace «Conteo físico» no se muestra a la 772.
- **Pruebas:** A8 (borde de 8 días, entre meses, sin carga, fecha futura), validación del alta manual (código, fecha futura, duplicado abierto, tope de observaciones) y módulos visibles de Registros según la unidad. **Pantallas sin probar en navegador.**

## 2026-11-21 · Puntos 4 y 6: tipo de archivo al importar y editar registros

- **Tipo de archivo (punto 4):** Importar tiene el selector **«¿Qué reporte es?»** con cuatro opciones: *Detectar solo* (por defecto, como antes), *Existencias de despacho*, *Productos en despacho (consumos)* y *Lotes y vencimientos*. El PDF se sigue leyendo en el navegador; el encabezado se detecta siempre y, si la persona eligió un tipo distinto del detectado, **no se guarda nada** y se muestra cuál eligió y cuál es el PDF. Un PDF no reconocido nunca pasa. Así no se carga un reporte como si fuera otro.
- **Editar (punto 6):** dañados, traslados y entregas de preconteo se editan con un botón de lápiz que abre el mismo formulario con los datos. **Deshacer** devuelve el registro como estaba. Las reglas de Firestore ya validaban las actualizaciones: no cambiaron.
  - **Cantidades:** se guardan en unidades base; al editar vuelven a la UD del producto (`20000` → `200 CN`; sin UD conocida, unidades sueltas) y al guardar se convierten otra vez, sin cambiar lo que no se tocó.
  - **Traslados:** el trámite SAP/SIFA no se toca. Si se cambia el tipo (envío ↔ recepción) y el estado ya no corresponde, vuelve a pendiente y sin fecha de cierre.
  - **Entregas de preconteo:** lo recibido (`recibida`) no se toca; la diferencia se recalcula con la cantidad nueva.
  - **Dañados:** la foto se conserva; si se elige otra al editar, reemplaza la anterior (misma ruta en Storage).
- **Recepción de traslados con cantidades distintas (resto del punto 6):** aplica **solo a recepciones** (decisión de la persona usuaria; los envíos siguen igual). Al pulsar «Marcar recibido» se abre «Recibir traslado»: **«Llegó todo»** (un toque) o, producto por producto, cuánto llegó en la UD del producto (lo que se deja en blanco llegó completo), con la diferencia en vivo. Cada producto guarda `recibida` (unidades base, opcional) junto a `cantidad` (lo que decía la orden); sin `recibida` se toma como llegado completo (compatible con lo ya guardado). **Diferencia = llegó − esperado**, con `-` si faltó. Deshacer vuelve a pendiente y quita lo anotado. El resumen mensual cuenta las **unidades realmente recibidas** y agrega «Recepciones con diferencia: N». Al **editar** una recepción ya cerrada se conserva lo recibido de cada producto (la diferencia se recalcula); si se cambia a envío, vuelve a pendiente y se descarta. Sin cambios en `firestore.rules` (ya aceptan la lista de productos).
- **Recordatorio de entregas sin recibir (resto del punto 6):** **solo un chip en Hoy** («Entregas sin recibir», con la antigüedad de la más vieja), **sin aviso push** (decisión de la persona usuaria); solo 771. Lleva a Preconteo.
- **El punto 5 (resumen mensual automático) quedó sin número**, pendiente.
- **Pruebas:** selector (detección de los tres reportes, elección correcta, elección distinta, no reconocido) edición (ida y vuelta de las cantidades, estado del traslado al cambiar el tipo, el trámite no se toca) y recepción de traslados (lo que no se anota llega completo, diferencia con signo, negativos, totales con lo realmente recibido, edición de una recepción cerrada) más el resumen del chip de entregas sin recibir. **Pantallas sin probar en el celular.**

## 2026-11-21 · Pedido al ALDI (fuera del PRD): propuesta de reposición

La persona usuaria pidió crear pedidos al ALDI (el almacén que abastece al 771) para **reponer la totalidad de las existencias del 771**, con un factor y un período (mensual, 15 días u otro). **Cambia una regla del proyecto:** `CLAUDE.md` §1 decía que Stocky «no calcula cantidades de pedido». Se actualizó: es la **única excepción**, y lo que se calcula es una **propuesta** que la persona revisa y ajusta; Stocky no escribe en SIFA ni en SAP.

### Fórmula (versión vigente, tras corregir un supuesto)
La primera versión (PR 26) usaba `cuota × factor × (días ÷ 30) − existencia`, suponiendo que la cuota era el consumo de un mes. **La persona usuaria aclaró que la cuota es lo máximo que se permite tener en existencia** (el tope, que en teoría va de la mano con el consumo, aunque algunas cuotas están desactualizadas), y que el consumo varía según la categoría del producto. Con eso la fórmula se rehízo:

- `consumo del período = consumo diario × días hábiles del período`. El **consumo diario** es el mismo que usa el riesgo de agotamiento (media móvil de las últimas 4 cargas del reporte «Productos en despacho», por día hábil). Los días hábiles salen del calendario laboral (lunes a viernes y segundo sábado, sin los feriados del usuario) de los próximos N días calendario.
- `objetivo = lo menor entre la cuota y (consumo del período × factor)`; `a pedir = objetivo − existencia`, **redondeado hacia arriba a la UD entera**; si no es positivo, no se pide (nunca negativo).
- **La cuota es el tope y nunca se pasa** (decisión de la persona usuaria). El **factor** (1.25, 1.5, 2 u otro número entre 0 y 10; uno por pedido) es el **margen de seguridad sobre el consumo**.
- **Líneas «limitadas por la cuota»:** cuando consumo × factor pasa de la cuota, se pide hasta la cuota y la línea se marca (pantalla, resumen, PDF y Excel): el consumo pide más de lo permitido, señal de una cuota posiblemente baja.
- **Sin consumo cargado:** se repone **hasta la cuota** y la línea se marca «sin consumo» (decisión de la persona usuaria).
- **Consumo cero** (hay datos pero el producto no se mueve): **no se pide**, aunque la existencia sea baja; se cuenta como «sin movimiento».
- Ejemplo (cuota 100 CN, existencia 40 CN, factor 1.5): consumo mensual 30 CN → objetivo 45 → pide 5 CN; 70 CN → 105 pasa el tope → objetivo 100 → pide 60 CN (limitada por la cuota).
- Un período sin días hábiles se rechaza en pantalla.

### El resto
- **Qué productos entran:** los que tienen **cuota > 0 y existencia en el reporte** y algo que reponer. Se informa cuántos se omitieron (sin cuota, sin existencia, sin movimiento, ya cubiertos). Las líneas en 0 no aparecen.
- **Ajustes a mano:** cada cantidad se puede cambiar (entero; 0 saca la línea). Se conserva lo sugerido; cambiar el factor o el período descarta los ajustes.
- **Historial:** «Guardar pedido» deja una foto en `usuarios/{uid}/pedidosAldi` (fecha, factor, días, fecha del reporte de SIFA y líneas con su consumo y criterio); no se edita, solo se exporta o se borra (con Deshacer). Los pedidos guardados con la primera versión siguen leyéndose (sin consumo ni criterio). Reglas: solo el 771 y el superadmin (la 772 tiene `inventario` de base pero no pide); verificado contra el emulador.
- **Exportar:** PDF y Excel con Código, Descripción, UD, Cuota, Existencia, Consumo del período, Objetivo, A pedir y Nota, encabezado con período, factor y fecha del reporte, y el aviso de que es una propuesta.
- **Periodicidad:** el período define cuánto cubre el pedido. Para que Stocky lo recuerde cada mes o cada tantos días se usa la agenda de pedidos que ya existe (un tipo «ALDI» con su periodicidad).
- **Pendiente (anotado):** **sugerir ajustar cuotas** con unos 3 meses de consumos (ver abajo), factor por producto, descontar lo que ya viene en camino y que Chango conozca los pedidos.
- **Pruebas:** la fórmula (consumo bajo y alto, tope de la cuota, factores, 15 días, existencia sobre el objetivo, redondeo), sin consumo, consumo cero, alcance y omitidos, ajustes, días hábiles, parámetros y el reporte (columnas, UD, notas, resumen, pedidos de la primera versión, PDF y Excel válidos). **La pantalla no se probó en el celular.**

### Pendiente nuevo: sugerir ajustar las cuotas (idea de la persona usuaria, 2026-11-21)
Algunas cuotas pueden estar desactualizadas. Con el tiempo (**unos 3 meses** de cargas de consumo) Stocky debería **sugerir ajustar la cuota** de un producto según su consumo. Es solo una sugerencia: la cuota se cambia en SIFA. Por diseñar con la persona usuaria (cuánta diferencia entre cuota y consumo justifica sugerir, subir y bajar, cómo se muestra y si Chango la menciona). Las líneas «limitadas por la cuota» del pedido ya son la primera señal. Requiere leer más de las últimas 4 cargas de consumo (hoy el riesgo solo lee esas).

## 2026-11-21 · Entrega de los reportes en el celular: compartir, abrir y descargar

**Problema (la persona usuaria, en Safari de iPhone, sin instalar la app):** los reportes se generaban pero no aparecía forma de descargarlos. La descarga era un enlace oculto con `download`, disparado **después** de generar el archivo (ya sin el toque directo) y con solo un aviso «PDF generado»; Safari de iPhone a menudo ignora eso o lo abre sin avisar, y no hay un diálogo de descarga como en computadora.

- **Qué se hizo:** al terminar de generar (PDF o Excel, en cualquier reporte: todos usan `BotonesExportar`), queda en pantalla un cuadro «Archivo listo» con tres botones que se tocan con un gesto directo: **Guardar / Compartir** (menú de compartir del sistema, con «Guardar en Archivos», WhatsApp o correo; solo si el navegador puede compartir archivos), **Abrir** (pestaña nueva, desde donde Safari ofrece compartir y guardar) y **Descargar** (el enlace de siempre).
- **En computadora** (puntero fino) además se descarga sola, como antes.
- **Lo que no se verificó:** el comportamiento real en el iPhone (no hay forma de probarlo desde aquí). El diagnóstico es probable, no confirmado; si «Guardar / Compartir» no aparece o no funciona en su Safari, queda «Abrir» y «Descargar» y habría que mirar la causa.
- **Sin dependencias nuevas.** Los archivos se siguen generando en el dispositivo (no pasan por ningún servidor).
- **Pruebas:** nombre y tipo del archivo (PDF válido, Excel), qué se ofrece según el dispositivo y que la detección de «compartir» no falla donde no existe.

