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
npm run typecheck
npm run test     # Vitest
npm run check    # lint + types + tests + build
```

Import alias `@/*` maps to `src/*`.

## Environment variables

Use `.env.example` as the complete contract. The marketing UI can render without external services, but availability and checkout fail closed when their secure server configuration is incomplete. A deployed booking flow needs at least:

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-only admin client (used by all API routes; there is no public/anon client)
- `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID`, `MP_LIVE_MODE` — Mercado Pago identity and environment
- `MP_WEBHOOK_SECRET` — mandatory in deploy; verifies the SDK-compatible `x-signature`, timestamp and signed resource ID
- `SITE_URL` (or `NEXT_PUBLIC_SITE_URL`) — base URL for MP back_urls, `notification_url`, `metadataBase`, sitemap/robots; defaults to `http://localhost:3000`
- `RESERVA_STATUS_SECRET` — HMAC for the scoped public reservation-status URL
- `CRON_SECRET`, `RATE_LIMIT_SECRET` — protect scheduled workers and hash abuse signals
- `RESEND_API_KEY`, `EMAIL_FROM` (+ optional `OWNER_EMAIL` only while `CONFIG.email` remains valid) — transactional email configuration; deployed checkout fails closed when this preflight is invalid

Env files (`.env*`) are gitignored.

## Architecture

The reservation flow is the core of the app; the rest is static marketing sections rendered from `page.tsx`.

**Booking lifecycle (`reservas` table, single source of truth):**
1. `Reservas` section (`components/sections/reservas/index.tsx`) is a client component. On mount it `GET /api/reservas` to fetch `fechasOcupadas` and feeds them to the `useCalendario` hook, which computes day availability (past/occupied/selectable) for the rendered month.
2. On submit it `POST /api/reservas`, which validates strict JSON and origin, consumes distributed abuse buckets, recomputes price server-side, re-checks availability and inserts a pending hold identified by `booking_request_id`. It then creates or idempotently recovers a Mercado Pago preference and returns only the checkout URL for the configured environment.
3. After payment, MP redirects to `/reserva/{confirmada,error,pendiente}` and calls `POST /api/webhook`. **The webhook is authoritative**: it validates the signature/timestamp/resource ID, persists the event before acknowledging, and processes it idempotently. Payment data is fetched from MP and bound to the expected preference, collector, mode, currency and exact amount. The redirect queries `GET /api/reservas/estado` with a scoped HMAC token; it never confirms from URL parameters.
4. `procesar-notificaciones` retries the durable webhook inbox and email outbox. Confirmation emails use `reserva_confirmada`; refunds, chargebacks, late approvals and migration ambiguities use owner-only `reserva_revision`. `limpiar-pendientes` reconciles expired holds with MP after a safety grace period and requires two separated empty searches before releasing a date. Both routes require `CRON_SECRET`.

**State / concurrency rules to preserve when touching the booking code:**
- A date is blocked by every `confirmada` or `pendiente`. An expired pending row remains blocked until reconciliation explicitly proves it safe to cancel; never infer availability from the browser or from `hold_expires_at` alone.
- Database migrations in `supabase/migrations/` start with a reproducible baseline and enforce the unique active date, idempotent booking request, monotonic states, RLS/grants and durable job tables. Application preflight checks improve UX, but database constraints are the concurrency guarantees. Historical financial ambiguities must stay in manual review; never infer payment approval from a legacy reservation state.
- A confirmed reservation never degrades. Refunds and chargebacks keep its date blocked and mark it for manual review. A late approval on an already cancelled hold also goes to review and never silently reactivates the date.
- `reembolsado -> contracargo` is the only allowed transition out of a refund. A chargeback is terminal.
- `FECHAS_BLOQUEADAS_MANUALES` in `lib/constants.ts` lets the owner block dates booked through other channels (WhatsApp, etc.). These are merged into occupied dates in both the GET response and the POST availability check.
- The MP preference uses the stable booking request as idempotency key and the reservation UUID as `external_reference`/metadata. Keep those bindings intact.

**Supabase client (`lib/supabase.ts`):** a single lazily-initialized admin singleton (service-role key, server only) used by API routes — there is no public/anon client. The `Database`/`Reserva` types are hand-maintained here, so keep them synchronized with every migration.

**Pricing / business constants** live in `lib/constants.ts` (`PRECIOS`, `CONFIG`). The server recomputes price from `PRECIOS` on every POST — never trust amounts from the client.

**Scheduled work:** `vercel.json` invokes notifications every 5 minutes and reconciliation every 15 minutes. Those expressions require Vercel Pro/Enterprise. A Hobby deployment must remove that cron block and provide an external scheduler with the same frequencies and `Authorization: Bearer <CRON_SECRET>`; daily execution is not safe for this lifecycle.

## Styling

Tailwind v4 with the editorial design system defined in `app/globals.css` via `@theme` and CSS custom properties. Primary tokens are paper/bone, forest, clay, ink and water (`papel`, `hueso`, `bosque`, `arcilla`, `tinta`, `agua`), with compatibility aliases for older names. Reuse `.section-container`, `.section-shell`, `.section-intro`, `.button` variants and the existing booking/gallery/legal classes instead of ad-hoc utility soup. Use the `cn()` helper (`lib/utils.ts`) for conditional class merging. Fonts (DM Serif Display, Source Sans 3) are loaded in `layout.tsx` and exposed as CSS variables.

Currency/date formatting helpers (`formatearPrecio`, `formatearFecha*`, `generarLinkWhatsApp`) are in `lib/utils.ts` and use `es-AR` locale — reuse them rather than reformatting inline.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
