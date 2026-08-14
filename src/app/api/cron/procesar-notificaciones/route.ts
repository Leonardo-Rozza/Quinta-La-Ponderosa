import { createApiError, toApiErrorBody, type ApiErrorCode } from '@/lib/api-errors';
import { enviarEmailReservaRevision, enviarEmailsReservaConfirmada } from '@/lib/email';
import { isDeployedEnvironment, procesarEventoMercadoPago } from '@/lib/mercado-pago';
import {
  getSupabaseAdmin,
  hasSupabaseAdminConfig,
  type EmailOutboxEntry,
  type Json,
  type Reserva,
} from '@/lib/supabase';
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const EVENT_BATCH_SIZE = 20;
const EMAIL_BATCH_SIZE = 20;
const WORKER_CONCURRENCY = 4;
const LEASE_TIMEOUT_MS = 10 * 60 * 1_000;
const RATE_LIMIT_RETENTION_MS = 48 * 60 * 60 * 1_000;

type CronAuth = 'authorized' | 'unauthorized' | 'misconfigured';

function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  retryable = false,
) {
  return NextResponse.json(
    toApiErrorBody(createApiError(code, message, { status, retryable })),
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function authorizeCron(request: NextRequest): CronAuth {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return isDeployedEnvironment() ? 'misconfigured' : 'authorized';
  if (isDeployedEnvironment() && Buffer.byteLength(secret) < 32) return 'misconfigured';
  return constantTimeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)
    ? 'authorized'
    : 'unauthorized';
}

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  return message.replaceAll(/[\r\n\t]+/g, ' ').slice(0, 500);
}

function nextAttemptAt(attempt: number) {
  const seconds = Math.min(6 * 60 * 60, 30 * 2 ** Math.max(0, attempt - 1));
  return new Date(Date.now() + seconds * 1_000).toISOString();
}

async function recoverAbandonedLeases() {
  const client = getSupabaseAdmin();
  const staleBefore = new Date(Date.now() - LEASE_TIMEOUT_MS).toISOString();
  const now = new Date().toISOString();
  const [events, emails] = await Promise.all([
    client
      .from('mp_webhook_events')
      .update({
        status: 'error',
        error: 'Lease de procesamiento vencido; se reintentará.',
        next_attempt_at: now,
      })
      .eq('status', 'procesando')
      .lt('updated_at', staleBefore),
    client
      .from('email_outbox')
      .update({
        status: 'error',
        error: 'Lease de envío vencido; se reintentará.',
        next_attempt_at: now,
      })
      .eq('status', 'procesando')
      .lt('updated_at', staleBefore),
  ]);

  if (events.error || emails.error) {
    throw new Error('No se pudieron recuperar trabajos abandonados');
  }
}

async function purgeExpiredRateLimits() {
  const cutoff = new Date(Date.now() - RATE_LIMIT_RETENTION_MS).toISOString();
  const { count, error } = await getSupabaseAdmin()
    .from('api_rate_limits')
    .delete({ count: 'exact' })
    .lt('updated_at', cutoff);

  if (error) {
    console.error('No se pudieron purgar rate limits vencidos', { code: error.code });
    return { deleted: 0, failed: true };
  }

  return { deleted: count ?? 0, failed: false };
}

async function runWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(WORKER_CONCURRENCY, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        if (item !== undefined) await worker(item);
      }
    },
  );
  await Promise.all(runners);
}

async function processPendingEvents() {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('mp_webhook_events')
    .select('id')
    .in('status', ['pendiente', 'error'])
    .lte('next_attempt_at', now)
    .order('created_at', { ascending: true })
    .limit(EVENT_BATCH_SIZE);
  if (error) throw new Error('No se pudieron leer eventos pendientes');

  let processed = 0;
  let failed = 0;
  await runWithConcurrency(data ?? [], async ({ id }) => {
    try {
      const result = await procesarEventoMercadoPago(id);
      if (result.status === 'procesado' || result.status === 'ignorado') processed += 1;
    } catch (eventError) {
      failed += 1;
      console.error('Falló un evento durable de Mercado Pago', {
        eventId: id,
        error: compactError(eventError),
      });
    }
  });

  return { selected: data?.length ?? 0, processed, failed };
}

async function claimEmail(id: string) {
  const client = getSupabaseAdmin();
  const { data: current, error } = await client
    .from('email_outbox')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('No se pudo leer la notificación');
  if (!current || !['pendiente', 'error'].includes(current.status)) return null;
  if (new Date(current.next_attempt_at).getTime() > Date.now()) return null;

  const { data: claimed, error: claimError } = await client
    .from('email_outbox')
    .update({
      status: 'procesando',
      attempts: current.attempts + 1,
      error: null,
    })
    .eq('id', current.id)
    .eq('status', current.status)
    .eq('attempts', current.attempts)
    .select()
    .maybeSingle();
  if (claimError) throw new Error('No se pudo tomar la notificación');
  return claimed;
}

async function finishEmail(entry: EmailOutboxEntry) {
  const { data, error } = await getSupabaseAdmin()
    .from('email_outbox')
    .update({
      status: 'enviado',
      error: null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', entry.id)
    .eq('status', 'procesando')
    .eq('attempts', entry.attempts)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('No se pudo cerrar la notificación enviada');
  if (!data) throw new Error('La lease de la notificación fue reemplazada');
}

async function failEmail(entry: EmailOutboxEntry, error: unknown) {
  const { data, error: updateError } = await getSupabaseAdmin()
    .from('email_outbox')
    .update({
      status: 'error',
      error: compactError(error),
      next_attempt_at: nextAttemptAt(entry.attempts),
    })
    .eq('id', entry.id)
    .eq('status', 'procesando')
    .eq('attempts', entry.attempts)
    .select('id')
    .maybeSingle();
  if (updateError) {
    console.error('No se pudo reprogramar una notificación', {
      outboxId: entry.id,
      code: updateError.code,
    });
  } else if (!data) {
    console.warn('La notificación perdió su lease antes de reprogramarse', {
      outboxId: entry.id,
      attempt: entry.attempts,
    });
  }
}

async function deliverEmail(entry: EmailOutboxEntry) {
  if (entry.tipo !== 'reserva_confirmada' && entry.tipo !== 'reserva_revision') {
    throw new Error(`Tipo de notificación no soportado: ${entry.tipo}`);
  }

  const { data, error } = await getSupabaseAdmin()
    .from('reservas')
    .select('*')
    .eq('id', entry.reserva_id)
    .maybeSingle();
  if (error || !data) throw new Error('No se pudo recuperar la reserva de la notificación');

  const reserva = data as Reserva;
  if (entry.tipo === 'reserva_confirmada') {
    if (reserva.estado !== 'confirmada' || reserva.estado_pago !== 'aprobado') {
      throw new Error('La reserva ya no admite una notificación de confirmación');
    }

    const sent = await enviarEmailsReservaConfirmada(reserva, entry.dedupe_key);
    if (!sent) throw new Error('El proveedor de email no confirmó todos los envíos');
    return;
  }

  const payload = getRevisionEmailDetails(entry.payload);
  const sent = await enviarEmailReservaRevision(reserva, payload, entry.dedupe_key);
  if (!sent) throw new Error('El proveedor de email no confirmó la alerta de revisión');
}

function getRevisionEmailDetails(payload: Json) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return {
    reason: typeof payload.reason === 'string' ? payload.reason.slice(0, 500) : null,
    paymentId: typeof payload.paymentId === 'string' ? payload.paymentId.slice(0, 200) : null,
    eventKey: typeof payload.eventKey === 'string' ? payload.eventKey.slice(0, 300) : null,
  };
}

async function processPendingEmails() {
  const { data, error } = await getSupabaseAdmin()
    .from('email_outbox')
    .select('id')
    .in('status', ['pendiente', 'error'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(EMAIL_BATCH_SIZE);
  if (error) throw new Error('No se pudieron leer notificaciones pendientes');

  let sent = 0;
  let failed = 0;
  await runWithConcurrency(data ?? [], async ({ id }) => {
    let claimed: EmailOutboxEntry | null = null;
    try {
      claimed = await claimEmail(id);
      if (!claimed) return;
      await deliverEmail(claimed);
      await finishEmail(claimed);
      sent += 1;
    } catch (emailError) {
      failed += 1;
      if (claimed) await failEmail(claimed, emailError);
      console.error('Falló una notificación durable', {
        outboxId: id,
        error: compactError(emailError),
      });
    }
  });

  return { selected: data?.length ?? 0, sent, failed };
}

export async function GET(request: NextRequest) {
  const authorization = authorizeCron(request);
  if (authorization === 'misconfigured') {
    return errorResponse(
      'CONFIGURATION_ERROR',
      'El cron no está configurado correctamente.',
      503,
      true,
    );
  }
  if (authorization === 'unauthorized') {
    return errorResponse('VALIDATION_ERROR', 'No autorizado.', 401);
  }
  if (!hasSupabaseAdminConfig()) {
    return errorResponse('CONFIGURATION_ERROR', 'Supabase no está configurado.', 503, true);
  }

  try {
    await recoverAbandonedLeases();
    const rateLimits = await purgeExpiredRateLimits();
    const events = await processPendingEvents();
    const emails = await processPendingEmails();
    return NextResponse.json(
      { ok: true, rateLimits, events, emails },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Falló el cron de eventos y notificaciones', {
      error: compactError(error),
    });
    return errorResponse(
      'DATABASE_ERROR',
      'No se pudieron procesar los trabajos pendientes.',
      503,
      true,
    );
  }
}
