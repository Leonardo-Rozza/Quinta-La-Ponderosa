import crypto from 'node:crypto';
import { Chargeback, MerchantOrder, Payment, Preference } from 'mercadopago';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock('./reservas/inbox-outbox', () => ({
  encolarEmail: vi.fn(),
  registrarEventoWebhook: vi.fn(),
}));

import {
  buildWebhookUrl,
  crearPreferenciaMercadoPago,
  crearTokenEstadoReserva,
  decidirConciliacionVacia,
  getNextReconciliationAt,
  getReconciliationRetryMinutes,
  mapPaymentStatus,
  MercadoPagoIntegrationError,
  obtenerPagoMercadoPago,
  validarTokenEstadoReserva,
  validarWebhookMercadoPago,
} from './mercado-pago';

const SECRET = 'webhook-secret-used-only-in-unit-tests';
const STATUS_SECRET = 'status-secret-with-at-least-thirty-two-bytes';

function signature(dataId: string, requestId: string, timestamp: number) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const digest = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
  return `ts=${timestamp},v1=${digest}`;
}

describe('integración defensiva de Mercado Pago', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('MP_WEBHOOK_SECRET', SECRET);
    vi.stubEnv('RESERVA_STATUS_SECRET', STATUS_SECRET);
    vi.stubEnv('MP_ACCESS_TOKEN', 'TEST-unit-test-token');
    vi.stubEnv('MP_COLLECTOR_ID', '123456789');
    vi.stubEnv('MP_LIVE_MODE', 'false');
    vi.stubEnv('SITE_URL', 'http://localhost:3000');
    vi.stubEnv('MP_RECONCILIATION_GRACE_MINUTES', '');
    vi.stubEnv('MP_EMPTY_RECHECK_MINUTES', '');
    vi.stubEnv('RESERVA_RECONCILIATION_RETRY_MINUTES', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('valida firma reciente y exige igualdad exacta entre query y payload', () => {
    const timestamp = Math.floor(Date.now() / 1_000);
    const requestId = 'request-123';
    const dataId = 'Payment-AbC-123';
    const body = {
      id: 991,
      type: 'payment',
      action: 'payment.updated',
      data: { id: dataId },
    };

    expect(
      validarWebhookMercadoPago({
        body,
        dataId,
        requestId,
        signature: signature(dataId, requestId, timestamp),
      }),
    ).toMatchObject({
      resourceId: dataId,
      topic: 'payment',
      action: 'payment.updated',
    });

    expect(() =>
      validarWebhookMercadoPago({
        body,
        dataId: dataId.toLowerCase(),
        requestId,
        signature: signature(dataId.toLowerCase(), requestId, timestamp),
      }),
    ).toThrowError(MercadoPagoIntegrationError);
  });

  it('rechaza firmas vencidas y falla cerrado en deploy sin secreto', () => {
    const dataId = '123';
    const requestId = 'request-456';
    const oldTimestamp = Math.floor(Date.now() / 1_000) - 601;
    const body = { id: 1, type: 'payment', data: { id: dataId } };

    expect(() =>
      validarWebhookMercadoPago({
        body,
        dataId,
        requestId,
        signature: signature(dataId, requestId, oldTimestamp),
      }),
    ).toThrowError(MercadoPagoIntegrationError);

    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('MP_WEBHOOK_SECRET', '');
    expect(() =>
      validarWebhookMercadoPago({ body, dataId, requestId, signature: null }),
    ).toThrowError(/MP_WEBHOOK_SECRET/);
  });

  it('autentica el tópico separado de contracargos', () => {
    const timestamp = Math.floor(Date.now() / 1_000);
    const dataId = 'chargeback-123';
    const requestId = 'request-chargeback';

    expect(
      validarWebhookMercadoPago({
        body: {
          id: 77,
          type: 'topic_chargebacks_wh',
          action: 'chargebacks.updated',
          data: { id: dataId },
        },
        dataId,
        requestId,
        signature: signature(dataId, requestId, timestamp),
      }),
    ).toMatchObject({
      topic: 'topic_chargebacks_wh',
      resourceId: dataId,
    });
  });

  it('liga el token público al propósito y al ID con comparación segura', () => {
    const reservaId = '11111111-1111-4111-8111-111111111111';
    const otherId = '22222222-2222-4222-8222-222222222222';
    const token = crearTokenEstadoReserva(reservaId);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(validarTokenEstadoReserva(reservaId, token)).toBe(true);
    expect(validarTokenEstadoReserva(otherId, token)).toBe(false);
    expect(validarTokenEstadoReserva(reservaId, `${token}x`)).toBe(false);
  });

  it('crea una preferencia expirable y usa el checkout sandbox en modo test', async () => {
    const create = vi.spyOn(Preference.prototype, 'create').mockResolvedValue({
      id: 'pref-123',
      init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-123',
      sandbox_init_point:
        'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-123',
      collector_id: 123456789,
      api_response: {
        status: 201,
        headers: ['content-type', ['application/json']],
      },
    });
    const holdExpiresAt = new Date(Date.now() + 30 * 60 * 1_000).toISOString();

    const result = await crearPreferenciaMercadoPago({
      id: '11111111-1111-4111-8111-111111111111',
      bookingRequestId: '22222222-2222-4222-8222-222222222222',
      fecha: '2026-09-01',
      cantidadPersonas: 12,
      montoSena: 150_000,
      nombreCompleto: 'Ada Lovelace',
      email: 'ada@example.com',
      holdExpiresAt,
    });

    expect(result.checkoutUrl).toContain('sandbox.mercadopago.com.ar');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          expires: true,
          expiration_date_to: holdExpiresAt,
          external_reference: '11111111-1111-4111-8111-111111111111',
          notification_url: 'http://localhost:3000/api/webhook?source_news=webhooks',
          payment_methods: {
            excluded_payment_types: [{ id: 'ticket' }],
          },
        }),
        requestOptions: {
          idempotencyKey: '22222222-2222-4222-8222-222222222222',
        },
      }),
    );
  });

  it('falla cerrado si Mercado Pago omite el collector de la preferencia', async () => {
    vi.spyOn(Preference.prototype, 'create').mockResolvedValue({
      id: 'pref-without-collector',
      init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=missing',
      sandbox_init_point:
        'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=missing',
      api_response: {
        status: 201,
        headers: ['content-type', ['application/json']],
      },
    });

    await expect(
      crearPreferenciaMercadoPago({
        id: '11111111-1111-4111-8111-111111111111',
        bookingRequestId: '22222222-2222-4222-8222-222222222222',
        fecha: '2026-09-01',
        cantidadPersonas: 12,
        montoSena: 150_000,
        nombreCompleto: 'Ada Lovelace',
        email: 'ada@example.com',
        holdExpiresAt: new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
      }),
    ).rejects.toMatchObject({
      code: 'MP_RESOURCE_MISMATCH',
      retryable: false,
    });
  });

  it('construye el webhook Webhooks y normaliza estados terminales', () => {
    expect(buildWebhookUrl('https://quinta.example.com')).toBe(
      'https://quinta.example.com/api/webhook?source_news=webhooks',
    );
    expect(mapPaymentStatus('approved')).toBe('aprobado');
    expect(mapPaymentStatus('refunded')).toBe('reembolsado');
    expect(mapPaymentStatus('charged_back')).toBe('contracargo');
    expect(mapPaymentStatus('in_process')).toBe('pendiente');
  });

  it('exige gracia y dos búsquedas vacías separadas antes de cancelar', () => {
    const hold = Date.parse('2026-08-13T20:00:00.000Z');
    const firstEmpty = new Date(hold + 30 * 60 * 1_000).toISOString();

    expect(
      decidirConciliacionVacia({
        holdExpiresAt: new Date(hold).toISOString(),
        firstEmptyAt: null,
        now: hold + 29 * 60 * 1_000,
      }),
    ).toBe('esperar_gracia');
    expect(
      decidirConciliacionVacia({
        holdExpiresAt: new Date(hold).toISOString(),
        firstEmptyAt: null,
        now: hold + 30 * 60 * 1_000,
      }),
    ).toBe('registrar_primera');
    expect(
      decidirConciliacionVacia({
        holdExpiresAt: new Date(hold).toISOString(),
        firstEmptyAt: firstEmpty,
        now: hold + 44 * 60 * 1_000,
      }),
    ).toBe('esperar_reintento');
    expect(
      decidirConciliacionVacia({
        holdExpiresAt: new Date(hold).toISOString(),
        firstEmptyAt: firstEmpty,
        now: hold + 45 * 60 * 1_000,
      }),
    ).toBe('cancelar');
  });

  it('reprograma conciliaciones con un intervalo configurable nunca menor a 15 minutos', () => {
    const now = Date.parse('2026-08-13T20:00:00.000Z');

    vi.stubEnv('RESERVA_RECONCILIATION_RETRY_MINUTES', '5');
    expect(getReconciliationRetryMinutes()).toBe(15);
    expect(getNextReconciliationAt(now)).toBe('2026-08-13T20:15:00.000Z');

    vi.stubEnv('RESERVA_RECONCILIATION_RETRY_MINUTES', '30');
    expect(getReconciliationRetryMinutes()).toBe(30);
    expect(getNextReconciliationAt(now)).toBe('2026-08-13T20:30:00.000Z');
  });

  it('prioriza una cobertura aprobada neta sobre la reversión de otro intento', async () => {
    vi.spyOn(Payment.prototype, 'get').mockResolvedValue({
      id: 101,
      status: 'refunded',
      transaction_amount: 150_000,
      transaction_amount_refunded: 150_000,
      currency_id: 'ARS',
      collector_id: 123456789,
      live_mode: false,
      external_reference: '11111111-1111-4111-8111-111111111111',
      order: { id: 'order-1' },
    } as never);
    vi.spyOn(MerchantOrder.prototype, 'get').mockResolvedValue({
      id: 1,
      preference_id: 'pref-123',
      external_reference: '11111111-1111-4111-8111-111111111111',
      collector: { id: 123456789 },
      is_test: true,
      payments: [
        {
          id: 101,
          status: 'approved',
          transaction_amount: 150_000,
          amount_refunded: 0,
          currency_id: 'ARS',
          date_created: '2026-08-13T20:00:00.000Z',
        },
        {
          id: 202,
          status: 'approved',
          transaction_amount: 150_000,
          amount_refunded: 0,
          currency_id: 'ARS',
          date_created: '2026-08-13T20:05:00.000Z',
        },
      ],
    } as never);

    const result = await obtenerPagoMercadoPago({
      topic: 'payment',
      resourceId: '101',
    });

    expect(result).toMatchObject({
      id: '202',
      estado: 'aprobado',
      transactionAmount: 150_000,
      hasReversal: true,
    });
  });

  it('resuelve un webhook de contracargo hasta su payment_id', async () => {
    vi.spyOn(Chargeback.prototype, 'get').mockResolvedValue({
      id: 'chargeback-1',
      payment_id: 303,
      currency_id: 'ARS',
    });
    vi.spyOn(Payment.prototype, 'get').mockResolvedValue({
      id: 303,
      status: 'approved',
      transaction_amount: 150_000,
      currency_id: 'ARS',
      collector_id: 123456789,
      live_mode: false,
      external_reference: '11111111-1111-4111-8111-111111111111',
    } as never);

    const result = await obtenerPagoMercadoPago({
      topic: 'topic_chargebacks_wh',
      resourceId: 'chargeback-1',
    });

    expect(result).toMatchObject({
      id: '303',
      estado: 'contracargo',
      hasReversal: true,
    });
  });
});
