# Plan de implementación: UI editorial, reservas y Mercado Pago

## Resultado esperado

Entregar una portada editorial premium con reserva guiada de tres pasos y un backend de reservas que tolere duplicados, carreras, webhooks repetidos o fuera de orden y acreditaciones demoradas sin liberar silenciosamente una fecha cobrada.

## Fase 1: base verificable y dependencias

1. Actualizar Next.js y dependencias directas con correcciones de seguridad compatibles.
2. Incorporar un runner de pruebas y scripts de tipos, pruebas y auditoría.
3. Crear `.env.example` sin secretos y documentar variables obligatorias.
4. Agregar encabezados de seguridad compatibles con los recursos reales del sitio.
5. Verificar lint, TypeScript y build antes de continuar.

Archivos principales:

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `.gitignore`
- `.env.example`

## Fase 2: dominio de reservas y migraciones

1. Crear migraciones versionadas para:
   - índice único parcial de fechas activas;
   - expiración explícita del hold;
   - idempotencia de solicitudes;
   - estado de pago y revisión manual;
   - bandeja de eventos de Mercado Pago;
   - outbox de notificaciones;
   - rate limit distribuido.
2. Actualizar los tipos de Supabase.
3. Extraer funciones puras para fechas, estados de pago, expiración y decisiones monotónicas.
4. Validar fechas reales, mañana como mínimo y horizonte máximo configurable.
5. Agregar pruebas unitarias del dominio.

Archivos principales:

- `supabase/migrations/*`
- `src/lib/supabase.ts`
- `src/lib/validations.ts`
- `src/lib/reservas/*`
- `src/lib/**/*.test.ts`

## Fase 3: creación segura e idempotente de reservas

1. Compartir el esquema de entrada entre cliente y servidor.
2. Incorporar `bookingRequestId`, honeypot y rate limit.
3. Recuperar la misma reserva/preferencia ante reintentos.
4. Guardar el vencimiento y las URLs del checkout.
5. Excluir medios de acreditación incompatibles con el hold.
6. Definir vencimiento de preferencia coherente con la reserva.
7. Mantener la base como garantía final contra carreras.
8. Devolver errores estables sin detalles internos.

Archivos principales:

- `src/app/api/reservas/route.ts`
- `src/lib/mercado-pago.ts`
- `src/lib/rate-limit.ts`
- `src/lib/constants.ts`
- pruebas contractuales de la ruta

## Fase 4: webhook, reconciliación y notificaciones

1. Exigir secreto en entornos desplegados.
2. Verificar firma, timestamp e igualdad del recurso firmado y procesado.
3. Aceptar únicamente tópicos conocidos de Webhooks.
4. Consultar el pago y verificar moneda, importe, preferencia, vendedor y modo.
5. Aplicar transiciones condicionales:
   - un rechazo solo cancela una reserva pendiente;
   - una reserva confirmada no se degrada por otro intento;
   - reembolso y contracargo pasan a revisión;
   - una aprobación posterior a una cancelación queda marcada para resolución segura.
6. Registrar eventos e impedir efectos duplicados.
7. Encolar emails mediante outbox y procesarlos fuera del ACK.
8. Reconciliar pagos antes de cancelar holds vencidos.
9. Probar duplicados, concurrencia, orden invertido y aprobación tardía.

Archivos principales:

- `src/app/api/webhook/route.ts`
- `src/app/api/cron/limpiar-pendientes/route.ts`
- `src/app/api/cron/procesar-notificaciones/route.ts`
- `src/lib/mercado-pago.ts`
- `src/lib/email.ts`
- `vercel.json`
- pruebas de webhook y reconciliación

## Fase 5: sistema visual y portada

1. Reorganizar tokens, tipografía, botones, superficies y estados de foco.
2. Construir navegación accesible y hero editorial.
3. Agregar franja de información comercial.
4. Rediseñar servicios como una narrativa de experiencia.
5. Construir galería asimétrica con visor accesible.
6. Reordenar ubicación, preguntas frecuentes y footer.
7. Mantener únicamente fotografías y datos reales.
8. Dividir Server y Client Components para reducir JavaScript.

Archivos principales:

- `src/app/globals.css`
- `src/app/page.tsx`
- `src/components/ui/*`
- `src/components/layout/*`
- `src/components/sections/Hero.tsx`
- `src/components/sections/Servicios.tsx`
- `src/components/sections/Galeria.tsx`
- `src/components/sections/Ubicacion.tsx`
- `src/components/sections/PreguntasFrecuentes.tsx`
- `src/components/sections/Footer.tsx`

## Fase 6: reserva guiada y estados de pago

1. Convertir la reserva en tres pasos: fecha, datos y revisión.
2. Conservar estado al avanzar o retroceder.
3. Implementar carga, error con reintento y conflicto de disponibilidad.
4. Añadir navegación de teclado y semántica del calendario.
5. Mostrar resumen persistente y CTA móvil seguro.
6. Incorporar aceptación real de términos y política.
7. Rediseñar confirmado, pendiente y error con estado verificable.
8. Evitar exponer datos mediante una referencia de retorno reutilizable.

Archivos principales:

- `src/components/sections/reservas/*`
- `src/hooks/useCalendario.ts`
- `src/app/reserva/*`
- `src/app/api/reservas/estado/route.ts`
- páginas de términos y privacidad

## Fase 7: verificación y entrega

1. Ejecutar formato/check de diff, lint, TypeScript, pruebas y build.
2. Ejecutar `npm audit --omit=dev` y resolver o documentar cualquier hallazgo restante.
3. Levantar el build local y revisar 360, 768, 1024 y 1440 píxeles.
4. Probar teclado, menú, galería, calendario, errores y reducción de movimiento.
5. Confirmar que no haya overflow, contenido tapado ni contrastes insuficientes.
6. Preparar la matriz de sandbox que requiere staging HTTPS.
7. Documentar el bloqueo externo si Supabase o las credenciales de staging siguen sin estar disponibles.

## Orden de commits sugerido

1. `chore: actualizar dependencias y base de verificación`
2. `feat: versionar el dominio seguro de reservas`
3. `fix: endurecer Mercado Pago y reconciliación`
4. `feat: rediseñar la portada editorial`
5. `feat: implementar reserva guiada accesible`
6. `test: cubrir reservas, webhooks y regresión visual`

## Condiciones para producción

- Migraciones aplicadas y verificadas en staging.
- `SITE_URL` HTTPS público.
- Proyecto Supabase accesible y separado para pruebas.
- Secretos de webhook, cron y rate limit configurados.
- Credenciales de prueba usadas antes de credenciales productivas.
- Webhook configurado como Webhooks y no como IPN.
- Matriz sandbox completa sin pagos reales.
