# Stocky — PRD (NelSystems)

Nov 15, 2026 · @Nelson · **actualizado el 2026-11-21** con lo construido y decidido desde entonces (módulos M11 y M12, requisitos nuevos y el estado de las fases)

> Copia del PRD que vivía en Claude Docs (https://claude.ai/artifact/4bywc9xohxQk26aLNApu3x); **desde el 2026-11-21 esta copia del repositorio es la vigente** y la del documento original puede ir atrás. Es la fuente de verdad de **qué** construir; `CLAUDE.md` define **cómo**. Se omitió el bloque con la configuración web de Firebase: va en `.env.local` (ver `CLAUDE.md` §3).

## 1. Resumen y objetivos

Stocky es una PWA de NelSystems que concentra en un solo lugar los pendientes del Almacén Local de medicamentos (771) del Área de Salud de Coronado: alertas de vencimiento y de agotamiento, agenda de pedidos y envíos, ubicaciones, tareas diarias, preconteo, traslados y dañados, con un resumen mensual de labores listo en PDF. A pedido de la persona usuaria se sumaron el conteo físico contra SIFA y el pedido al ALDI (propuesta de reposición).

**Problema.** La persona encargada del 771 lleva sola decenas de tareas con distinta periodicidad y la información vive repartida entre reportes PDF de SIFA, órdenes SAP y la memoria. Eso provoca medicamentos vencidos por baja rotación, agotados evitables, pedidos o envíos olvidados y horas perdidas buscando productos que cambian de lugar cada mes.

**Objetivos medibles**

1. Cero medicamentos perdidos por vencimiento que la app pudo anticipar (alerta por rotación y a 3 meses).
2. Reducir agotados evitables: todo producto en riesgo se ve antes de que llegue a existencia cero.
3. Ningún pedido, envío a puesto ni traslado pendiente olvidado.
4. Encontrar cualquier producto del 771 en menos de 30 segundos.
5. Generar el resumen mensual de labores con un toque.

**Fuera de alcance.** Actas de vencidos y dañados (trámite en SIFA), datos de pacientes y cualquier escritura en SIFA o SAP. Stocky solo lee reportes y recuerda trámites. **Cantidades de pedido:** salvo una excepción, no las calcula; la excepción (2026-11-21) es el **pedido al ALDI (M12)**, que es una **propuesta** que la persona revisa y ajusta, y el pedido se tramita en SIFA/SAP.

## 2. Usuarios, roles y lugares

Stocky se diseña para la persona encargada del 771; el 772 usa un subconjunto que el 771 puede ampliar.

| Rol | Quién | Qué hace | Módulos |
| --- | --- | --- | --- |
| SuperAdmin NelSystems | admin@nelsystems.com | Crea y desactiva cuentas, restablece contraseñas, ve uso general | Panel de administración |
| Usuario 771 (principal) | Encargado del Almacén Local | Opera todo el almacén y habilita funciones al 772 | Todos |
| Usuario 772 (secundario) | Farmacia | Gestiona sus propios pendientes | Tareas, agotados, vencimientos, reportes; otros si el 771 los habilita |

**Rol SuperAdmin.** La cuenta admin@nelsystems.com recibe el rol SuperAdmin mediante un custom claim de Firebase Auth (`role: "superadmin"`), asignado una sola vez con un script del Admin SDK. Las cuentas 771 y 772 llevan `role: "usuario"` y su `unidad`. Las reglas de Firestore validan el claim: solo el SuperAdmin crea, desactiva o restablece cuentas y lee el panel de administración; ningún usuario puede asignarse roles.

**Aislamiento de datos.** Cada usuario ve solo sus datos (reportes, tareas, registros). El catálogo de códigos es compartido.

**Lugares**

| Código | Qué es | Rol en Stocky |
| --- | --- | --- |
| 771 | Almacén Local de medicamentos | Usuario principal |
| 772 | Farmacia | Usuario secundario; pedido semanal propio |
| R | EBAIS / puesto | Recibe envíos del 771 los lunes |
| C | EBAIS / puesto | Recibe envíos del 771 los martes |
| Z | EBAIS / puesto | Recibe envíos del 771 los miércoles |
| V | EBAIS / puesto | Día de envío por confirmar |

Los días de envío son configurables, porque aún falta confirmarlos.

**Calendario laboral.** Lunes a viernes, más el segundo sábado de cada mes (ingreso de mercadería). Recordatorios y tareas recurrentes no se programan en otros días; los feriados se marcan en ajustes.

## 3. Requisitos técnicos

Stocky corre en Firebase: es la única de las dos opciones que sincroniza datos sin conexión y envía notificaciones programadas. GitHub queda como repositorio del código.

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Front-end | Next.js (App Router) + React + TypeScript, exportado como sitio estático; PWA instalable | Stack estándar NelSystems (como QR Inventarios); funciona en Windows (Edge/Chrome), Android e iPhone |
| Hosting | Firebase Hosting | HTTPS y despliegue con un comando |
| Acceso | Firebase Auth, correo y contraseña | Como en los demás proyectos NelSystems |
| Datos | Cloud Firestore con persistencia offline (IndexedDB) | Trabaja sin internet y sincroniza solo al reconectar |
| Avisos | Firebase Cloud Messaging (web push) | Resúmenes de 7:00 a. m. y 12:00 m. d. y recordatorios |
| Tareas programadas | Cloud Functions con horario (zona America/Costa_Rica) | Disparan resúmenes y alertas aunque la app esté cerrada |
| Lectura de PDF | pdf.js en el navegador | Los datos no salen del dispositivo para leerse |
| IA | Gemini API (plan gratuito) llamada desde una Cloud Function | La clave no queda expuesta en el navegador |
| Reportes | jsPDF y SheetJS en el navegador | PDF y Excel sin servidor |

**Proyecto Firebase**

| Dato | Valor |
| --- | --- |
| Nombre del proyecto | Stocky |
| ID del proyecto | `stocky-bbda4` |
| Número del proyecto | 316940592609 |
| Hosting (URL prevista) | stocky-bbda4.web.app |

La configuración web de la app es pública por diseño: viaja dentro de la app y no da acceso por sí sola. La protección real está en las reglas de Firestore y Storage. Como refuerzo: restringir la API key a los dominios `stocky-bbda4.web.app`, `stocky-bbda4.firebaseapp.com` y `localhost` en Google Cloud Console, y activar App Check. La API key de Gemini **no** va aquí: vive como secreto de Cloud Functions.

**Requisitos no funcionales**

- **Offline primero:** toda pantalla abre y registra sin conexión; un indicador muestra "sin conexión, X cambios por sincronizar".
- **Responsiva:** desde 360 px (celular) hasta escritorio; en PC usa menú lateral, en celular barra inferior.
- **Rendimiento:** pantalla de inicio en menos de 2 s ya instalada; importar un reporte de 40 páginas en menos de 10 s.
- **Seguridad:** reglas de Firestore por usuario; el SuperAdmin es el único que gestiona cuentas.
- **Respaldo:** exportación completa a Excel desde ajustes.

**Advertencias a decidir**

- Las Cloud Functions programadas exigen el plan Blaze de Firebase (pago por uso, con cuota gratuita amplia). Con dos usuarios el costo esperado es cero, pero pide registrar una tarjeta.
- En iPhone las notificaciones solo funcionan con la PWA instalada en la pantalla de inicio (iOS 16.4 o superior).
- Si algún reporte llega escaneado como imagen y no como PDF de texto, hace falta OCR, que es más lento y menos preciso. El reporte de muestra parece de texto (Crystal Reports), pero hay que confirmarlo con el archivo real.

## 4. Experiencia de usuario

Al abrir Stocky, la persona ve en una sola pantalla qué tiene que hacer hoy y qué está en riesgo; todo lo demás queda a un toque.

**Entrada**

1. **Splash NelSystems** (1–1,5 s): logo NelSystems y el nombre Stocky sobre fondo oscuro, con una animación breve mientras carga la base local.
2. **Login** con correo y contraseña, opción "recordarme" y "olvidé mi contraseña" (la restablece el SuperAdmin). La sesión persiste: el login aparece solo la primera vez o tras cerrar sesión.
3. **Inicio (Hoy).**

**Pantalla Hoy, de arriba abajo**

1. Saludo, fecha y estado de sincronización.
2. Franja de alertas con contadores tocables: agotados, bajos, vencimientos, diferencias entre lotes y existencias de SIFA, riesgo de agotamiento, traslados pendientes, pedidos o envíos próximos, **entregas de preconteo sin recibir** y **consumos sin actualizar** (alerta A8).
3. **Tareas de hoy** con check grande (temperatura AM y PM, preconteo, envío del día), ordenadas por hora y prioridad.
4. **Pendientes de días anteriores**, cada uno con acciones rápidas: hecho, posponer, descartar.
5. **Próximos pedidos y envíos** (siguientes 7 días).
6. **Vencimientos críticos** (los 5 más urgentes).
7. Botón flotante **Chango IA** siempre visible, abajo a la derecha.

**Navegación**

| Celular (barra inferior) | PC (menú lateral) |
| --- | --- |
| Hoy | Hoy |
| Inventario (consolidado, vencimientos, riesgo, agotados, conteo físico, pedido al ALDI, ubicaciones) | Inventario, con las mismas subsecciones |
| Agenda (tareas, pedidos, envíos, calendario) | Agenda |
| Registros (preconteo, traslados, vencidos, dañados; la farmacia 772 solo ve lo que el 771 le habilite) | Registros |
| Más (reportes, importar, ajustes) | Reportes, Importar, Ajustes |

**Principios de experiencia**

- **Registrar en 3 toques o menos:** preconteo, dañado o traslado se crean desde un botón "+" con el producto buscado por código o nombre.
- **Buscador global** (lupa arriba): código o nombre, devuelve producto, existencia, lotes y ubicación.
- **Deshacer** en vez de pedir confirmación para acciones simples (check, posponer).
- **Gestos en celular:** deslizar a la derecha completa, a la izquierda pospone.
- **Estados vacíos útiles:** si no hay reporte cargado, la pantalla invita a importarlo.
- **Modo oscuro** por defecto, con claro disponible.

## 5. Módulos funcionales

Doce módulos alimentados por un mismo consolidado por código; cada requisito lleva un identificador para seguirlo en el desarrollo.

### M1. Importación de reportes y catálogo

- **RF-1.1** Importar PDF de SIFA arrastrando el archivo (PC) o eligiéndolo (celular).
- **RF-1.2** Detectar el tipo de reporte por su encabezado (por ejemplo `Rpt_ExistenciasDespacho`, despacho 771 o 772) y sus columnas, aunque varíen: CODIGO, UD, DESCRIPCION, CUOTA, Cuota Mínima, EXISTENCIA, lote, vencimiento, consumo.
- **RF-1.3** Reconocer códigos con formato X-XX-XX-XXXX o XXX-XX-XXXX (ejemplo: 110-16-0010).
- **RF-1.4** Convertir unidades según UD: CN = cientos (1.5 = 150 unidades); FC, TR, tubo, ampolla, frasco se guardan como unidad propia. Tabla de UD editable.
- **RF-1.5** Catálogo base: los códigos de aprendiendoCodigos. Un código nuevo en un reporte se agrega solo y se marca "nuevo".
- **RF-1.6** Vista previa antes de guardar: filas leídas, códigos nuevos, filas dudosas para revisar.
- **RF-1.7** Consolidado por código y por usuario: cuota, cuota mínima, existencia, lotes con vencimiento, consumo e historial de importaciones.
- **RF-1.9** Historial de ingresos por lote: cada vez que entra mercadería (normalmente el segundo sábado) se conserva, por producto, el lote, su vencimiento, la cantidad que ingresó y la fecha de ingreso. Los ingresos de meses anteriores no se borran al cargar un reporte nuevo: un producto puede tener varios lotes vivos de ingresos distintos, y el consumo se asigna primero a lo que vence antes. Cada ingreso nuevo se suma al historial, aunque el lote ya exista con otro ingreso.
- **RF-1.10** Elegir qué reporte se sube: *Detectar solo* (por defecto), existencias de despacho, productos en despacho (consumos) o lotes y vencimientos. Si la persona elige un tipo y el PDF es de otro, no se guarda nada y se le avisa; un PDF no reconocido nunca pasa.
- **RF-1.8** Ciclo de reportes: el reporte de existencias con lotes y vencimientos se carga **cada tercer jueves del mes** (configurable). **15 días después** (o el siguiente día laborable) Stocky recuerda cargar un reporte de existencias para ajustar lo proyectado (RF-2.6). Los consumos se siguen cargando según su recordatorio propio.

### M2. Vencimientos

- **RF-2.1** Lista de lotes ordenada por urgencia, con código, descripción, lote, vencimiento, existencia del lote y días de cobertura.
- **RF-2.2** Alerta por rotación: el lote no se consumirá antes de vencer (regla A1, sección 6), con sugerencia de traslado.
- **RF-2.3** Alerta fija 3 meses antes del vencimiento (regla A2).
- **RF-2.4** Marcar un lote como gestionado (trasladado, consumido, dado de baja en SIFA) para que deje de alertar.
- **RF-2.6** Proyección por lote: entre un reporte de lotes y el siguiente, Stocky proyecta la cantidad disponible de cada lote restando el consumo diario promedio, consumiendo primero el lote que vence antes. Al cargar el reporte de existencias de los 15 días, la proyección se ajusta a la existencia real (la diferencia se descuenta de los lotes que vencen antes) y se reevalúa el riesgo de vencimiento (A1, A2) de cada producto con lo ya ajustado. El tercer jueves el reporte de lotes reemplaza la proyección por lo real.
- **RF-2.5** Registro de vencidos: lote que llegó a su fecha de vencimiento (o se dio de baja por vencido), con fecha, producto, lote, cantidad y observaciones. Se llena de dos formas: automáticamente desde el reporte de lotes y vencimientos (lote cuya fecha ya pasó y que aún tiene existencia) y a mano. Alimenta el resumen mensual de labores (sección «Vencidos»). El acta sigue haciéndose en SIFA. **Meta del módulo: cero vencidos**; este registro existe para medir cuándo la prevención (A1, A2) falló.

### M3. Riesgo de agotamiento, bajos y agotados

- **RF-3.1** Semáforo de riesgo por producto: crítico, riesgo, bajo (reglas A3 a A5).
- **RF-3.2** Lista de bajos (existencia menor que cuota mínima) como apoyo al pedido de bajos, exportable.
- **RF-3.3** Agotados detectados: cuota mayor que 0 y existencia 0 se proponen como agotados; el usuario confirma con un toque.
- **RF-3.4** Registro de agotado: fecha de agotamiento, fecha de ingreso (al reabastecerse se cierra solo con el siguiente reporte), observaciones. Además de confirmar los detectados, se puede **dar de alta a mano** (producto, fecha de agotamiento no futura y observación; no se permite si el producto ya tiene un agotado abierto).
- **RF-3.5** Reporte de agotados por semana, mes o período personalizado.

### M4. Agenda de pedidos

- **RF-4.1** Tipos de pedido precargados: EBAIS (C, V, R, Z), sueros, rayos X, odontología, laboratorio, vacunas, psicotrópicos y estupefacientes, bajos, semanal 772.
- **RF-4.2** El usuario agrega, edita o pausa tipos y define periodicidad (semanal, quincenal, mensual, día del mes o día de la semana) y anticipación del aviso.
- **RF-4.3** Cada pedido genera una tarea "Poner en trámite" con estados: pendiente, en trámite, enviado. No maneja cantidades.

### M5. Envíos a puestos (solo 771)

- **RF-5.1** Calendario de envíos por puesto: R lunes, C martes, Z miércoles, V por definir (configurable).
- **RF-5.2** Recordatorio 2 días antes ("Preparar envío a C, sale el martes") y check el día del envío.

### M6. Ubicaciones (solo 771)

- **RF-6.1** Mapa del almacén: espacios físicos fijos (estante de madera espacio N, tarima N fila N, sobre tarima N) dibujados como cuadrícula tocable.
- **RF-6.2** Cada espacio tiene un QR imprimible (hoja de etiquetas desde la app).
- **RF-6.3** Asignar contenido: escanear el QR del espacio, luego buscar o escanear productos y confirmar. Un producto puede estar en varios espacios.
- **RF-6.4** Sesión "Reubicación del mes" tras el ingreso del segundo sábado: lista de productos del ingreso, barra de avance de ubicados y recordatorio hasta completarla.
- **RF-6.5** Estantería con lugar fijo por producto; tarimas con contenido dinámico, cambiable cada mes o semana.
- **RF-6.6** Historial de ubicaciones con fecha; el buscador muestra la ubicación actual.
- **RF-6.7** Ubicación en texto libre (disponible antes del mapa con QR): la persona registra, por producto, el lugar como lo dice («Mueble de madera espacio 8», «Tarima 3 fila 4»). Un producto puede tener **varias ubicaciones vigentes a la vez**. Una ubicación sigue vigente (`hasta` vacío) hasta que el producto se mueva o se retire, así que **lo que no cambia se conserva sin volver a escribirlo**. Hay un formulario manual que funciona sin conexión.
- **RF-6.8** Actualización mensual: tras el ingreso del segundo sábado, «Reubicación del mes» (RF-6.4) muestra qué ubicaciones siguen vigentes y cuáles conviene confirmar o cambiar (por ejemplo, las que no se han confirmado en el mes). Cada ubicación guarda la fecha en que se confirmó por última vez.
- **RF-6.9** Chango IA registra ubicaciones: la persona le escribe o dicta una lista («Mueble de madera espacio 8 Aripiprazol, tarima 9 tercera fila Protón…»); Chango la convierte en una tabla de **propuestas** (producto del catálogo, ubicación) que la persona revisa y **confirma antes de guardar**. Empareja los nombres con el catálogo, corrige errores de escritura y, ante un nombre ambiguo, pregunta cuál es; nunca adivina. Lo que se guarda lo escribe la app con la sesión de la persona (no la Function). Es la primera acción de Chango IA (§8).

### M7. Tareas y agenda diaria

- **RF-7.1** Tareas únicas y recurrentes (diaria, días específicos, semanal, mensual, segundo sábado), con hora, prioridad (alta, media, baja) y notas.
- **RF-7.2** Precargadas: temperatura AM y PM (solo check), carga del reporte de lotes el tercer jueves y de existencias 15 días después, preconteo L-Mi-J-V, revisión diaria de traslados pendientes.
- **RF-7.3** Estados: pendiente, hecha, pospuesta (con nueva fecha), descartada (con motivo opcional).
- **RF-7.4** Lo no hecho pasa automáticamente a "pendientes de días anteriores".
- **RF-7.5** Vista calendario (día, semana, mes) con tareas, pedidos, envíos e ingresos.

### M8. Preconteo con damas voluntarias

- **RF-8.1** Registro por entrega (lunes, miércoles, jueves, viernes): fecha, producto, cantidad de cajas cerradas y unidades, presentación del preconteo (30, 60, 90 u otra indicada).
- **RF-8.2** Recepción: confirmar que volvió la totalidad precontada (o anotar diferencia).
- **RF-8.3** Totales mensuales por producto y presentación para el resumen de labores.
- **RF-8.4** Recordatorio de entregas sin recibir: contador **«Entregas sin recibir»** en Hoy (solo 771), con la antigüedad de la más vieja; sin aviso push (decisión del 2026-11-21).
- **RF-8.5** Editar una entrega ya guardada (con Deshacer); lo ya recibido no se toca.

### M9. Traslados

- **RF-9.1** Registro con número de orden SAP (empieza con 50000), tipo (envío o recepción), unidad de origen o destino (hospital, área de salud u otra), productos y cantidades.
- **RF-9.2** Estados: pendiente por llegar, recibido, enviado.
- **RF-9.3** Checklist de trámite (solo 771): registrado en SAP, aplicado en SIFA.
- **RF-9.4** Revisión diaria de pendientes como tarea, con énfasis los martes (recolección de encomiendas).
- **RF-9.5** Recepción con cantidades distintas: al marcar una **recepción** como recibida se elige «Llegó todo» o se anota cuánto llegó de cada producto; la diferencia es *llegó − esperado*, con signo `-` si faltó. Los totales del resumen mensual cuentan lo realmente recibido y las recepciones con diferencia. Los envíos no cambian.
- **RF-9.6** Editar un traslado ya guardado (con Deshacer): no se toca el trámite SAP/SIFA y se conserva lo ya recibido; si cambia el tipo y el estado ya no corresponde, vuelve a pendiente.

### M10. Dañados

- **RF-10.1** Registro: fecha, producto, lote, cantidad, motivo (quebrado, derramado, otro) y foto opcional. El acta se hace en SIFA.
- **RF-10.2** Totales mensuales para el resumen de labores.
- **RF-10.3** Editar un dañado ya guardado (con Deshacer); la foto se conserva o se reemplaza.

### M11. Conteo físico contra SIFA (solo 771; fuera del PRD original, 2026-11-21)

La persona cuenta físicamente los productos y Stocky compara lo contado con la existencia que dice SIFA, señalando las diferencias. Se llega desde Inventario.

- **RF-11.1** Alcance: todos los productos o una lista elegida buscando por código o nombre. (El filtro por ubicación llegará con M6; contar por lote queda pendiente.)
- **RF-11.2** **Foto de SIFA:** al iniciar se congela la existencia y la fecha de su reporte; importar otro reporte después no cambia un conteo ya iniciado.
- **RF-11.3** Captura en **unidades sueltas** (`20000`); Stocky la muestra en la UD del producto (`= 200 CN`, con decimales). Internamente todo va en unidades base.
- **RF-11.4** **Diferencia = contado − SIFA**, en la UD del producto: signo `-` si falta, `+` si sobra, `0` si coincide. Un producto sin contar no tiene diferencia (no cuenta como 0).
- **RF-11.5** Un producto contado que **no está en SIFA** se agrega con código, nombre y UD, con SIFA = 0 (todo lo contado sobra) y queda marcado.
- **RF-11.6** Las filas con diferencia van en **gris** (pantalla, PDF y Excel) con la diferencia en negrita; filtros «con diferencias» y «sin contar»; observación por producto.
- **RF-11.7** Funciona sin conexión. Exporta a PDF y Excel con Código, Descripción, UD, SIFA, Contado, Diferencia y Observación, encabezado con usuario, unidad, fecha del conteo y fecha del reporte de SIFA, y resumen al pie (contados, con diferencia, faltantes, sobrantes).

### M12. Pedido al ALDI (solo 771; fuera del PRD original, 2026-11-21)

Propuesta para reponer las existencias del 771 con el ALDI, cada mes o cada tantos días. **Es una propuesta:** la persona la revisa y ajusta, y el pedido se tramita en SIFA/SAP (Stocky no escribe en ellos). Se llega desde Inventario.

- **RF-12.1** Parámetros: **factor** de seguridad (1.25, 1.5, 2 u otro, entre 0 y 10; uno por pedido) y **período** que cubre (mensual = 30 días, 15 días u otro, de 1 a 90).
- **RF-12.2** **La cuota es el tope** (lo máximo permitido en existencia). Objetivo = lo menor entre la cuota y *(consumo del período × factor)*; a pedir = objetivo − existencia, **redondeado hacia arriba a la UD entera**; nunca negativo. El consumo del período = consumo diario (el mismo del riesgo de agotamiento) × días hábiles del período.
- **RF-12.3** Sin consumo cargado: se repone **hasta la cuota** y la línea se marca. Consumo cero: no se pide. Si consumo × factor pasa de la cuota, la línea se marca **«limitada por la cuota»** (posible cuota desactualizada).
- **RF-12.4** Entran los productos con cuota mayor que 0 y existencia en el reporte que tengan algo que reponer; una **lista desplegable** muestra los que no entraron y por qué (sin cuota, ya cubiertos, sin movimiento, sin existencia en el reporte), con su cuota y existencia.
- **RF-12.5** Cada cantidad se puede **ajustar a mano** (entero; 0 saca la línea) conservando lo sugerido; cambiar el factor o el período descarta los ajustes.
- **RF-12.6** **Historial** de pedidos guardados (fecha, factor, período, fecha del reporte de SIFA y líneas); no se editan, se exportan o se borran con Deshacer. Exporta a PDF y Excel.
- **RF-12.7** *(pendiente)* **Sugerir ajustar las cuotas** con unos 3 meses de consumos: Stocky solo sugiere, la cuota se cambia en SIFA. Las líneas «limitadas por la cuota» son la primera señal. *(Pendiente)* factor por producto y descontar lo que ya viene en camino.

## 6. Reglas de alertas y notificaciones

Todas las alertas salen de dos números por producto: el consumo diario promedio y los días que alcanza la existencia. Los umbrales son editables en ajustes.

**Cálculos base**

- Consumo diario promedio = consumo del período ÷ días hábiles del período (media móvil de las últimas 4 cargas semanales; luego mensual).
- Días de cobertura = existencia en unidades ÷ consumo diario promedio.
- Días al próximo ingreso = días hasta el segundo sábado del mes siguiente (o del actual si aún no pasó).
- Sin consumo registrado: no se calcula riesgo por rotación y la alerta lo indica ("sin datos de consumo").

| Regla | Condición | Nivel | Acción sugerida |
| --- | --- | --- | --- |
| A1 Vencimiento por rotación | Cobertura del lote (consumiendo lotes en orden de vencimiento) mayor que días para vencer | Alta | Trasladar el excedente a otra unidad o priorizar su despacho |
| A2 Vencimiento fijo | Faltan 90 días o menos para vencer | Media; alta a 30 días | Revisar y decidir |
| A3 Agotamiento crítico | Cobertura menor que días al próximo ingreso | Crítica | Gestionar pedido extraordinario o traslado |
| A4 Riesgo de agotamiento | Cobertura menor que días al próximo ingreso + 7 | Alta | Vigilar, considerar en pedido de bajos |
| A5 Bajo cuota mínima | Existencia menor que cuota mínima | Media | Incluir en lista de bajos |
| A6 Agotado detectado | Cuota mayor que 0 y existencia 0 | Crítica | Confirmar agotado |
| A7 Traslado pendiente | Traslado sin recibir | Diario | Revisar en la tarea diaria |
| A8 Reporte desactualizado | Más de 8 días (calendario) sin cargar consumos | Media | Cargar reporte (contador en Hoy; sin aviso push) |

**Notificaciones push**

| Cuándo | Contenido |
| --- | --- |
| 7:00 a. m., días laborales | Resumen del día: tareas de hoy, pendientes anteriores, alertas críticas, envíos y pedidos próximos |
| 12:00 m. d., días laborales | Lo que falta de hoy + temperatura PM |
| A la hora de cada tarea con hora | Recordatorio individual |
| 2 días antes de cada envío | Preparar envío al puesto |
| Según anticipación de cada pedido | Poner en trámite el pedido |
| Tercer jueves del mes, 7:00 a. m. | Cargar el reporte de existencias con lotes y vencimientos |
| 15 días después, 7:00 a. m. | Cargar reporte de existencias para ajustar la proyección de lotes |
| Lunes tras el ingreso | Completar la reubicación del mes |

No se envían avisos fuera del calendario laboral; cada tipo se puede silenciar en ajustes.

## 7. Reportes

El reporte estrella es el Resumen mensual de labores en PDF; los demás salen en PDF y Excel por el período que se elija. Encabezado de todos: logo Stocky by NelSystems, nombre del usuario, unidad (771 o 772) y período.

| Reporte | Período | Formato | Contenido |
| --- | --- | --- | --- |
| Resumen mensual de labores | Mes | PDF (y Excel con el detalle) | Secciones a elegir por el usuario (ver abajo): tareas hechas, pospuestas y descartadas; preconteo por producto y presentación; traslados enviados, recibidos y pendientes con orden SAP; dañados; vencidos; agotados del mes; envíos a puestos; pedidos tramitados |
| Tareas | Semana o mes | PDF y Excel | Cumplimiento por tarea y por día, incluida temperatura AM y PM |
| Agotados | Semana, mes o personalizado | PDF y Excel | Producto, fecha de agotamiento, fecha de ingreso, días agotado |
| Vencimientos | Al día | PDF y Excel | Lotes en alerta A1 y A2 con acción tomada |
| Bajos y riesgo | Al día | PDF y Excel | Productos en A3, A4 y A5 |
| Ubicaciones | Al día | PDF | Mapa y contenido por espacio, para imprimir y pegar |
| Conteo físico | Al día (por conteo) | PDF y Excel | Código, descripción, UD, SIFA, contado, diferencia y observación; filas con diferencia en gris |
| Pedido al ALDI | Al día (por pedido) | PDF y Excel | Código, descripción, UD, cuota, existencia, consumo del período, objetivo, a pedir y nota |

El resumen mensual se genera solo el último día hábil del mes y queda listo para descargar; Chango IA puede añadirle una nota de análisis opcional.

**Contenido elegible (RF-7.6).** Antes de generar el resumen mensual, el usuario elige qué secciones incluir con casillas: Tareas, Preconteo, Traslados, Dañados, Vencidos, Agotados, Envíos a puestos y Pedidos tramitados. Reglas:

- Todas vienen marcadas por defecto; la última elección se recuerda por usuario.
- Cada sección va en su propia página o bloque, con totales y detalle; una sección sin registros en el mes se muestra como «Sin registros» (no se omite en silencio) o se puede desmarcar.
- La misma selección vale para el PDF y para el Excel (una hoja por sección).
- El resumen automático del último día hábil usa la selección guardada.
- Las secciones de módulos que el usuario no tiene habilitados (p. ej. el 772) no aparecen.

**Entrega del archivo.** Los reportes se generan en el dispositivo. Al terminar quedan en pantalla **Guardar / Compartir** (menú del sistema, donde el navegador lo permita), **Abrir** y **Descargar**; en computadora además se descarga solo. (En Safari de iPhone una descarga que no sale de un toque directo se ignora, por eso los botones.)

## 8. Chango IA

Chango IA consulta, analiza y sugiere usando solo los datos cargados en Stocky; en esta versión no crea ni modifica registros.

**Acceso.** Botón flotante en todas las pantallas; abre un panel de chat (hoja inferior en celular, panel lateral en PC) con sugerencias rápidas.

**Ejemplos de uso**

- "¿Dónde está la amoxicilina 500?" → ubicación actual y existencia.
- "¿Qué se me vence en los próximos 3 meses?" → lista con lotes y cobertura.
- "¿Qué productos están en riesgo de agotarse antes del ingreso?" → críticos y en riesgo.
- "Resume mi mes" → análisis del resumen de labores.
- "¿Qué podría mejorar?" → patrones (tareas que siempre se posponen, productos que se agotan cada mes, lotes que suelen vencerse).

**Reglas de comportamiento**

- Responde solo con datos de Stocky; si no los tiene, lo dice ("no hay consumo cargado para ese producto").
- Cita la fuente interna: fecha del reporte o del registro.
- Sugiere, no decide: las recomendaciones se presentan como criterio para el usuario.
- Sin datos de pacientes en el contexto enviado.

**Funcionamiento.** La app arma un contexto compacto (alertas, consolidado resumido, tareas, registros del período) y lo envía a una Cloud Function que llama a Gemini.

**Cuota gratuita.** La función prueba primero Gemini Flash y, si se agota la cuota, pasa a Flash-Lite. Si ambas se agotan, Chango IA avisa que vuelve mañana y el resto de la app sigue igual. Se usa una sola API key; múltiples cuentas para multiplicar la cuota violan los términos de Google.

**Privacidad.** En el plan gratuito Google puede usar los datos enviados para mejorar sus productos; como solo viajan datos de medicamentos y operación, se considera aceptable.

**Primera acción: ubicaciones.** Chango IA propone ubicaciones a partir de una lista escrita y la persona las confirma antes de guardarlas (RF-6.9). Al preguntar «¿dónde está X?» responde con la ubicación vigente y la fecha en que se confirmó; si hay varias, las lista todas; si no hay, dice que no la tiene. El contexto de Chango incluirá las ubicaciones vigentes.

**Fase posterior.** Más acciones por voz o texto ("crea tarea", "registra dañado"), siempre con confirmación.

## 9. Modelo de datos

Firestore con un catálogo compartido y todo lo demás colgando de cada usuario, lo que hace simples las reglas de seguridad y el aislamiento 771/772.

| Colección | Ruta | Campos principales |
| --- | --- | --- |
| Catálogo | `catalogo/{codigo}` | descripcion, ud, factorUnidad, nuevo, creadoEn |
| Usuarios | `usuarios/{uid}` | nombre, unidad (771/772), modulosHabilitados, ajustes (umbrales, horarios, feriados) |
| Importaciones | `usuarios/{uid}/importaciones/{id}` | tipoReporte, fechaReporte, archivo, filas, codigosNuevos |
| Existencias | `usuarios/{uid}/existencias/{codigo}` | cuota, cuotaMinima, existencia, consumoDiario, cobertura, nivelRiesgo, actualizadoEn |
| Lotes | `usuarios/{uid}/lotes/{id}` | codigo, lote, vence, cantidad (existencia actual del lote), cantidadIngresada, fechaIngreso, coberturaLote, estado (activo, gestionado, vencido) |
| Consumos | `usuarios/{uid}/consumos/{id}` | codigo, periodo, cantidad |
| Agotados | `usuarios/{uid}/agotados/{id}` | codigo, fechaAgotado, fechaIngreso, origen (detectado o manual), notas |
| Espacios | `usuarios/{uid}/espacios/{id}` | tipo (estante, tarima, sobre tarima), nombre, fila, posicionMapa, qr |
| Ubicaciones | `usuarios/{uid}/ubicaciones/{id}` | codigo, lugar (texto libre) o espacioId (cuando exista el mapa), desde, hasta (vacío = vigente), confirmadaEn |
| Tareas | `usuarios/{uid}/tareas/{id}` | titulo, tipo, recurrencia, hora, prioridad, estado, fechaObjetivo, notas, motivoDescarte |
| Pedidos (tipos) | `usuarios/{uid}/tiposPedido/{id}` | nombre, periodicidad, anticipacion, activo |
| Envíos (puestos) | `usuarios/{uid}/puestos/{id}` | nombre (C, Z, V, R), diaEnvio, anticipacion |
| Preconteo | `usuarios/{uid}/preconteos/{id}` | fecha, codigo, cajas, unidades, presentacion, recibidoCompleto, diferencia |
| Traslados | `usuarios/{uid}/traslados/{id}` | ordenSAP, tipo, unidad, items [codigo, cantidad, recibida (opcional, solo recepciones)], estado, enSAP, enSIFA |
| Dañados | `usuarios/{uid}/danados/{id}` | fecha, codigo, lote, cantidad, motivo, fotoUrl |
| Chango IA | `usuarios/{uid}/chango/{id}` | pregunta, respuesta, modelo, fecha |
| Conteos físicos | `usuarios/{uid}/conteos/{id}` y `.../lineas/{codigo}` | fecha, fechaReporteSifa, alcance, **foto** de SIFA congelada (codigo → descripcion, ud, sifa); cada línea: contado (unidades base), observacion, fueraDeSifa. Solo 771; la foto no se edita |
| Pedidos al ALDI | `usuarios/{uid}/pedidosAldi/{id}` | fecha, fechaReporteSifa, factor, dias, lineas [codigo, descripcion, ud, cuota, existencia, consumo, objetivo, criterio, calculada, cantidad]. Solo 771; no se edita |

Los campos calculados (cobertura, nivelRiesgo) se recalculan en cada importación, para que la pantalla Hoy cargue sin hacer cálculos.

## 10. Guía visual

Modo oscuro inmersivo por defecto, con el color reservado para lo urgente: si algo brilla, requiere atención.

| Elemento | Propuesta |
| --- | --- |
| Fondo | Azul noche casi negro (#0B1220) con superficies elevadas (#121A2B, #1A2438) |
| Acento de marca | Turquesa farmacéutico (#2DD4BF) para botones principales y Chango IA |
| Crítico | Rojo coral (#F87171) |
| Riesgo | Ámbar (#FBBF24) |
| Bajo / informativo | Amarillo suave (#FDE68A) y azul (#60A5FA) |
| Correcto / hecho | Verde (#34D399) |
| Texto | Blanco hueso (#E5E7EB) y gris (#94A3B8) para secundario |
| Tipografía | Inter para interfaz; JetBrains Mono para códigos de producto (110-16-0010) |
| Forma | Tarjetas con esquinas de 16 px, efecto vidrio sutil en barras superiores |
| Movimiento | Transiciones de 150–250 ms; check con pequeña animación y vibración en celular |
| Modo claro | Disponible en ajustes, con la misma paleta semántica |

**Detalles de experiencia**

- Contadores de alertas como "chips" de color con número grande, tocables.
- Códigos de producto siempre en mono para leerlos sin error.
- Objetivos táctiles de al menos 44 px para uso con una mano en el almacén.
- Chango IA con identidad propia: ícono de mono estilizado original y burbuja turquesa.
- Splash con el logo NelSystems y "Stocky" apareciendo en degradado turquesa.

## 11. Pendientes por confirmar y fases

Estado al 2026-11-21: las fases 1 a 3 están construidas; las definiciones que siguen abiertas se marcan abajo.

**Por confirmar**

- [x] Día de envío a V y confirmación de R, C y Z (decidido el 2026-11-20: R lunes y último jueves, C martes, V y Z miércoles; ver `docs/decisiones.md`).
- [ ] Cantidad y nombres de estantes, tarimas y filas del 771, para dibujar el mapa.
- [x] PDF reales de **existencias** y de **lotes y vencimientos** (recibidos el 2026-11-20; los lectores están hechos y probados con ellos).
- [ ] PDF real de **consumos** («Productos en despacho»), para el riesgo y el pedido al ALDI con datos reales.
- [ ] Lista completa de códigos UD (CN, FC, TR, tubo, ampolla, frasco…) y su factor.
- [ ] Aceptar el plan Blaze de Firebase para notificaciones programadas y Chango IA (las Functions ya lo usan: confirmar).
- [ ] **Chango IA:** Google devuelve que el plan gratuito no está disponible para el proyecto de la clave (y el prepago está sin créditos). Decidir entre cargar un crédito pequeño o dejarlo apagado.
- [ ] **Pedido al ALDI:** qué hacer con los productos sin cuota (en la primera prueba, 568 de 1 039): revisar la lista de omitidos y decidir si se incluyen los que tienen consumo o los que están en 0.
- [ ] **Sugerir ajustar cuotas** (RF-12.7): diseñar con la persona usuaria cuánta diferencia entre cuota y consumo justifica sugerir y cómo se muestra.
- [x] Origen de «Vencidos» (RF-2.5): del reporte de lotes y vencimientos **y** a mano (decidido el 2026-11-16).

**Fases de desarrollo**

1. **Fase 1, base** *(hecha)*: splash, login, SuperAdmin, catálogo, importación de PDF, consolidado, pantalla Hoy, tareas y agenda con notificaciones, modo offline.
2. **Fase 2, alertas** *(hecha, con A8)*: vencimientos (A1, A2), riesgo y bajos (A3–A5), agotados, agenda de pedidos y envíos a puestos.
3. **Fase 3, registros** *(hecha; falta que el resumen mensual se genere solo el último día hábil)*: preconteo, traslados con orden SAP, dañados y reportes PDF/Excel con resumen mensual.
4. **Fase 4, almacén e IA** *(a medias: Chango IA está construido pero sin responder por la facturación de Google; el mapa de espacios con QR y la reubicación del mes están pendientes, a la espera de los estantes y tarimas del 771)*: mapa de espacios con QR, reubicación del mes y Chango IA.
5. **Fase 5, mejoras** *(pendiente)*: acciones por voz en Chango IA, paso a carga mensual de consumos, más funciones para el 772.

**Fuera de las fases originales, a pedido de la persona usuaria (2026-11-21):** conteo físico contra SIFA (M11) y pedido al ALDI (M12), ya construidos.
