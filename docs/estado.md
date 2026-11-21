# Estado del proyecto y pendientes

Última actualización: **2026-11-20** (noche, después de fusionar los PR 10 y 11). Lo mantiene quien cierre cada sesión de trabajo.
Qué construir: `docs/PRD.md`. Cómo trabajar: `CLAUDE.md`. Por qué se decidió cada cosa: `docs/decisiones.md`.

## Dónde estamos

- **Pendiente: feedback de las pruebas de usuario (capa 8)** de la persona usuaria con la app en producción (Hoy, Agenda → Pedidos y envíos, Reportes, Ajustes, importación de existencias y de lotes, Inventario → Vencimientos con sus pestañas y exportación). Lo hará ella y enviará sus comentarios; **corregir lo que reporte es lo primero de la próxima sesión**. Ya se corrigió en pruebas reales: el «Cargando…» infinito de Vencimientos sin cargas de consumos (PR 16), las 13 «filas dudosas» y el aviso de lotes en dos filas (PR 14 y 15).
- **`main` incluye hasta el PR 11** y está desplegado en producción por GitHub Actions: Fase 3 (registros), Chango IA (PR 9), **pedidos y envíos a puestos** (PR 10) y **Vencimientos completo** (PR 11).
- **Ningún PR abierto.**
- **Las pantallas de los PR 10 y 11 nunca se probaron en el navegador** (solo tipos, lint, build, pruebas unitarias y pruebas contra el emulador de Firestore). Es lo primero que conviene hacer: abrir Hoy, Agenda → Pedidos y envíos, Reportes, Ajustes, la importación del PDF de lotes y Inventario → Vencimientos, en celular (360 px) y en PC.
- La Function programada ahora lee `tiposPedido`, `puestos`, `seguimientos`, `lotes`, `existencias` y `consumos` a las 7:00 (≈1 600 lecturas diarias por cuenta, dentro de la cuota gratuita).

## Construido

| Área | Estado |
| --- | --- |
| Base: splash, login, PWA, offline, indicador de sincronización | Hecho |
| SuperAdmin: cuentas, contraseñas generadas, módulos del 772 (solo desde `/admin`) | Hecho |
| Importación de PDF, catálogo, consolidado, bajos y agotados (con exportar PDF/Excel) | Hecho |
| Riesgo de agotamiento (A3 y A4), margen editable | Hecho |
| Tareas y agenda (únicas y recurrentes, calendario), notificaciones push 7:00 / 12:00 / por hora | Hecho |
| Ajustes: feriados, regla de UD (`CN = 100`), notificaciones | Hecho |
| Dañados, preconteo, traslados (orden SAP), vencidos (a mano), resumen mensual PDF/Excel | Hecho |
| Chango IA (solo consulta; cascada Flash → Flash-Lite; tope de 40 preguntas por día) | Hecho |
| **Pedidos y envíos a puestos (M4 y M5)**, con avisos, feriados al día hábil anterior y secciones en el resumen mensual | Hecho (PR 10) |
| **Lotes y vencimientos:** lector del PDF real, revisión de cambios, guardado, pantalla de Vencimientos, alertas A1/A2 con umbrales editables, gestionar lotes, vencidos automáticos, proyección entre cargas, detalle de cambios e historial, tarea del tercer jueves, aviso push, exportar a PDF/Excel y Chango IA con lotes | Hecho (PR 11) |
| App Check fase 1 (el cliente envía tokens, sin exigirlos) | Hecho |

### Calendario de envíos y pedidos (confirmado el 2026-11-20)

R lunes y último jueves del mes · C martes · V, Z y pedido semanal 772 miércoles · pedido de sueros jueves. Anticipación en **días hábiles**: envíos 2, pedidos 1 (editable). Feriado → día hábil anterior («por el momento»).

## Pendientes

### Por confirmar con la persona usuaria
- Estantes, tarimas y filas del 771 (para el mapa de ubicaciones).
- PDF real de **consumos** (productos en despacho del 771) para el riesgo con datos reales. El de **lotes ya llegó** (`Rpt_VenceBodega`, 20/11/2026).
- Lista completa de UD y su factor (solo `CN = 100` precargado; la tabla es editable).
- Plan **Blaze** de Firebase: confirmar que está aceptado (Functions y Chango ya lo necesitan).
- Si se cuenta también **por lote** en el conteo físico, y qué hacer con productos contados que no estén en SIFA (`CLAUDE.md` §13).
- Días de los otros pedidos del RF-4.1: rayos X, odontología, laboratorio, vacunas, psicotrópicos, bajos (hoy no se precargan; se agregan a mano).
- Si «pedidos tramitados» debe incluir también algo propio del 772 (se entendió como: el 772 ve la sección si el 771 le habilita los módulos).

### Despliegue y seguridad (hacerlo la persona usuaria)
- Crear el secreto `GEMINI_API_KEY` (Chango) si aún no existe: sin él el despliegue de Functions falla.
- Activar **una vez** las políticas TTL de Firestore: `avisosEnviados`, `changoIA` (90 días) y `changoUso` (3 días). Comandos en `docs/despliegue.md`.
- Restringir la API key web a los dominios de Hosting y `localhost`.
- **App Check fase 2** (`enforceAppCheck`): solo tras revisar Firebase Console → App Check → Métricas y con visto bueno explícito.

### Código pendiente
- **Vencimientos:** completo (umbrales editables, aviso push, exportar a PDF/Excel, Chango con lotes y aviso de ingresos sin sumar). Queda que la proyección sume ingresos, imposible sin los lotes que entraron: el reporte real los trae.
- Probar en el navegador Ajustes (umbrales), la importación del PDF de lotes, la pantalla de Vencimientos y su exportación (solo hay pruebas unitarias, del PDF real, de reglas y de la Function en emulador).
- **Ubicaciones (M6)**: texto libre con varias ubicaciones vigentes (RF-6.7), reubicación del mes (RF-6.8), mapa con QR, y Chango que propone y la persona confirma (RF-6.9, primera acción de Chango).
- **Conteo físico contra SIFA** (`CLAUDE.md` §13, fuera del PRD): se construye después del consolidado de Inventario.
- Reporte PDF/Excel «Bajos y riesgo» (PRD §7).
- **Elegir qué hacer con el archivo al importar** (cargar existencias, cargar lotes, actualizar consumos…): hoy Stocky detecta el tipo de reporte por su encabezado; la persona usuaria pidió poder elegirlo (idea para más adelante).
- Aviso **push** cuando aparezca una diferencia nueva entre lotes y existencias (se descartó por ahora: solo pantalla y chip).
- Alerta **A8** (reporte desactualizado, más de 8 días sin consumos).
- **Alta manual de un agotado** (RF-3.4).
- Pantalla para que el **771 habilite módulos al 772** y navegación del 772 con esos módulos (la callable ya existe; la UI solo está en `/admin`).
- Resumen mensual automático del último día hábil (requiere Function programada).
- Chango IA aún no conoce la agenda de pedidos y envíos ni las ubicaciones (su contexto dice que no están disponibles); sí conoce lotes y vencimientos.
- Editar un dañado, un traslado o una entrega ya guardados; cantidades recibidas distintas de las enviadas; recordatorio de entregas sin recibir.

### Fase 5 (mejoras)
Acciones por voz en Chango IA, carga mensual de consumos, más funciones para el 772.

## Cómo probar sin tocar producción

- Antes de dar algo por terminado: `npm run lint`, `npm run test`, `npm run build` y `npm --prefix functions run build`.
- **Emulador de Firestore** (hay Firebase CLI y Java instalados): `firebase emulators:start --only firestore --project stocky-bbda4`. Para reglas se puede hablar por REST con un token sin firma (`alg: none`, con `role` y `unidad` como claims); para la Function programada, importar `functions/lib/tick.js` con `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. Limpiar datos: `DELETE http://127.0.0.1:8080/emulator/v1/projects/stocky-bbda4/databases/(default)/documents`. Para detenerlo, terminar solo el proceso que escucha en el puerto 8080 (no todos los `java`).
- Los PDF reales **no están en el repositorio**: para verificar los lectores, `STOCKY_PDF_DIR=/carpeta npm run test` con `rpt_vencebodega.pdf` y `rpt_existenciasdespacho20112026.pdf` dentro.
- Los scripts de prueba contra emulador son desechables y van fuera del repositorio (no hay dependencia de pruebas de reglas; agregarla requiere justificarla).
- `scripts/copiar-dominio.mjs` copia a `functions/src/dominio/` la lógica pura que usa la Function; si un archivo nuevo de `lib/domain` lo necesita, agregarlo a su lista.

## Para la próxima sesión

1. Si la persona usuaria ya probó la app: corregir lo que haya encontrado en las pantallas de pedidos y envíos y de Vencimientos.
2. Según lo que llegue: un PDF de **consumos** → riesgo con datos reales; nombres de estantes → Ubicaciones; si no, tomar un pendiente de código pequeño (A8, alta manual de agotado, pantalla del 771 para habilitar módulos al 772, reporte «Bajos y riesgo»).
3. Antes de abrir un PR nuevo: partir de `main` actualizado (`git pull`), y si la rama queda apilada sobre otra que se fusiona con squash, rebasar con `git rebase --onto origin/main <último commit de la rama base>`.
