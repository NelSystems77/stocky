# Decisiones de diseño

Decisiones tomadas donde el PRD era ambiguo. Revisar y corregir si no coinciden con la operación real.

## 2026-11-15 · Fase 1

- **Cobertura y próximo ingreso en días hábiles.** El consumo diario se calcula sobre días hábiles (PRD §6), así que la cobertura queda en días hábiles. Para compararla con el próximo ingreso se usan los días hábiles desde mañana hasta el segundo sábado (`diasHabilesAlIngreso`), no los días calendario.
- **Fechas como `YYYY-MM-DD`.** La lógica de dominio usa fechas civiles de Costa Rica (UTC−6, sin horario de verano) para evitar errores de zona. Se convierten a `Timestamp` solo al guardar en Firestore.
- **Recurrencias fuera de calendario.** Semanales, quincenales y por día de semana que caen en feriado se omiten; las mensuales se corren al siguiente día laboral del mes. Las tareas únicas respetan la fecha elegida.
- **Códigos sin guiones.** Un código de 9 dígitos sin guiones es ambiguo (`X-XX-XX-XXXX` y `XXX-XX-XXXX` tienen 9 dígitos), así que no se reconstruye; se rechaza.
- **Zona horaria sin `date-fns-tz`.** No está en la tabla del stack; se usa `Intl.DateTimeFormat` con `America/Costa_Rica`.
