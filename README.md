# La Ponderosa

Sitio público y sistema de reservas de **La Ponderosa**, una quinta de alquiler por día en José C. Paz, Buenos Aires. La experiencia combina una presentación editorial del lugar con un flujo guiado para elegir fecha, completar los datos y pagar una seña del 50% mediante Mercado Pago Checkout Pro.

Stack: **Next.js 16** (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4 · Supabase/PostgreSQL · Mercado Pago · Resend.

## Qué incluye

- UI responsive con navegación accesible, galería modal, calendario por teclado y formulario de reserva en tres pasos.
- Páginas de confirmación, pendiente y error que consultan un estado firmado; nunca confían en parámetros de retorno de Mercado Pago.
- Términos y privacidad, sitemap, robots, metadatos sociales y encabezados de seguridad.
- Holds de fecha atómicos, idempotencia de solicitud, rate limit distribuido e invariantes de pago en PostgreSQL.
- Webhook firmado con inbox durable, conciliación de pagos y contracargos, y outbox de emails con reintentos.
- Limpieza segura de holds: gracia posterior al vencimiento y dos búsquedas vacías separadas antes de liberar una fecha.

## Desarrollo local

Requiere Node.js `>=20.9`.

```bash
npm install
cp .env.example .env.local
npm run dev       # http://localhost:3000
```

Comandos de verificación:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check     # lint + tipos + tests + build
npm run audit:prod
```

La UI estática puede renderizar sin proveedores externos. La disponibilidad y el checkout fallan cerrados cuando falta una configuración segura.

## Variables de entorno

`.env.example` es el contrato completo. Para un deploy funcional se necesitan, como mínimo:

| Grupo | Variables | Propósito |
| --- | --- | --- |
| URL pública | `SITE_URL` | Origen HTTPS para retornos, webhook, metadata, sitemap y validación de `Origin`. |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Acceso administrativo sólo desde el servidor. La service role nunca se expone al navegador. |
| Mercado Pago | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_COLLECTOR_ID`, `MP_LIVE_MODE` | Identidad del vendedor, ambiente y autenticación de eventos. |
| Estado público | `RESERVA_STATUS_SECRET` | HMAC de las URLs acotadas de consulta/reintento. Usar al menos 32 bytes aleatorios. |
| Workers/abuso | `CRON_SECRET`, `RATE_LIMIT_SECRET` | Autenticación de crons y HMAC de señales de abuso. Usar al menos 32 bytes aleatorios. |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL` | Confirmaciones y alertas operativas. En deploy se validan antes de iniciar un checkout. |

Los nombres, valores opcionales y límites configurables están comentados en [.env.example](.env.example). Los archivos `.env*` permanecen ignorados, excepto ese ejemplo sin secretos.

## Base de datos

Antes de migrar una base existente, generar un backup. Aplicar en orden los archivos de `supabase/migrations/` con `supabase db push` en un proyecto enlazado o mediante el editor SQL de Supabase:

1. `20260814000000_reservas_baseline.sql`: baseline reproducible de `reservas`, RLS y grants.
2. `20260814010000_reservas_security_core.sql`: constraints, estados monotónicos, inbox, outbox y rate limit.
3. `20260814020000_mp_empty_reconciliation.sql`: doble conciliación vacía.
4. `20260814030000_reserva_pending_actor_limit.sql`: máximo atómico de dos holds pendientes por IP.
5. `20260814040000_reserva_reconciliation_schedule.sql`: agenda y backoff de conciliación por reserva.

La migración aborta deliberadamente si encuentra dos reservas activas para una misma fecha: esos datos deben resolverse de forma explícita antes de crear el índice único. Una reserva histórica `confirmada` sin ID de pago o `cancelada` con ID de pago no se clasifica automáticamente como cobrada o no cobrada; queda marcada para revisión y genera una alerta idempotente para el dueño.

Las cuatro tablas (`reservas`, `mp_webhook_events`, `email_outbox`, `api_rate_limits`) tienen RLS activo. `PUBLIC`, `anon` y `authenticated` no reciben permisos; la aplicación usa exclusivamente la service role en módulos `server-only`.

## Flujo de reservas y pagos

1. `GET /api/reservas` devuelve sólo fechas ocupadas y el horizonte habilitado.
2. `POST /api/reservas` exige JSON, valida origen y tamaño, normaliza los datos, consume límites independientes por IP y email, recalcula el precio y crea un hold idempotente.
3. El backend crea o recupera una preferencia expirable de Mercado Pago y liga reserva, preferencia, vendedor, ambiente, moneda y monto.
4. Mercado Pago redirige a `/reserva/{confirmada,error,pendiente}`. Esas páginas consultan `GET /api/reservas/estado` con un token HMAC; el retorno del navegador nunca confirma un pago.
5. `POST /api/webhook` verifica firma, antigüedad e igualdad exacta del recurso, preservando incluso IDs JSON mayores a `2^53`. El evento se persiste antes del ACK y se procesa de forma idempotente.
6. Una aprobación válida confirma la reserva. Reembolsos, contracargos, pagos tardíos e inconsistencias conservan la fecha segura y encolan una alerta `reserva_revision` sólo al dueño.
7. Los workers recuperan leases abandonadas, reintentan eventos/emails y concilian holds vencidos sin bloquear el resto del lote.

### Configuración de Mercado Pago

En **Tus integraciones → Webhooks**:

1. Configurar la URL HTTPS `https://tu-dominio/api/webhook?source_news=webhooks`.
2. Activar los eventos **Pagos** y **Chargebacks/Contracargos** para el ambiente correspondiente.
3. Copiar la clave secreta del webhook a `MP_WEBHOOK_SECRET`.
4. Usar el `collector_id` de la misma cuenta/ambiente que emitió `MP_ACCESS_TOKEN`.
5. Mantener `MP_LIVE_MODE=false` con credenciales y usuarios de prueba; cambiar token, collector y modo juntos al salir a producción.
6. Usar el simulador de Webhooks y luego completar una compra sandbox real desde una URL pública HTTPS.

Mercado Pago recomienda Webhooks porque permiten validar la firma de origen; IPN no ofrece esa garantía y está en proceso de descontinuación. Referencias: [notificaciones de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/notifications) y [configuración de pagos](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications).

## Workers y requisito de hosting

`vercel.json` agenda:

- `GET /api/cron/procesar-notificaciones` cada 5 minutos.
- `GET /api/cron/limpiar-pendientes` cada 15 minutos.

Ambos endpoints exigen `Authorization: Bearer <CRON_SECRET>` y fallan cerrados si el secreto no está configurado.

**El archivo actual requiere Vercel Pro o Enterprise.** Vercel Hobby sólo admite una ejecución diaria y rechaza durante el deploy expresiones más frecuentes. En Hobby hay que quitar el bloque `crons` de `vercel.json` y configurar un scheduler externo que respete esas frecuencias y envíe el mismo header `Authorization`. No reducir estos trabajos a una ejecución diaria: demoraría webhooks, emails y liberación de holds. Ver [límites de Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing) y [autenticación con `CRON_SECRET`](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Controles de seguridad relevantes

- CSP, HSTS, anti-framing, `nosniff`, permisos del navegador restringidos y referrer policy.
- Validación Zod estricta, honeypot, aceptación de términos, límite de cuerpo y rechazo de solicitudes cross-site.
- Hashes HMAC de IP/email; no se persisten esas señales en claro.
- Límites por IP y email, más tope atómico de holds. No existe un bucket global que un atacante pueda agotar para bloquear todas las ventas.
- RLS y grants cerrados, índice único de fecha activa y máquina de estados monotónica.
- Firma de Webhooks, timestamp, ID exacto, consulta server-to-server y validación de preferencia, vendedor, modo, ARS y monto.
- Inbox/outbox durables, claves idempotentes, fencing de leases y logs sin cuerpos de proveedor ni PII innecesaria.
- Gracia y doble búsqueda antes de cancelar; un pago pendiente o dudoso nunca libera automáticamente la fecha.
- El abuso distribuido sigue requiriendo defensa de borde: habilitar WAF/rate limiting del hosting y sumar Turnstile si el monitoreo muestra ataques coordinados.

## Límites conocidos no críticos

- La confirmación al cliente y al dueño comparte hoy una fila de outbox. Resend deduplica reintentos durante 24 horas; una falla parcial que dure más que esa ventana podría duplicar el correo ya entregado. Las alertas de revisión no tienen este riesgo porque poseen un único destinatario.
- Los emails fallidos se reintentan con backoff sin una cola dead-letter. Conviene agregar un máximo de intentos y una alarma externa cuando exista monitoreo operativo.
- Una instalación nueva recibe todas las constraints del baseline. Antes de actualizar una tabla legacy creada fuera de estas migraciones, auditar que también conserve sus checks históricos de estado, importes, cantidades y longitudes; `0100` agrega las nuevas invariantes, pero no puede asumir qué validaciones originales existían.

## Checklist de staging antes de producción

- [ ] Backup y migraciones aplicadas; sin fechas activas duplicadas, constraints legacy auditadas y revisiones históricas atendidas.
- [ ] Variables de entorno cargadas con secretos distintos y aleatorios; ninguna service role en variables `NEXT_PUBLIC_*`.
- [ ] Dominio público HTTPS y `SITE_URL` definitivo.
- [ ] Resend con dominio/remitente verificado y recepción comprobada en `OWNER_EMAIL`.
- [ ] Webhooks de Pagos y Contracargos habilitados; simulación firmada recibida.
- [ ] Compra sandbox aprobada, rechazada y pendiente; retorno y consulta de estado correctos.
- [ ] Reintento idempotente de la misma reserva y bloqueo concurrente de la misma fecha.
- [ ] Crons ejecutados con Bearer secret; inbox, outbox y conciliación sin filas estancadas.
- [ ] `npm run check`, `npm audit` y `npm run audit:prod` en verde.
- [ ] Textos de términos y privacidad revisados por el responsable del negocio/asesor legal.
- [ ] Recién entonces rotar a credenciales productivas y establecer `MP_LIVE_MODE=true`.

## Estructura principal

```text
src/app/                         páginas, APIs, status y legales
src/components/sections/         experiencia editorial y reserva guiada
src/lib/mercado-pago.ts          preferencias, firmas y conciliación
src/lib/reservas/                dominio, fechas e inbox/outbox
src/lib/supabase.ts              contrato tipado y cliente admin server-only
supabase/migrations/             baseline e invariantes de datos
```

Las reglas de arquitectura para futuras modificaciones están en `CLAUDE.md`; los documentos de diseño y ejecución están en `docs/plans/`.
