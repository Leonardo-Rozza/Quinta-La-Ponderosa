import { createApiError, toApiErrorBody, type ApiErrorCode } from '@/lib/api-errors';
import {
  getReconciliationGraceMinutes,
  isDeployedEnvironment,
  reconciliarReservaMercadoPago,
  reprogramarConciliacionReserva,
  validarConfiguracionCheckoutMercadoPago,
} from '@/lib/mercado-pago';
import { getSupabaseAdmin, hasSupabaseAdminConfig, type Reserva } from '@/lib/supabase';
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 50;
const RECONCILIATION_CONCURRENCY = 3;

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

function parseBatchSize() {
  const parsed = Number.parseInt(process.env.RESERVA_CLEANUP_BATCH_SIZE ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_BATCH_SIZE
    ? parsed
    : DEFAULT_BATCH_SIZE;
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

async function reconcileBatch(reservas: Reserva[]) {
  const results: Array<{
    reservaId: string;
    result?: Awaited<ReturnType<typeof reconciliarReservaMercadoPago>>['result'];
    failed?: true;
  }> = [];

  for (let offset = 0; offset < reservas.length; offset += RECONCILIATION_CONCURRENCY) {
    const batch = reservas.slice(offset, offset + RECONCILIATION_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (reserva) => {
        try {
          return await reconciliarReservaMercadoPago(reserva);
        } catch (error) {
          try {
            await reprogramarConciliacionReserva(reserva.id);
          } catch (scheduleError) {
            console.error('No se pudo reprogramar una conciliación fallida', {
              reservaId: reserva.id,
              error:
                scheduleError instanceof Error ? scheduleError.message : 'Error desconocido',
            });
          }
          throw error;
        }
      }),
    );

    settled.forEach((entry, index) => {
      const reservaId = batch[index]?.id ?? 'unknown';
      if (entry.status === 'fulfilled') {
        results.push({ reservaId, result: entry.value.result });
      } else {
        console.error('No se pudo conciliar una reserva vencida', {
          reservaId,
          error: entry.reason instanceof Error ? entry.reason.message : 'Error desconocido',
        });
        results.push({ reservaId, failed: true });
      }
    });
  }

  return results;
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
    validarConfiguracionCheckoutMercadoPago();
  } catch (error) {
    console.error('Configuración inválida para conciliar Mercado Pago', {
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
    return errorResponse(
      'CONFIGURATION_ERROR',
      'Mercado Pago no está configurado para conciliar reservas.',
      503,
      true,
    );
  }

  const batchSize = parseBatchSize();
  const now = Date.now();
  const reconciliationCutoff = new Date(
    now - getReconciliationGraceMinutes() * 60 * 1_000,
  ).toISOString();
  const reconciliationDueAt = new Date(now).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('reservas')
    .select('*')
    .eq('estado', 'pendiente')
    .eq('requiere_revision', false)
    .lte('hold_expires_at', reconciliationCutoff)
    .lte('next_reconciliation_at', reconciliationDueAt)
    .order('next_reconciliation_at', { ascending: true })
    .order('hold_expires_at', { ascending: true })
    .limit(batchSize);

  if (error) {
    console.error('No se pudieron leer los holds vencidos', { code: error.code });
    return errorResponse('DATABASE_ERROR', 'No se pudieron conciliar las reservas.', 503, true);
  }

  const results = await reconcileBatch(data ?? []);
  const count = (result: (typeof results)[number]['result']) =>
    results.filter((entry) => entry.result === result).length;

  return NextResponse.json(
    {
      ok: true,
      revisadas: results.length,
      primerasBusquedasVacias: count('primera_busqueda_vacia'),
      canceladas:
        count('cancelada_sin_pago') + count('cancelada_con_intentos'),
      confirmadas: count('confirmada'),
      requierenRevision: count('requiere_revision'),
      pendientes: count('pago_pendiente'),
      fallidas: results.filter((entry) => entry.failed).length,
      puedeHaberMas: (data?.length ?? 0) === batchSize,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
