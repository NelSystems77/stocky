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
- **Reglas de Firestore** de `danados` ahora validan campos (antes solo permiso por módulo). **No probadas aún en el emulador.**
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
- **Reglas de Firestore** de `preconteos` validan campos. **No probadas aún en el emulador.**
- **Pendiente del bloque:** editar notas/cantidad de una entrega ya guardada; recordatorio para entregas sin recibir (tarea sugerida) y su aviso en Hoy.
