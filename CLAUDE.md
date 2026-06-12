# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-page marketing site + booking flow for **La Ponderosa**, a quinta (country house) rented by the day in José C. Paz, Buenos Aires. Visitors pick a date, fill a form, and pay a 50% deposit ("seña") via Mercado Pago. All UI copy, code identifiers, and comments are in Argentine Spanish — match that convention when adding code.

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Supabase · Mercado Pago · Resend (emails).

## Commands

```bash
npm run dev      # Next dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Serve the production build
npm run lint     # ESLint (eslint-config-next, core-web-vitals + typescript)
```

There is no test suite. Import alias `@/*` maps to `src/*`.

## Environment variables

The app degrades gracefully when Supabase/MP are unconfigured (helpers like `hasSupabaseAdminConfig()` gate behavior), so the dev server runs without them, but the booking flow needs all of these:

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-only admin client (used by all API routes; there is no public/anon client)
- `MP_ACCESS_TOKEN` — Mercado Pago server token
- `MP_WEBHOOK_SECRET` — verifies the `x-signature` HMAC on the webhook. Optional but recommended in prod; if unset, signature validation is skipped (dev/sandbox)
- `SITE_URL` (or `NEXT_PUBLIC_SITE_URL`) — base URL for MP back_urls, `notification_url`, `metadataBase`, sitemap/robots; defaults to `http://localhost:3000`
- `RESEND_API_KEY` (+ optional `EMAIL_FROM`, `OWNER_EMAIL`) — transactional emails via Resend. If unset, emails are silently skipped

Env files (`.env*`) are gitignored.

## Architecture

The reservation flow is the core of the app; the rest is static marketing sections rendered from `page.tsx`.

**Booking lifecycle (`reservas` table, single source of truth):**
1. `Reservas` section (`components/sections/reservas/index.tsx`) is a client component. On mount it `GET /api/reservas` to fetch `fechasOcupadas` and feeds them to the `useCalendario` hook, which computes day availability (past/occupied/selectable) for the rendered month.
2. On submit it `POST /api/reservas`, which: validates the body against `reservaInputSchema` (`lib/validations.ts` — the server source of truth; rejects past dates, bad ranges, etc.), re-checks availability, inserts a row with `estado: 'pendiente'`, creates a Mercado Pago `Preference` (deposit = `PRECIOS.porDia * PRECIOS.porcentajeSena`), stores `mp_preference_id`, and returns `checkoutUrl`. The browser redirects to Mercado Pago.
3. After payment, MP redirects the user to `/reserva/{confirmada,error,pendiente}` AND calls `POST /api/webhook` server-to-server. **The webhook is authoritative for state** — it verifies the `x-signature` HMAC (`firmaWebhookValida`), fetches the real payment from MP, **checks the paid amount covers `monto_sena`** (anti-fraud), maps status → `estado` (`approved`→`confirmada`; `rejected`/`cancelled`/`refunded`/`charged_back`→`cancelada`; pending-like → no change), and on the *transition* into `confirmada` sends the confirmation/owner emails (`lib/email.ts`). Never confirm a reservation based on the redirect alone.

**State / concurrency rules to preserve when touching the booking code:**
- A date is "blocked" if it has a reserva in `estado` `confirmada`, or `pendiente` created within `RESERVA_HOLD_MINUTES` (30 min). Pending holds older than that are treated as expired and lazily flipped to `cancelada` on the next POST. This hold-expiry logic lives in `api/reservas/route.ts` (`isPendingReservaActive`, `ESTADOS_BLOQUEANTES`) and the same filtering is mirrored in the GET handler — keep them consistent.
- **Race-condition guard:** a partial unique index in Postgres enforces one active reserva per date — `CREATE UNIQUE INDEX reservas_fecha_activa_idx ON reservas (fecha) WHERE estado IN ('confirmada','pendiente')` (documented in `README.md`). The POST handler catches the resulting `23505` and returns 409. The in-app availability check is best-effort; this index is the real guarantee.
- `FECHAS_BLOQUEADAS_MANUALES` in `lib/constants.ts` lets the owner block dates booked through other channels (WhatsApp, etc.). These are merged into occupied dates in both the GET response and the POST availability check.
- The MP preference uses `idempotencyKey: reserva.id` and `external_reference: reserva.id`; the webhook resolves the reserva via `external_reference`/`metadata.reserva_id`. Keep these wired together.

**Supabase client (`lib/supabase.ts`):** a single lazily-initialized admin singleton (service-role key, server only) used by all API routes — there is no public/anon client. The `Database`/`Reserva` types are hand-maintained here; inserts/updates are cast `as never` to work around the generated-types gap, so keep the table shape in sync manually.

**Pricing / business constants** live in `lib/constants.ts` (`PRECIOS`, `CONFIG`). The server recomputes price from `PRECIOS` on every POST — never trust amounts from the client.

## Styling

Tailwind v4 with the design system defined in `app/globals.css` via `@theme` (custom color tokens: `crema`, `terracota`, `oliva`, `negro`, `blanco`, `disponible`, `ocupado`) and a large set of project-specific component classes (`.section-container`, `.btn-primary`, `.calendario-dia-*`, `.precio-card`, etc.). Prefer these existing classes and tokens over ad-hoc utility soup. Use the `cn()` helper (`lib/utils.ts`) for conditional class merging. Fonts (DM Serif Display, Source Sans 3) are loaded in `layout.tsx` and exposed as CSS variables.

Currency/date formatting helpers (`formatearPrecio`, `formatearFecha*`, `generarLinkWhatsApp`) are in `lib/utils.ts` and use `es-AR` locale — reuse them rather than reformatting inline.
