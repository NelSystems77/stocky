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
- **Sin avisos repetidos.** Cada aviso reserva un documento `usuarios/{uid}/avisosEnviados/{clave}` con `create()` (atómico): si la función corre dos veces en la misma franja, la segunda no envía. Estos documentos crecen unos pocos por día; conviene una política TTL en Firestore más adelante.
- **Código compartido, no duplicado.** `scripts/copiar-dominio.mjs` copia `lib/domain/{types,calendario,recurrencia,tareas,notificaciones}.ts` a `functions/src/dominio/` en el `prebuild` (carpeta ignorada por git). El cliente y el servidor deciden con el mismo código.
- **Tokens inválidos se borran** de la cuenta cuando FCM los rechaza.
- **Cada tipo se puede silenciar** en Ajustes (`ajustes.notificaciones.*`). Falta el aviso «2 días antes de cada envío» y «según anticipación de cada pedido»: llegan con envíos y pedidos (Fase 2).
- **Requisito de cuenta:** guardar el token y los ajustes necesita que exista `usuarios/{uid}` (lo crea la Function de cuentas). Una cuenta sin ese documento ve el aviso y el botón queda bloqueado.
- **iPhone:** las notificaciones solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4+).
- **Indicador de sincronización.** Antes perdía el conteo al recargar sin conexión. Ahora detecta cambios en cola de una sesión anterior con `waitForPendingWrites` y muestra «cambios por sincronizar» (sin número, que ya no se conoce).
- **Verificado en emulador:** apertura de la app y de pantallas sin conexión; cambio hecho sin conexión llega al servidor ~0,4 s tras reconectar; la Function (franjas, dedupe, tokens inválidos, domingos y feriados). **No verificado:** entrega real de push (necesita VAPID y un navegador real).
- **Intermitencia sin explicar.** En pruebas automatizadas de navegación completa sin conexión hacia `/agenda/` justo después de un cambio offline, ~5 de 17 corridas no mostraron el calendario (en una la página terminó en `/hoy/`). Las últimas 6 corridas seguidas pasaron. Abrir la app sin conexión (recarga de `/hoy/`) pasó siempre. Hipótesis: relevo del «líder» multi-pestaña de Firestore tras una recarga completa sin red. Pendiente de investigar con un dispositivo real.
