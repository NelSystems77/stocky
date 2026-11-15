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
