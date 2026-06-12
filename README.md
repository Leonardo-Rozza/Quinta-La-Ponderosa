# La Ponderosa

Sitio web y sistema de reservas de **La Ponderosa**, una quinta en alquiler por día en José C. Paz, Buenos Aires. Los visitantes eligen una fecha, completan sus datos y pagan una seña (50%) online con Mercado Pago.

Stack: **Next.js 16** (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Postgres) · Mercado Pago · Resend (emails).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm run start    # sirve el build
npm run lint     # ESLint
```

## Variables de entorno

Crear un archivo `.env.local` con:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...        # clave service-role (solo backend)

# Mercado Pago
MP_ACCESS_TOKEN=...                  # access token del vendedor
MP_WEBHOOK_SECRET=...                # secreto para validar la firma del webhook (recomendado en prod)

# URL pública del sitio (para back_urls y notification_url de MP)
SITE_URL=https://tudominio.com

# Emails (Resend) — opcional; sin esto no se envían notificaciones
RESEND_API_KEY=...
EMAIL_FROM=La Ponderosa <reservas@tudominio.com>   # opcional (default: onboarding@resend.dev)
OWNER_EMAIL=duenio@tudominio.com                    # opcional (default: CONFIG.email)
```

> La app degrada de forma elegante: sin Supabase el calendario muestra solo fechas
> bloqueadas manualmente, y sin Resend simplemente no se envían emails.

## Base de datos (Supabase)

Tabla `reservas` (ver el tipo `Reserva` en `src/lib/supabase.ts`). **Importante:** para
evitar dobles reservas ante pagos simultáneos, crear este índice único parcial:

```sql
-- Una sola reserva "activa" (confirmada o pendiente) por fecha.
CREATE UNIQUE INDEX IF NOT EXISTS reservas_fecha_activa_idx
ON reservas (fecha)
WHERE estado IN ('confirmada', 'pendiente');
```

El backend además revalida disponibilidad y maneja el conflicto (HTTP 409) si la base
rechaza un insert por este índice.

## Arquitectura del flujo de reservas

1. La sección `Reservas` (`src/components/sections/reservas/`) hace `GET /api/reservas`
   para traer las fechas ocupadas y las pinta en el calendario (`useCalendario`).
2. Al enviar, hace `POST /api/reservas`: valida los datos (Zod), reserva la fecha
   (`estado: 'pendiente'`), crea la preferencia de Mercado Pago y devuelve la URL de pago.
3. Tras pagar, Mercado Pago redirige a `/reserva/{confirmada,error,pendiente}` **y** llama
   a `POST /api/webhook` (server-to-server). **El webhook es la fuente de verdad**: valida
   la firma, consulta el pago real, verifica el monto, actualiza el estado y dispara los
   emails de confirmación.

Las reservas `pendiente` actúan como "hold" por 30 minutos; pasado ese tiempo se liberan.

Más detalle de arquitectura en `CLAUDE.md`.
