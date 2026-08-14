import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import {
  createApiError,
  err,
  ok,
  type ApiError,
  type Result,
} from '../api-errors';
import {
  getSupabaseAdmin,
  type Database,
  type EmailOutboxType,
  type Json,
} from '../supabase';

type AdminClient = SupabaseClient<Database>;

export interface RegistrarEventoWebhookInput {
  eventKey: string;
  resourceId: string;
  topic: string;
  action?: string | null;
  payload: Json;
  signatureTimestamp?: string | null;
}

export interface EncolarEmailInput {
  reservaId: string;
  tipo: EmailOutboxType;
  dedupeKey: string;
  payload: Json;
  nextAttemptAt?: string;
}

export interface EncolarRevisionReservaInput {
  reservaId: string;
  sourceKey: string;
  reason: string;
  paymentId?: string | null;
  eventKey?: string | null;
}

export interface DurableInsertResult {
  id: string;
  duplicate: boolean;
}

function persistenceError(message: string): ApiError {
  return createApiError('DATABASE_ERROR', message, {
    status: 503,
    retryable: true,
  });
}

export async function registrarEventoWebhook(
  input: RegistrarEventoWebhookInput,
  client: AdminClient = getSupabaseAdmin()
): Promise<Result<DurableInsertResult, ApiError>> {
  const { data, error } = await client
    .from('mp_webhook_events')
    .insert({
      event_key: input.eventKey,
      resource_id: input.resourceId,
      topic: input.topic,
      action: input.action ?? null,
      payload: input.payload,
      signature_timestamp: input.signatureTimestamp ?? null,
    })
    .select('id')
    .single();

  if (!error && data) {
    return ok({ id: data.id, duplicate: false });
  }

  if (error?.code !== '23505') {
    return err(persistenceError('No se pudo registrar el evento de pago'));
  }

  const { data: existing, error: lookupError } = await client
    .from('mp_webhook_events')
    .select('id')
    .eq('event_key', input.eventKey)
    .single();

  if (lookupError || !existing) {
    return err(persistenceError('No se pudo recuperar el evento duplicado'));
  }

  return ok({ id: existing.id, duplicate: true });
}

export async function encolarEmail(
  input: EncolarEmailInput,
  client: AdminClient = getSupabaseAdmin()
): Promise<Result<DurableInsertResult, ApiError>> {
  const { data, error } = await client
    .from('email_outbox')
    .insert({
      reserva_id: input.reservaId,
      tipo: input.tipo,
      dedupe_key: input.dedupeKey,
      payload: input.payload,
      ...(input.nextAttemptAt ? { next_attempt_at: input.nextAttemptAt } : {}),
    })
    .select('id')
    .single();

  if (!error && data) {
    return ok({ id: data.id, duplicate: false });
  }

  if (error?.code !== '23505') {
    return err(persistenceError('No se pudo encolar la notificación'));
  }

  const { data: existing, error: lookupError } = await client
    .from('email_outbox')
    .select('id')
    .eq('dedupe_key', input.dedupeKey)
    .single();

  if (lookupError || !existing) {
    return err(persistenceError('No se pudo recuperar la notificación duplicada'));
  }

  return ok({ id: existing.id, duplicate: true });
}

export function crearDedupeKeyRevisionReserva(reservaId: string, sourceKey: string) {
  const digest = createHash('sha256').update(sourceKey).digest('hex').slice(0, 32);
  return `reserva-revision:${reservaId}:${digest}`;
}

/** Una misma anomalía semántica produce una única fila aunque MP la notifique varias veces. */
export async function encolarRevisionReserva(
  input: EncolarRevisionReservaInput,
  client: AdminClient = getSupabaseAdmin(),
) {
  return encolarEmail(
    {
      reservaId: input.reservaId,
      tipo: 'reserva_revision',
      dedupeKey: crearDedupeKeyRevisionReserva(input.reservaId, input.sourceKey),
      payload: {
        reservaId: input.reservaId,
        reason: input.reason.slice(0, 500),
        paymentId: input.paymentId ?? null,
        eventKey: input.eventKey ?? null,
      },
    },
    client,
  );
}
