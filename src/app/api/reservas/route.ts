import { createApiError, toApiErrorBody, type ApiError, type ApiErrorCode } from '@/lib/api-errors';
import { PRECIOS, RESERVA_HOLD_MINUTES, obtenerFechasBloqueadasManuales } from '@/lib/constants';
import { validarConfiguracionEmail } from '@/lib/email';
import {
  crearPreferenciaMercadoPago,
  getSiteUrl,
  isDeployedEnvironment,
  MercadoPagoIntegrationError,
  validarConfiguracionCheckoutMercadoPago,
} from '@/lib/mercado-pago';
import {
  consumeDistributedRateLimit,
  hashRateLimitActor,
  hashRateLimitSignal,
} from '@/lib/rate-limit';
import { getConfiguredReservaMaxAdvanceDays } from '@/lib/reservas';
import { getSupabaseAdmin, hasSupabaseAdminConfig, type Reserva } from '@/lib/supabase';
import { reservaInputSchema, type ReservaInput } from '@/lib/validations';
import { NextRequest, NextResponse } from 'next/server';

const ESTADOS_BLOQUEANTES = ['confirmada', 'pendiente'] as const;
const DEFAULT_IP_RATE_LIMIT = 8;
const DEFAULT_IP_RATE_WINDOW_SECONDS = 15 * 60;
const DEFAULT_EMAIL_RATE_LIMIT = 3;
const DEFAULT_EMAIL_RATE_WINDOW_SECONDS = 30 * 60;
const MAX_PENDING_PER_IP = 2;
const MAX_RESERVATION_BODY_BYTES = 64 * 1024;

type ReservaBloqueanteConFecha = Pick<Reserva, 'fecha' | 'estado'>;

function parsePositiveInteger(raw: string | undefined, fallback: number, maximum: number) {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  options: { retryable?: boolean; field?: string; headers?: HeadersInit } = {},
) {
  const error = createApiError(code, message, {
    status,
    retryable: options.retryable,
    field: options.field,
  });
  return NextResponse.json(toApiErrorBody(error), {
    status,
    headers: { 'Cache-Control': 'no-store', ...options.headers },
  });
}

function resultError(error: ApiError) {
  return NextResponse.json(toApiErrorBody(error), {
    status: error.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function getClientIp(request: NextRequest) {
  const firstAddress = (value: string | null) => value?.split(',')[0]?.trim();
  const vercelForwarded = firstAddress(request.headers.get('x-vercel-forwarded-for'));
  const forwarded = firstAddress(request.headers.get('x-forwarded-for'));
  const realIp = request.headers.get('x-real-ip')?.trim();

  if (process.env.VERCEL === '1') {
    // Vercel sobrescribe este header en su borde. Si falta, cerramos sobre un
    // actor compartido en vez de confiar en headers que el cliente puede enviar.
    return vercelForwarded || 'unknown';
  }

  return forwarded || realIp || 'unknown';
}

function contentLengthExceedsLimit(request: NextRequest) {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > MAX_RESERVATION_BODY_BYTES;
}

function hasJsonContentType(request: NextRequest) {
  return request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ===
    'application/json';
}

function hasAllowedOrigin(request: NextRequest) {
  const rawOrigin = request.headers.get('origin');
  if (!rawOrigin) return true;

  let origin: string;
  try {
    origin = new URL(rawOrigin).origin;
  } catch {
    return false;
  }
  if (origin !== rawOrigin.replace(/\/$/, '')) return false;

  const allowedOrigins = new Set([request.nextUrl.origin, new URL(getSiteUrl()).origin]);
  return allowedOrigins.has(origin);
}

async function readJsonObject(request: NextRequest) {
  if (contentLengthExceedsLimit(request)) return { kind: 'too_large' as const };
  const raw = await request.text().catch(() => '');
  if (Buffer.byteLength(raw, 'utf8') > MAX_RESERVATION_BODY_BYTES) {
    return { kind: 'too_large' as const };
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { kind: 'invalid' as const };
    }
    return { kind: 'ok' as const, value };
  } catch {
    return { kind: 'invalid' as const };
  }
}

function sameBookingRequest(reserva: Reserva, input: ReservaInput) {
  return (
    reserva.booking_request_id === input.bookingRequestId &&
    reserva.nombre_completo === input.nombreCompleto &&
    reserva.email.toLowerCase() === input.email.toLowerCase() &&
    reserva.telefono === input.telefono &&
    reserva.fecha === input.fecha &&
    reserva.cantidad_personas === input.cantidadPersonas &&
    (reserva.comentarios ?? '') === (input.comentarios ?? '')
  );
}

function checkoutResponse(reserva: Reserva, replayed: boolean) {
  if (!reserva.checkout_url || !reserva.booking_request_id || !reserva.hold_expires_at) {
    return null;
  }

  return NextResponse.json(
    {
      success: true,
      reservaId: reserva.id,
      bookingRequestId: reserva.booking_request_id,
      checkoutUrl: reserva.checkout_url,
      holdExpiresAt: reserva.hold_expires_at,
      replayed,
    },
    {
      status: replayed ? 200 : 201,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

async function findByBookingRequestId(bookingRequestId: string) {
  return getSupabaseAdmin()
    .from('reservas')
    .select('*')
    .eq('booking_request_id', bookingRequestId)
    .maybeSingle();
}

async function ensurePreference(reserva: Reserva, input: ReservaInput, replayed: boolean) {
  if (reserva.estado !== 'pendiente' || new Date(reserva.hold_expires_at).getTime() <= Date.now()) {
    return apiError(
      'RESERVATION_CONFLICT',
      'La solicitud ya no admite iniciar un pago. Generá una nueva reserva.',
      409,
    );
  }

  const existingResponse = checkoutResponse(reserva, true);
  if (existingResponse) return existingResponse;

  let preference;
  try {
    preference = await crearPreferenciaMercadoPago({
      id: reserva.id,
      bookingRequestId: input.bookingRequestId,
      fecha: reserva.fecha,
      cantidadPersonas: reserva.cantidad_personas,
      montoSena: reserva.monto_sena,
      nombreCompleto: reserva.nombre_completo,
      email: reserva.email,
      holdExpiresAt: reserva.hold_expires_at,
    });
  } catch (error) {
    if (error instanceof MercadoPagoIntegrationError) {
      console.error('Mercado Pago no pudo crear/recuperar la preferencia', {
        code: error.code,
        retryable: error.retryable,
        reservaId: reserva.id,
      });
      return apiError(
        error.code === 'MP_CONFIG_ERROR' ? 'CONFIGURATION_ERROR' : 'EXTERNAL_SERVICE_ERROR',
        error.code === 'MP_CONFIG_ERROR'
          ? 'El medio de pago no está configurado correctamente.'
          : 'No se pudo iniciar el pago. Reintentá con la misma solicitud.',
        error.code === 'MP_CONFIG_ERROR' ? 503 : 502,
        { retryable: error.retryable },
      );
    }
    throw error;
  }

  const { data, error } = await getSupabaseAdmin()
    .from('reservas')
    .update({
      mp_preference_id: preference.id,
      checkout_url: preference.checkoutUrl,
      sandbox_checkout_url: preference.sandboxCheckoutUrl,
      estado_pago: 'pendiente',
    } as never)
    .eq('id', reserva.id)
    .eq('estado', 'pendiente')
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error('No se pudo persistir la preferencia de Mercado Pago', {
      reservaId: reserva.id,
      code: error?.code,
    });
    return apiError(
      'DATABASE_ERROR',
      'El pago fue preparado pero no se pudo guardar. Reintentá con la misma solicitud.',
      503,
      { retryable: true },
    );
  }

  return checkoutResponse(data as Reserva, replayed) ??
    apiError('DATABASE_ERROR', 'No se pudo recuperar la reserva actualizada.', 503, {
      retryable: true,
    });
}

export async function POST(request: NextRequest) {
  try {
    if (!hasJsonContentType(request)) {
      return apiError(
        'VALIDATION_ERROR',
        'Content-Type debe ser application/json.',
        415,
      );
    }

    try {
      if (!hasAllowedOrigin(request)) {
        return apiError('VALIDATION_ERROR', 'El origen de la solicitud no está permitido.', 403);
      }
    } catch (error) {
      if (error instanceof MercadoPagoIntegrationError && error.code === 'MP_CONFIG_ERROR') {
        return apiError('CONFIGURATION_ERROR', 'El servicio no está configurado.', 503, {
          retryable: true,
        });
      }
      throw error;
    }

    if (!hasSupabaseAdminConfig()) {
      return apiError('CONFIGURATION_ERROR', 'El servicio de reservas no está disponible.', 503, {
        retryable: true,
      });
    }

    const body = await readJsonObject(request);
    if (body.kind === 'too_large') {
      return apiError('VALIDATION_ERROR', 'La solicitud excede el tamaño permitido.', 413);
    }
    if (body.kind === 'invalid') {
      return apiError('VALIDATION_ERROR', 'La solicitud no contiene JSON válido.', 400);
    }

    const parsed = reservaInputSchema.safeParse(body.value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const isBot = issue?.path[0] === 'honeypot';
      return apiError(
        isBot ? 'BOT_DETECTED' : 'VALIDATION_ERROR',
        issue?.message ?? 'Los datos de la reserva no son válidos.',
        400,
        { field: typeof issue?.path[0] === 'string' ? issue.path[0] : undefined },
      );
    }

    const input = parsed.data;
    if (isDeployedEnvironment()) {
      const emailConfiguration = validarConfiguracionEmail();
      if (!emailConfiguration.ok) {
        console.error('Configuración de email inválida para iniciar un checkout', {
          issues: emailConfiguration.issues,
        });
        return apiError(
          'CONFIGURATION_ERROR',
          'El servicio de reservas no está configurado correctamente.',
          503,
          { retryable: true },
        );
      }
    }

    const existing = await findByBookingRequestId(input.bookingRequestId);
    if (existing.error) {
      return apiError('DATABASE_ERROR', 'No se pudo validar la solicitud.', 503, {
        retryable: true,
      });
    }

    if (existing.data) {
      const reserva = existing.data as Reserva;
      if (!sameBookingRequest(reserva, input)) {
        return apiError(
          'RESERVATION_CONFLICT',
          'La referencia idempotente ya fue usada con otros datos.',
          409,
        );
      }
      return ensurePreference(reserva, input, true);
    }

    try {
      validarConfiguracionCheckoutMercadoPago();
    } catch (error) {
      if (error instanceof MercadoPagoIntegrationError && error.code === 'MP_CONFIG_ERROR') {
        console.error('Configuración inválida para crear checkout de Mercado Pago', {
          code: error.code,
        });
        return apiError(
          'CONFIGURATION_ERROR',
          'El medio de pago no está configurado correctamente.',
          503,
          { retryable: true },
        );
      }
      throw error;
    }

    const clientIp = getClientIp(request);
    const actorHashResult = hashRateLimitActor({ ip: clientIp });
    if (!actorHashResult.ok) return resultError(actorHashResult.error);
    const actorHash = actorHashResult.value;

    const emailHashResult = hashRateLimitSignal({ kind: 'email', value: input.email });
    if (!emailHashResult.ok) return resultError(emailHashResult.error);

    const rateLimitPolicies = [
      {
        actorHash,
        scope: 'crear-reserva:ip',
        limit: parsePositiveInteger(
          process.env.RESERVA_RATE_LIMIT_IP,
          DEFAULT_IP_RATE_LIMIT,
          1_000,
        ),
        windowSeconds: parsePositiveInteger(
          process.env.RESERVA_RATE_WINDOW_SECONDS_IP,
          DEFAULT_IP_RATE_WINDOW_SECONDS,
          86_400,
        ),
      },
      {
        actorHash: emailHashResult.value,
        scope: 'crear-reserva:email',
        limit: parsePositiveInteger(
          process.env.RESERVA_RATE_LIMIT_EMAIL,
          DEFAULT_EMAIL_RATE_LIMIT,
          1_000,
        ),
        windowSeconds: parsePositiveInteger(
          process.env.RESERVA_RATE_WINDOW_SECONDS_EMAIL,
          DEFAULT_EMAIL_RATE_WINDOW_SECONDS,
          86_400,
        ),
      },
    ];

    for (const policy of rateLimitPolicies) {
      const rateLimit = await consumeDistributedRateLimit(policy);
      if (!rateLimit.ok) return resultError(rateLimit.error);
      if (!rateLimit.value.allowed) {
        const retryAfter = Math.max(
          1,
          Math.ceil((new Date(rateLimit.value.resetAt).getTime() - Date.now()) / 1_000),
        );
        return apiError(
          'RATE_LIMITED',
          'Demasiados intentos. Esperá antes de reintentar.',
          429,
          {
            retryable: true,
            headers: { 'Retry-After': String(retryAfter) },
          },
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const holdExpiresAt = new Date(
      now.getTime() + RESERVA_HOLD_MINUTES * 60 * 1_000,
    ).toISOString();

    const { count: pendingCount, error: pendingCountError } = await supabase
      .from('reservas')
      .select('id', { count: 'exact', head: true })
      .eq('actor_hash', actorHash)
      .eq('estado', 'pendiente');

    if (pendingCountError) {
      return apiError('DATABASE_ERROR', 'No se pudo validar el límite de reservas.', 503, {
        retryable: true,
      });
    }

    if ((pendingCount ?? 0) >= MAX_PENDING_PER_IP) {
      return apiError(
        'RATE_LIMITED',
        'Ya tenés reservas pendientes. Finalizá o esperá su vencimiento antes de crear otra.',
        429,
        { retryable: true },
      );
    }

    if (obtenerFechasBloqueadasManuales().includes(input.fecha)) {
      return apiError('DATE_UNAVAILABLE', 'La fecha seleccionada no está disponible.', 409);
    }

    const { data: reservasExistentes, error: disponibilidadError } = await supabase
      .from('reservas')
      .select('id')
      .eq('fecha', input.fecha)
      .in('estado', [...ESTADOS_BLOQUEANTES])
      .limit(1);

    if (disponibilidadError) {
      return apiError('DATABASE_ERROR', 'No se pudo verificar la disponibilidad.', 503, {
        retryable: true,
      });
    }
    if ((reservasExistentes?.length ?? 0) > 0) {
      return apiError('DATE_UNAVAILABLE', 'La fecha seleccionada ya no está disponible.', 409);
    }

    const precioTotal = PRECIOS.porDia;
    const montoSena = Math.round(precioTotal * PRECIOS.porcentajeSena);
    const { data: inserted, error: insertError } = await supabase
      .from('reservas')
      .insert({
        booking_request_id: input.bookingRequestId,
        nombre_completo: input.nombreCompleto,
        email: input.email,
        telefono: input.telefono,
        fecha: input.fecha,
        cantidad_personas: input.cantidadPersonas,
        comentarios: input.comentarios || null,
        precio_total: precioTotal,
        monto_sena: montoSena,
        estado: 'pendiente',
        estado_pago: 'sin_iniciar',
        hold_expires_at: holdExpiresAt,
        actor_hash: actorHash,
        terminos_aceptados_en: now.toISOString(),
      } as never)
      .select()
      .single();

    if (insertError) {
      if (
        insertError.code === '23514' &&
        insertError.message.includes('reservas_actor_pending_limit')
      ) {
        return apiError(
          'RATE_LIMITED',
          'Ya tenés reservas pendientes. Finalizá o esperá su conciliación antes de crear otra.',
          429,
          { retryable: true },
        );
      }
      if (insertError.code === '23505') {
        const raced = await findByBookingRequestId(input.bookingRequestId);
        if (raced.data && sameBookingRequest(raced.data as Reserva, input)) {
          return ensurePreference(raced.data as Reserva, input, true);
        }
        return apiError('DATE_UNAVAILABLE', 'La fecha seleccionada ya no está disponible.', 409);
      }
      console.error('Error creando reserva', { code: insertError.code });
      return apiError('DATABASE_ERROR', 'No se pudo crear la reserva.', 503, {
        retryable: true,
      });
    }

    return ensurePreference(inserted as Reserva, input, false);
  } catch (error) {
    console.error('Error inesperado en POST /api/reservas', error);
    return apiError('INTERNAL_ERROR', 'Ocurrió un error interno.', 500, { retryable: true });
  }
}

export async function GET() {
  try {
    const fechasBloqueadasManuales = obtenerFechasBloqueadasManuales();
    const maxAdvanceDays = getConfiguredReservaMaxAdvanceDays();

    if (!hasSupabaseAdminConfig()) {
      return apiError('CONFIGURATION_ERROR', 'La disponibilidad no está disponible.', 503, {
        retryable: true,
      });
    }

    // Una pendiente solo deja de bloquear cuando el cron la reconcilió con MP y
    // la canceló; el reloj por sí solo no prueba que el cliente no haya pagado.
    const { data, error } = await getSupabaseAdmin()
      .from('reservas')
      .select('fecha, estado')
      .in('estado', [...ESTADOS_BLOQUEANTES]);

    if (error) {
      return apiError('DATABASE_ERROR', 'No se pudo obtener la disponibilidad.', 503, {
        retryable: true,
      });
    }

    const fechasOcupadasDb = ((data ?? []) as ReservaBloqueanteConFecha[]).map(
      (reserva) => reserva.fecha,
    );
    const fechasOcupadas = [
      ...new Set([...fechasOcupadasDb, ...fechasBloqueadasManuales]),
    ].sort();

    return NextResponse.json(
      { fechasOcupadas, maxAdvanceDays },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Error inesperado en GET /api/reservas', error);
    return apiError('INTERNAL_ERROR', 'No se pudo obtener la disponibilidad.', 500, {
      retryable: true,
    });
  }
}
