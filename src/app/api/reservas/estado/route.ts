import { createApiError, toApiErrorBody, type ApiErrorCode } from '@/lib/api-errors';
import {
  MercadoPagoIntegrationError,
  validarTokenEstadoReserva,
} from '@/lib/mercado-pago';
import { reservasOnlineHabilitadas } from '@/lib/reservas/online-config';
import { getSupabaseAdmin, hasSupabaseAdminConfig, type Reserva } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  retryable = false,
) {
  return NextResponse.json(
    toApiErrorBody(createApiError(code, message, { status, retryable })),
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function GET(request: NextRequest) {
  const reservaId = request.nextUrl.searchParams.get('reservaId')?.trim() ?? '';
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';

  if (!UUID_PATTERN.test(reservaId) || !token || token.length > 128) {
    return errorResponse('RESERVATION_NOT_FOUND', 'Reserva no encontrada.', 404);
  }

  try {
    if (!validarTokenEstadoReserva(reservaId, token)) {
      // No distinguimos token inválido de una reserva inexistente para evitar
      // convertir este endpoint en un oráculo de identificadores.
      return errorResponse('RESERVATION_NOT_FOUND', 'Reserva no encontrada.', 404);
    }

    if (!hasSupabaseAdminConfig()) {
      return errorResponse(
        'CONFIGURATION_ERROR',
        'El estado de la reserva no está disponible.',
        503,
        true,
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from('reservas')
      .select(
        'id, estado, estado_pago, requiere_revision, fecha, hold_expires_at, checkout_url',
      )
      .eq('id', reservaId)
      .maybeSingle();

    if (error) {
      console.error('Error consultando estado público de reserva', { code: error.code });
      return errorResponse('DATABASE_ERROR', 'No se pudo consultar la reserva.', 503, true);
    }
    if (!data) {
      return errorResponse('RESERVATION_NOT_FOUND', 'Reserva no encontrada.', 404);
    }

    const reserva = data as Pick<
      Reserva,
      | 'id'
      | 'estado'
      | 'estado_pago'
      | 'requiere_revision'
      | 'fecha'
      | 'hold_expires_at'
      | 'checkout_url'
    >;
    const canRetryCheckout =
      reservasOnlineHabilitadas() &&
      reserva.estado === 'pendiente' &&
      !reserva.requiere_revision &&
      new Date(reserva.hold_expires_at).getTime() > Date.now() &&
      Boolean(reserva.checkout_url);
    return NextResponse.json(
      {
        reservaId: reserva.id,
        estado: reserva.estado,
        estadoPago: reserva.estado_pago,
        requiereRevision: reserva.requiere_revision,
        fecha: reserva.fecha,
        holdExpiresAt: reserva.hold_expires_at,
        ...(canRetryCheckout ? { checkoutUrl: reserva.checkout_url } : {}),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof MercadoPagoIntegrationError && error.code === 'MP_CONFIG_ERROR') {
      console.error('Configuración inválida del token de estado de reserva', { code: error.code });
      return errorResponse(
        'CONFIGURATION_ERROR',
        'El estado de la reserva no está disponible.',
        503,
        true,
      );
    }
    console.error('Error inesperado consultando estado de reserva', error);
    return errorResponse('INTERNAL_ERROR', 'No se pudo consultar la reserva.', 500, true);
  }
}
