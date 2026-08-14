import { createApiError, toApiErrorBody, type ApiErrorCode } from '@/lib/api-errors';
import {
  MAX_LOSSLESS_JSON_BYTES,
  parseLosslessJsonObject,
} from '@/lib/lossless-json';
import {
  MercadoPagoIntegrationError,
  procesarEventoMercadoPago,
  validarWebhookMercadoPago,
} from '@/lib/mercado-pago';
import { registrarEventoWebhook } from '@/lib/reservas/inbox-outbox';
import { hasSupabaseAdminConfig, type Json } from '@/lib/supabase';
import { after, NextRequest, NextResponse } from 'next/server';

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

function contentLengthExceedsLimit(request: NextRequest) {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > MAX_LOSSLESS_JSON_BYTES;
}

export async function POST(request: NextRequest) {
  if (contentLengthExceedsLimit(request)) {
    return errorResponse('VALIDATION_ERROR', 'El evento excede el tamaño permitido.', 413);
  }

  if (!hasSupabaseAdminConfig()) {
    return errorResponse(
      'CONFIGURATION_ERROR',
      'El receptor de pagos no está disponible.',
      503,
      true,
    );
  }

  const rawBody = await request.text().catch(() => '');
  const parsedBody = parseLosslessJsonObject(rawBody);
  if (!parsedBody.ok && parsedBody.reason === 'too_large') {
    return errorResponse('VALIDATION_ERROR', 'El evento excede el tamaño permitido.', 413);
  }
  if (!parsedBody.ok) {
    return errorResponse('VALIDATION_ERROR', 'El evento no contiene JSON válido.', 400);
  }
  const body = parsedBody.value;

  let webhook;
  try {
    webhook = validarWebhookMercadoPago({
      body,
      dataId: request.nextUrl.searchParams.get('data.id'),
      requestId: request.headers.get('x-request-id'),
      signature: request.headers.get('x-signature'),
    });
  } catch (error) {
    if (error instanceof MercadoPagoIntegrationError) {
      if (error.code === 'MP_UNSUPPORTED_TOPIC') {
        // La firma y la igualdad del recurso ya fueron verificadas. Mercado Pago
        // recomienda responder 2xx a tópicos que la integración no consume.
        return NextResponse.json(
          { received: true, ignored: true },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      if (error.code === 'MP_CONFIG_ERROR') {
        console.error('Configuración inválida del webhook de Mercado Pago', {
          code: error.code,
        });
        return errorResponse(
          'CONFIGURATION_ERROR',
          'El receptor de pagos no está disponible.',
          503,
          true,
        );
      }

      console.warn('Webhook de Mercado Pago rechazado', {
        code: error.code,
        requestId: request.headers.get('x-request-id'),
      });
      return errorResponse(
        'PAYMENT_MISMATCH',
        'El evento de pago no pudo ser autenticado.',
        error.code === 'MP_INVALID_WEBHOOK' ? 401 : 400,
      );
    }
    console.error('Error inesperado validando webhook de Mercado Pago', error);
    return errorResponse('INTERNAL_ERROR', 'No se pudo validar el evento de pago.', 500, true);
  }

  const registered = await registrarEventoWebhook({
    eventKey: webhook.eventKey,
    resourceId: webhook.resourceId,
    topic: webhook.topic,
    action: webhook.action,
    payload: webhook.payload as Json,
    signatureTimestamp: webhook.signatureTimestamp,
  });

  if (!registered.ok) {
    console.error('No se pudo persistir el webhook de Mercado Pago', {
      code: registered.error.code,
      requestId: webhook.requestId,
    });
    return NextResponse.json(toApiErrorBody(registered.error), {
      status: registered.error.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const durableEventId = registered.value.id;
  after(async () => {
    try {
      await procesarEventoMercadoPago(durableEventId);
    } catch (error) {
      // El evento ya quedó durable y con backoff; el cron continuará el trabajo.
      console.error('Procesamiento diferido de webhook de Mercado Pago falló', {
        eventId: durableEventId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  });

  return NextResponse.json(
    {
      received: true,
      duplicate: registered.value.duplicate,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET() {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
