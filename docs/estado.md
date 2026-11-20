# Estado del proyecto y pendientes

Última actualización: **2026-11-20** (tarde). Lo mantiene quien cierre cada sesión de trabajo.
Qué construir: `docs/PRD.md`. Cómo trabajar: `CLAUDE.md`. Por qué se decidió cada cosa: `docs/decisiones.md`.

## Dónde estamos

- **`main`** tiene hasta la Fase 3 (registros) y Chango IA (PR 9).
- **PR 10 abierto** (`fase-2-pedidos-envios`): pedidos y envíos a puestos, avisos de las 7:00, feriados trasladados al día hábil anterior y las secciones «Envíos a puestos» y «Pedidos tramitados» del resumen mensual. Auto-fix activado. **Falta revisar las pantallas nuevas en el navegador** (vista previa de Hosting, celular a 360 px): solo pasan tipos, lint, build y pruebas.
- Al fusionar el PR 10 el despliegue sube reglas y Functions; la Function programada ahora lee `tiposPedido`, `puestos` y `seguimientos`.

- **Rama `fase-2-vencimientos-lotes`** (apilada sobre el PR 10, sin PR todavía): lector del reporte de lotes y vencimientos con revisión de cambios antes de guardar. Ver `docs/decisiones.md` (2026-11-20, «Reporte de lotes y vencimientos»). Al fusionarse el PR 10 (squash), pasarla a `origin/main` con `git rebase --onto origin/main <último commit del PR 10>`.

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
| **Pedidos y envíos a puestos (M4 y M5)** | En el PR 10 |
| **Lotes y vencimientos: lector + revisión de cambios + guardado** (sin alertas ni pantalla de Vencimientos) | En la rama `fase-2-vencimientos-lotes` |
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
- **Vencimientos, lo que falta del M2** (el lector ya está): pantalla de lotes ordenada por urgencia (RF-2.1), alertas A1/A2, gestionar lotes (RF-2.4), vencidos automáticos (RF-2.5), proyección entre cargas (RF-2.6) y pasar la tarea y el aviso de «jueves» a «tercer jueves» y «+15 días» (RF-1.8). Los lotes ya se guardan en `usuarios/{uid}/lotes` con `noMedicamento` para dejar condones, etiquetas y bolsas fuera de las alertas.
- Guardar el **detalle** de cada cambio por carga de lotes (hoy solo el conteo en la importación).
- Probar la pantalla de importar con el PDF de lotes en el navegador (solo hay pruebas unitarias, del PDF real y de reglas).
- **Ubicaciones (M6)**: texto libre con varias ubicaciones vigentes (RF-6.7), reubicación del mes (RF-6.8), mapa con QR, y Chango que propone y la persona confirma (RF-6.9, primera acción de Chango).
- **Conteo físico contra SIFA** (`CLAUDE.md` §13, fuera del PRD): se construye después del consolidado de Inventario.
- Reporte PDF/Excel «Bajos y riesgo» (PRD §7).
- Alerta **A8** (reporte desactualizado, más de 8 días sin consumos).
- **Alta manual de un agotado** (RF-3.4).
- Pantalla para que el **771 habilite módulos al 772** y navegación del 772 con esos módulos (la callable ya existe; la UI solo está en `/admin`).
- Resumen mensual automático del último día hábil (requiere Function programada).
- Chango IA aún no conoce la agenda de pedidos y envíos (en `lib/domain/chango.ts` el contexto dice que no está disponible; actualizarlo).
- Editar un dañado, un traslado o una entrega ya guardados; cantidades recibidas distintas de las enviadas; recordatorio de entregas sin recibir.

### Fase 5 (mejoras)
Acciones por voz en Chango IA, carga mensual de consumos, más funciones para el 772.

## Cómo probar sin tocar producción

- Antes de dar algo por terminado: `npm run lint`, `npm run test`, `npm run build` y `npm --prefix functions run build`.
- **Emulador de Firestore** (hay Firebase CLI y Java instalados): `firebase emulators:start --only firestore --project stocky-bbda4`. Para reglas se puede hablar por REST con un token sin firma (`alg: none`, con `role` y `unidad` como claims); para la Function programada, importar `functions/lib/tick.js` con `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. Limpiar datos: `DELETE http://127.0.0.1:8080/emulator/v1/projects/stocky-bbda4/databases/(default)/documents`. Para detenerlo, terminar solo el proceso que escucha en el puerto 8080 (no todos los `java`).
- El PDF real de lotes **no está en el repositorio**: para verificar el lector, `STOCKY_PDF_DIR=/carpeta npm run test` con `rpt_vencebodega.pdf` dentro.
- Los scripts de prueba contra emulador son desechables y van fuera del repositorio (no hay dependencia de pruebas de reglas; agregarla requiere justificarla).
- `scripts/copiar-dominio.mjs` copia a `functions/src/dominio/` la lógica pura que usa la Function; si un archivo nuevo de `lib/domain` lo necesita, agregarlo a su lista.

## Para la próxima sesión

1. Revisar si el PR 10 se fusionó y qué comentó la revisión.
2. Abrir las pantallas de pedidos y envíos en la vista previa y corregir lo que falle.
3. Según lo que llegue de la persona usuaria: PDF de lotes → Vencimientos; nombres de estantes → Ubicaciones; si no, tomar un pendiente de código pequeño (A8, alta manual de agotado, pantalla del 771 para habilitar módulos).
