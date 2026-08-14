import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createApiError,
  err,
  ok,
  type ApiError,
  type Result,
} from './api-errors';
import { getSupabaseAdmin, type Database } from './supabase';

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export interface RateLimitActorInput {
  ip: string;
}

export type RateLimitSignalKind = 'ip' | 'email';

export interface RateLimitSignalInput {
  kind: RateLimitSignalKind;
  value: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export interface ConsumeRateLimitInput {
  actorHash: string;
  scope: string;
  limit: number;
  windowSeconds: number;
  client?: SupabaseClient<Database>;
}

function normalizeSignal(value: string | null | undefined, maxLength: number): string {
  return (value ?? '').trim().toLowerCase().slice(0, maxLength);
}

function getRateLimitSecret(secret = process.env.RATE_LIMIT_SECRET?.trim()) {
  if (!secret || secret.length < 32) {
    return err(
      createApiError(
        'CONFIGURATION_ERROR',
        'RATE_LIMIT_SECRET debe estar configurado con al menos 32 caracteres',
        { status: 503 },
      ),
    );
  }

  return ok(secret);
}

function getSignalMaxLength(kind: RateLimitSignalKind) {
  switch (kind) {
    case 'ip':
      return 128;
    case 'email':
      return 254;
  }
}

/**
 * Genera identificadores no reversibles e independientes por señal. Separar IP
 * y email evita que cambiar una señal reinicie todos los límites.
 */
export function hashRateLimitSignal(
  input: RateLimitSignalInput,
  secret = process.env.RATE_LIMIT_SECRET?.trim(),
): Result<string, ApiError> {
  const configuredSecret = getRateLimitSecret(secret);
  if (!configuredSecret.ok) return configuredSecret;

  const value = normalizeSignal(input.value, getSignalMaxLength(input.kind));
  if (!value) {
    return err(
      createApiError('VALIDATION_ERROR', 'No se pudo identificar la señal de rate limit', {
        status: 400,
        field: input.kind,
      }),
    );
  }

  const canonical = [
    'rate-limit-signal:v2',
    `kind:${input.kind}`,
    `value:${value}`,
  ].join('\n');

  return ok(
    createHmac('sha256', configuredSecret.value).update(canonical).digest('hex'),
  );
}

/**
 * El actor persistido en reservas representa exclusivamente la IP. Los demás
 * buckets se consumen por separado y nunca se guardan junto a la reserva.
 */
export function hashRateLimitActor(
  input: RateLimitActorInput,
  secret = process.env.RATE_LIMIT_SECRET?.trim(),
): Result<string, ApiError> {
  return hashRateLimitSignal({ kind: 'ip', value: input.ip }, secret);
}

export function rateLimitActorHashesEqual(left: string, right: string): boolean {
  if (!HASH_PATTERN.test(left) || !HASH_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export async function consumeDistributedRateLimit({
  actorHash,
  scope,
  limit,
  windowSeconds,
  client = getSupabaseAdmin(),
}: ConsumeRateLimitInput): Promise<Result<RateLimitDecision, ApiError>> {
  if (
    !HASH_PATTERN.test(actorHash) ||
    !scope.trim() ||
    scope.length > 100 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10_000 ||
    !Number.isInteger(windowSeconds) ||
    windowSeconds < 1 ||
    windowSeconds > 86_400
  ) {
    return err(
      createApiError('VALIDATION_ERROR', 'Configuración de rate limit inválida', {
        status: 400,
      })
    );
  }

  const { data, error } = await client.rpc('consume_rate_limit', {
    p_actor_hash: actorHash,
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  const decision = data?.[0];
  if (error || !decision) {
    return err(
      createApiError('DATABASE_ERROR', 'No se pudo verificar el límite de solicitudes', {
        status: 503,
        retryable: true,
      })
    );
  }

  return ok({
    allowed: decision.allowed,
    remaining: decision.remaining,
    resetAt: decision.reset_at,
  });
}
