import {
  Chargeback,
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  MerchantOrder,
  Payment,
  Preference,
  WebhookSignatureValidator,
} from 'mercadopago';
import crypto from 'node:crypto';
import {
  encolarEmail,
  encolarRevisionReserva,
  registrarEventoWebhook,
} from './reservas/inbox-outbox';
import { decidirTransicionPago } from './reservas/transitions';
import type { PagoObservado, ReservaStateSnapshot } from './reservas/types';
import {
  getSupabaseAdmin,
  type Json,
  type MpWebhookEvent,
  type Reserva,
} from './supabase';

export const MP_CURRENCY = 'ARS';
export const MP_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RECONCILIATION_GRACE_MINUTES = 30;
const DEFAULT_EMPTY_RECHECK_MINUTES = 15;
const DEFAULT_RECONCILIATION_RETRY_MINUTES = 15;
const MIN_RECONCILIATION_WINDOW_MINUTES = 15;
const MAX_RECONCILIATION_WINDOW_MINUTES = 24 * 60;
const WEBHOOK_TOPICS = new Set([
  'payment',
  'topic_merchant_order_wh',
  'topic_chargebacks_wh',
]);

export type MpPayment = Awaited<ReturnType<Payment['get']>>;
export type MpMerchantOrder = Awaited<ReturnType<MerchantOrder['get']>>;
export type MpPreference = Awaited<ReturnType<Preference['create']>>;
export type MpPaymentSearchResult = NonNullable<
  Awaited<ReturnType<Payment['search']>>['results']
>[number];

export type EstadoPagoMercadoPago =
  | 'pendiente'
  | 'aprobado'
  | 'rechazado'
  | 'reembolsado'
  | 'contracargo';

export interface ReservaParaPreferencia {
  id: string;
  bookingRequestId: string;
  fecha: string;
  cantidadPersonas: number;
  montoSena: number;
  nombreCompleto: string;
  email: string;
  holdExpiresAt: string;
}

export interface PreferenciaCreada {
  id: string;
  checkoutUrl: string;
  sandboxCheckoutUrl: string | null;
  collectorId: number | null;
}

export interface WebhookMercadoPago {
  eventKey: string;
  eventId: string;
  resourceId: string;
  requestId: string | null;
  topic: 'payment' | 'topic_merchant_order_wh' | 'topic_chargebacks_wh';
  action: string | null;
  signatureTimestamp: string | null;
  payload: Record<string, unknown>;
}

export interface PagoMercadoPagoObservado {
  id: string;
  estado: EstadoPagoMercadoPago;
  preferenceId: string | null;
  merchantOrderId: string | null;
  reservaId: string | null;
  currencyId: string;
  transactionAmount: number;
  collectorId: number | null;
  liveMode: boolean | null;
  hasReversal: boolean;
  payment: MpPayment | null;
  merchantOrder: MpMerchantOrder | null;
}

export class MercadoPagoIntegrationError extends Error {
  constructor(
    public readonly code:
      | 'MP_CONFIG_ERROR'
      | 'MP_INVALID_WEBHOOK'
      | 'MP_UNSUPPORTED_TOPIC'
      | 'MP_RESOURCE_MISMATCH'
      | 'MP_INVALID_RESOURCE'
      | 'MP_EXTERNAL_ERROR',
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'MercadoPagoIntegrationError';
  }
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readReconciliationMinutes(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) &&
    parsed >= MIN_RECONCILIATION_WINDOW_MINUTES &&
    parsed <= MAX_RECONCILIATION_WINDOW_MINUTES
    ? parsed
    : fallback;
}

export function getReconciliationGraceMinutes() {
  return readReconciliationMinutes(
    process.env.MP_RECONCILIATION_GRACE_MINUTES,
    DEFAULT_RECONCILIATION_GRACE_MINUTES,
  );
}

export function getEmptyRecheckMinutes() {
  return readReconciliationMinutes(
    process.env.MP_EMPTY_RECHECK_MINUTES,
    DEFAULT_EMPTY_RECHECK_MINUTES,
  );
}

export function getReconciliationRetryMinutes() {
  return readReconciliationMinutes(
    process.env.RESERVA_RECONCILIATION_RETRY_MINUTES,
    DEFAULT_RECONCILIATION_RETRY_MINUTES,
  );
}

export function getNextReconciliationAt(now = Date.now()) {
  return new Date(now + getReconciliationRetryMinutes() * 60 * 1_000).toISOString();
}

export function decidirConciliacionVacia(input: {
  holdExpiresAt: string;
  firstEmptyAt: string | null;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const holdExpiresAt = new Date(input.holdExpiresAt).getTime();
  if (!Number.isFinite(holdExpiresAt)) {
    throw new MercadoPagoIntegrationError(
      'MP_INVALID_RESOURCE',
      'The reservation hold expiration is invalid.',
    );
  }
  if (now < holdExpiresAt + getReconciliationGraceMinutes() * 60 * 1_000) {
    return 'esperar_gracia' as const;
  }
  if (!input.firstEmptyAt) return 'registrar_primera' as const;

  const firstEmptyAt = new Date(input.firstEmptyAt).getTime();
  if (!Number.isFinite(firstEmptyAt)) {
    throw new MercadoPagoIntegrationError(
      'MP_INVALID_RESOURCE',
      'The empty reconciliation timestamp is invalid.',
    );
  }
  if (now < firstEmptyAt + getEmptyRecheckMinutes() * 60 * 1_000) {
    return 'esperar_reintento' as const;
  }
  return 'cancelar' as const;
}

export function isDeployedEnvironment() {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new MercadoPagoIntegrationError('MP_CONFIG_ERROR', `${name} is required.`);
  }
  return value;
}

function getReservaStatusSecret() {
  const configured = process.env.RESERVA_STATUS_SECRET?.trim();
  if (configured && Buffer.byteLength(configured) >= 32) return configured;
  if (configured) {
    throw new MercadoPagoIntegrationError(
      'MP_CONFIG_ERROR',
      'RESERVA_STATUS_SECRET must contain at least 32 bytes.',
    );
  }
  if (isDeployedEnvironment()) {
    throw new MercadoPagoIntegrationError(
      'MP_CONFIG_ERROR',
      'RESERVA_STATUS_SECRET is required in deployed environments.',
    );
  }
  return 'development-only-reserva-status-secret';
}

export function crearTokenEstadoReserva(reservaId: string) {
  return crypto
    .createHmac('sha256', getReservaStatusSecret())
    .update(`reserva-status:v1:${reservaId}`)
    .digest('base64url');
}

export function validarTokenEstadoReserva(reservaId: string, token: string) {
  const expected = Buffer.from(crearTokenEstadoReserva(reservaId));
  const received = Buffer.from(token);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function buildBackUrl(siteUrl: string, pathname: string, reservaId: string) {
  const url = new URL(pathname, siteUrl);
  url.searchParams.set('reservaId', reservaId);
  url.searchParams.set('token', crearTokenEstadoReserva(reservaId));
  return url.toString();
}

export function getExpectedLiveMode(): boolean {
  const configured = process.env.MP_LIVE_MODE?.trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;

  if (isDeployedEnvironment()) {
    throw new MercadoPagoIntegrationError(
      'MP_CONFIG_ERROR',
      'MP_LIVE_MODE must be explicitly configured in deployed environments.',
    );
  }

  return false;
}

export function getExpectedCollectorId(): number {
  const raw = process.env.MP_COLLECTOR_ID?.trim();
  const collectorId = Number(raw);

  if (raw && Number.isSafeInteger(collectorId) && collectorId > 0) {
    return collectorId;
  }

  throw new MercadoPagoIntegrationError(
    'MP_CONFIG_ERROR',
    'MP_COLLECTOR_ID must be configured with a positive integer.',
  );
}

export function getSiteUrl() {
  const raw =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (isDeployedEnvironment() ? '' : 'http://localhost:3000');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MercadoPagoIntegrationError('MP_CONFIG_ERROR', 'SITE_URL must be a valid URL.');
  }

  if (isDeployedEnvironment() && url.protocol !== 'https:') {
    throw new MercadoPagoIntegrationError(
      'MP_CONFIG_ERROR',
      'SITE_URL must use HTTPS in deployed environments.',
    );
  }

  return url.toString().replace(/\/+$/, '');
}

export function getMercadoPagoClient() {
  return new MercadoPagoConfig({
    accessToken: requiredEnv('MP_ACCESS_TOKEN'),
    options: {
      timeout: readPositiveInteger(process.env.MP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      maxRetries: 2,
      initialDelay: 200,
      maxDelay: 1_500,
      jitter: true,
    },
  });
}

export function validarConfiguracionCheckoutMercadoPago() {
  requiredEnv('MP_ACCESS_TOKEN');
  if (isDeployedEnvironment()) requiredEnv('MP_WEBHOOK_SECRET');
  getExpectedCollectorId();
  getExpectedLiveMode();
  const siteUrl = getSiteUrl();
  crearTokenEstadoReserva('00000000-0000-4000-8000-000000000000');
  buildWebhookUrl(siteUrl);
}

export function buildWebhookUrl(siteUrl = getSiteUrl()) {
  const url = new URL('/api/webhook', siteUrl);
  url.searchParams.set('source_news', 'webhooks');
  return url.toString();
}

export async function crearPreferenciaMercadoPago(
  reserva: ReservaParaPreferencia,
): Promise<PreferenciaCreada> {
  const siteUrl = getSiteUrl();
  const expectedCollectorId = getExpectedCollectorId();
  const expectedLiveMode = getExpectedLiveMode();
  const holdExpiresAt = new Date(reserva.holdExpiresAt);
  const now = new Date();

  if (Number.isNaN(holdExpiresAt.getTime()) || holdExpiresAt <= now) {
    throw new MercadoPagoIntegrationError(
      'MP_CONFIG_ERROR',
      'The reservation hold expiration must be in the future.',
    );
  }

  const preference = new Preference(getMercadoPagoClient());
  let created: MpPreference;

  try {
    created = await preference.create({
      body: {
        items: [
          {
            id: reserva.id,
            title: `Seña La Ponderosa - ${reserva.fecha}`,
            description: `Reserva para ${reserva.cantidadPersonas} personas`,
            quantity: 1,
            currency_id: MP_CURRENCY,
            unit_price: reserva.montoSena,
          },
        ],
        payer: {
          name: reserva.nombreCompleto.split(' ')[0] || 'Cliente',
          surname: reserva.nombreCompleto.split(' ').slice(1).join(' '),
          email: reserva.email,
        },
        back_urls: {
          success: buildBackUrl(siteUrl, '/reserva/confirmada', reserva.id),
          failure: buildBackUrl(siteUrl, '/reserva/error', reserva.id),
          pending: buildBackUrl(siteUrl, '/reserva/pendiente', reserva.id),
        },
        ...(siteUrl.startsWith('https://') ? { auto_return: 'approved' } : {}),
        binary_mode: true,
        expires: true,
        expiration_date_from: now.toISOString(),
        expiration_date_to: holdExpiresAt.toISOString(),
        external_reference: reserva.id,
        metadata: {
          reserva_id: reserva.id,
          booking_request_id: reserva.bookingRequestId,
          fecha: reserva.fecha,
        },
        notification_url: buildWebhookUrl(siteUrl),
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
        },
      },
      requestOptions: {
        idempotencyKey: reserva.bookingRequestId,
      },
    });
  } catch {
    throw new MercadoPagoIntegrationError(
      'MP_EXTERNAL_ERROR',
      'Mercado Pago preference creation failed.',
      true,
    );
  }

  const selectedCheckoutUrl = expectedLiveMode
    ? created.init_point
    : created.sandbox_init_point;

  if (!created.id || !selectedCheckoutUrl) {
    throw new MercadoPagoIntegrationError(
      'MP_INVALID_RESOURCE',
      'Mercado Pago returned an incomplete preference for the configured mode.',
      true,
    );
  }

  if (created.collector_id !== expectedCollectorId) {
    throw new MercadoPagoIntegrationError(
      'MP_RESOURCE_MISMATCH',
      'The preference collector is missing or does not match MP_COLLECTOR_ID.',
    );
  }

  return {
    id: created.id,
    checkoutUrl: selectedCheckoutUrl,
    sandboxCheckoutUrl: created.sandbox_init_point ?? null,
    collectorId: created.collector_id ?? null,
  };
}

function getString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function getBodyResourceId(body: Record<string, unknown>) {
  if (!body.data || typeof body.data !== 'object') return null;
  return getString((body.data as Record<string, unknown>).id);
}

function parseSignatureTimestamp(signature: string | null) {
  const match = signature?.match(/(?:^|,)\s*ts=(\d+)\s*(?:,|$)/i);
  if (!match?.[1]) return null;
  const seconds = Number(match[1]);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1_000).toISOString();
}

export function validarWebhookMercadoPago(input: {
  body: Record<string, unknown>;
  dataId: string | null;
  requestId: string | null;
  signature: string | null;
}): WebhookMercadoPago {
  const { body, dataId, requestId, signature } = input;
  if (!dataId) {
    throw new MercadoPagoIntegrationError(
      'MP_INVALID_WEBHOOK',
      'The signed data.id query parameter is required.',
    );
  }

  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret && isDeployedEnvironment()) {
    throw new MercadoPagoIntegrationError(
      'MP_CONFIG_ERROR',
      'MP_WEBHOOK_SECRET is required in deployed environments.',
    );
  }

  if (secret) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: signature,
        xRequestId: requestId,
        dataId,
        secret,
        toleranceSeconds: readPositiveInteger(
          process.env.MP_WEBHOOK_TOLERANCE_SECONDS,
          MP_WEBHOOK_TOLERANCE_SECONDS,
        ),
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new MercadoPagoIntegrationError(
          'MP_INVALID_WEBHOOK',
          `Invalid Mercado Pago webhook signature: ${error.reason}.`,
        );
      }
      throw error;
    }
  }

  const bodyResourceId = getBodyResourceId(body);
  if (bodyResourceId !== dataId) {
    throw new MercadoPagoIntegrationError(
      'MP_RESOURCE_MISMATCH',
      'The signed resource ID does not match the webhook payload.',
    );
  }

  const topic = getString(body.type);
  if (!topic || !WEBHOOK_TOPICS.has(topic)) {
    throw new MercadoPagoIntegrationError(
      'MP_UNSUPPORTED_TOPIC',
      'Unsupported Mercado Pago webhook topic.',
    );
  }

  const action = getString(body.action);
  const eventId = getString(body.id) ?? requestId ?? `${topic}:${dataId}:${action ?? 'unknown'}`;
  const eventKey = [topic, eventId, dataId, action ?? ''].join(':');

  return {
    eventKey,
    eventId,
    resourceId: dataId,
    requestId,
    topic: topic as WebhookMercadoPago['topic'],
    action,
    signatureTimestamp: parseSignatureTimestamp(signature),
    payload: body,
  };
}

function toTimestamp(value: string | undefined) {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestPayment(
  order: MpMerchantOrder | null,
  predicate: (status: string | undefined) => boolean,
) {
  return [...(order?.payments ?? [])]
    .filter((candidate) => candidate.id && predicate(candidate.status))
    .sort(
      (left, right) =>
        toTimestamp(right.last_modified ?? right.date_created) -
        toTimestamp(left.last_modified ?? left.date_created),
    )[0];
}

export function mapPaymentStatus(status: string | undefined): EstadoPagoMercadoPago {
  switch (status) {
    case 'approved':
      return 'aprobado';
    case 'refunded':
      return 'reembolsado';
    case 'charged_back':
      return 'contracargo';
    case 'rejected':
    case 'cancelled':
      return 'rechazado';
    default:
      return 'pendiente';
  }
}

function directPaymentReversal(
  payment: MpPayment | null,
  forced: 'reembolsado' | 'contracargo' | null,
) {
  if (forced) return forced;
  if (payment?.status === 'charged_back') return 'contracargo';
  if (payment?.status === 'refunded' || (payment?.transaction_amount_refunded ?? 0) > 0) {
    return 'reembolsado';
  }
  return null;
}

function latestReversedOrderPayment(order: MpMerchantOrder | null) {
  return [...(order?.payments ?? [])]
    .filter(
      (candidate) =>
        candidate.id &&
        (candidate.status === 'refunded' ||
          candidate.status === 'charged_back' ||
          (candidate.amount_refunded ?? 0) > 0),
    )
    .sort(
      (left, right) =>
        toTimestamp(right.last_modified ?? right.date_created) -
        toTimestamp(left.last_modified ?? left.date_created),
    )[0];
}

function approvedCoverage(
  order: MpMerchantOrder | null,
  direct: MpPayment | null,
  directReversal: 'reembolsado' | 'contracargo' | null,
) {
  const directId = direct?.id ? String(direct.id) : null;
  let amount = 0;
  let latestId: string | null = null;
  let latestTimestamp = 0;
  let currencyId = '';
  let directWasInOrder = false;

  for (const candidate of order?.payments ?? []) {
    if (!candidate.id || candidate.status !== 'approved') continue;
    const candidateId = String(candidate.id);
    const isDirect = directId === candidateId;
    if (isDirect) directWasInOrder = true;
    if (isDirect && directReversal) continue;

    const net = isDirect
      ? Math.max(
          0,
          (direct?.transaction_amount ?? 0) -
            (direct?.transaction_amount_refunded ?? 0),
        )
      : Math.max(
          0,
          (candidate.transaction_amount ?? 0) - (candidate.amount_refunded ?? 0),
        );
    if (net <= 0) continue;
    amount += net;

    const timestamp = toTimestamp(candidate.last_modified ?? candidate.date_created);
    if (!latestId || timestamp >= latestTimestamp) {
      latestId = candidateId;
      latestTimestamp = timestamp;
      currencyId = candidate.currency_id ?? currencyId;
    }
  }

  if (
    direct?.id &&
    direct.status === 'approved' &&
    !directReversal &&
    !directWasInOrder
  ) {
    const net = Math.max(
      0,
      (direct.transaction_amount ?? 0) - (direct.transaction_amount_refunded ?? 0),
    );
    if (net > 0) {
      amount += net;
      const timestamp = toTimestamp(direct.date_last_updated ?? direct.date_created);
      if (!latestId || timestamp >= latestTimestamp) {
        latestId = String(direct.id);
        currencyId = direct.currency_id ?? currencyId;
      }
    }
  }

  return { amount, paymentId: latestId, currencyId };
}

function getReservaId(payment: MpPayment | null, order: MpMerchantOrder | null) {
  const fromPayment = getString(payment?.external_reference);
  const fromOrder = getString(order?.external_reference);
  const metadata = payment?.metadata;
  const fromMetadata =
    metadata && typeof metadata === 'object'
      ? getString((metadata as Record<string, unknown>).reserva_id)
      : null;

  const identifiers = [fromPayment, fromOrder, fromMetadata].filter(
    (value): value is string => Boolean(value),
  );
  if (new Set(identifiers).size > 1) {
    throw new MercadoPagoIntegrationError(
      'MP_RESOURCE_MISMATCH',
      'Mercado Pago references disagree about the reservation.',
    );
  }
  return identifiers[0] ?? null;
}

async function getMerchantOrderFromPayment(payment: MpPayment) {
  if (!payment.order?.id) return null;
  try {
    return await new MerchantOrder(getMercadoPagoClient()).get({
      merchantOrderId: String(payment.order.id),
    });
  } catch {
    throw new MercadoPagoIntegrationError(
      'MP_EXTERNAL_ERROR',
      'Mercado Pago merchant order lookup failed.',
      true,
    );
  }
}

export async function obtenerPagoMercadoPago(input: {
  topic: WebhookMercadoPago['topic'];
  resourceId: string;
}): Promise<PagoMercadoPagoObservado> {
  let payment: MpPayment | null = null;
  let merchantOrder: MpMerchantOrder | null = null;
  let forcedReversal: 'reembolsado' | 'contracargo' | null = null;

  try {
    if (input.topic === 'payment') {
      payment = await new Payment(getMercadoPagoClient()).get({ id: input.resourceId });
      merchantOrder = await getMerchantOrderFromPayment(payment);
    } else if (input.topic === 'topic_merchant_order_wh') {
      merchantOrder = await new MerchantOrder(getMercadoPagoClient()).get({
        merchantOrderId: input.resourceId,
      });
    } else {
      const chargeback = await new Chargeback(getMercadoPagoClient()).get({
        id: input.resourceId,
      });
      if (!chargeback.payment_id) {
        throw new MercadoPagoIntegrationError(
          'MP_INVALID_RESOURCE',
          'The chargeback has no related payment yet.',
          true,
        );
      }
      payment = await new Payment(getMercadoPagoClient()).get({
        id: String(chargeback.payment_id),
      });
      if (
        chargeback.currency_id &&
        payment.currency_id &&
        chargeback.currency_id !== payment.currency_id
      ) {
        throw new MercadoPagoIntegrationError(
          'MP_RESOURCE_MISMATCH',
          'The chargeback and payment currencies disagree.',
        );
      }
      forcedReversal = 'contracargo';
      merchantOrder = await getMerchantOrderFromPayment(payment);
    }
  } catch (error) {
    if (error instanceof MercadoPagoIntegrationError) throw error;
    throw new MercadoPagoIntegrationError(
      'MP_EXTERNAL_ERROR',
      'Mercado Pago resource lookup failed.',
      true,
    );
  }

  const directReversal = directPaymentReversal(payment, forcedReversal);
  const directStatus = directReversal ?? mapPaymentStatus(payment?.status);
  const reversed = latestReversedOrderPayment(merchantOrder);
  const coverage = approvedCoverage(merchantOrder, payment, directReversal);
  const reversalPaymentId =
    directReversal && payment?.id
      ? String(payment.id)
      : reversed?.id
        ? String(reversed.id)
        : null;
  const reversalStatus =
    directReversal ??
    (reversed?.status === 'charged_back' ? 'contracargo' : reversed ? 'reembolsado' : null);
  const hasReversal = Boolean(reversalPaymentId);
  let estado = directStatus;
  let paymentId = payment?.id ? String(payment.id) : null;
  let transactionAmount = Math.max(
    0,
    (payment?.transaction_amount ?? 0) - (payment?.transaction_amount_refunded ?? 0),
  );

  if (coverage.amount > 0 && coverage.paymentId) {
    // La cobertura neta aprobada prevalece sobre una reversión de otro intento.
    // Si el total no coincide exactamente, el dominio marca revisión y no libera.
    estado = 'aprobado';
    paymentId = coverage.paymentId;
    transactionAmount = coverage.amount;
  } else if (reversalPaymentId && reversalStatus) {
    estado = reversalStatus;
    paymentId = reversalPaymentId;
    const reversedAmount =
      directReversal && payment?.id && String(payment.id) === reversalPaymentId
        ? Math.max(
            0,
            (payment.transaction_amount ?? 0) -
              (payment.transaction_amount_refunded ?? 0),
          )
        : Math.max(
            0,
            (reversed?.transaction_amount ?? 0) - (reversed?.amount_refunded ?? 0),
          );
    transactionAmount = reversedAmount;
  } else if (merchantOrder) {
    const pending = latestPayment(merchantOrder, (status) =>
      ['pending', 'in_process', 'authorized', 'in_mediation'].includes(status ?? ''),
    );
    const rejected = latestPayment(merchantOrder, (status) =>
      ['rejected', 'cancelled'].includes(status ?? ''),
    );

    if (pending?.id) {
      estado = 'pendiente';
      paymentId = String(pending.id);
      transactionAmount = pending.transaction_amount ?? 0;
    } else if (rejected?.id) {
      estado = 'rechazado';
      paymentId = String(rejected.id);
      transactionAmount = rejected.transaction_amount ?? 0;
    }
  }

  if (!paymentId) {
    throw new MercadoPagoIntegrationError(
      'MP_INVALID_RESOURCE',
      'The Mercado Pago resource has no payment to process.',
      true,
    );
  }

  const currencyId =
    coverage.currencyId ||
    (payment?.currency_id ??
      latestPayment(merchantOrder, (status) => status === 'approved')?.currency_id ??
      latestPayment(merchantOrder, () => true)?.currency_id ??
      '');

  return {
    id: paymentId,
    estado,
    preferenceId: merchantOrder?.preference_id ?? null,
    merchantOrderId: merchantOrder?.id
      ? String(merchantOrder.id)
      : payment?.order?.id
        ? String(payment.order.id)
        : null,
    reservaId: getReservaId(payment, merchantOrder),
    currencyId,
    transactionAmount,
    collectorId: payment?.collector_id ?? merchantOrder?.collector?.id ?? null,
    liveMode:
      payment?.live_mode ??
      (merchantOrder && typeof merchantOrder.is_test === 'boolean'
        ? !merchantOrder.is_test
        : null),
    hasReversal,
    payment,
    merchantOrder,
  };
}

export function validarPagoContraConfiguracion(payment: PagoMercadoPagoObservado) {
  if (payment.collectorId !== getExpectedCollectorId()) {
    throw new MercadoPagoIntegrationError(
      'MP_RESOURCE_MISMATCH',
      'The payment collector does not match MP_COLLECTOR_ID.',
    );
  }
  if (payment.liveMode !== getExpectedLiveMode()) {
    throw new MercadoPagoIntegrationError(
      'MP_RESOURCE_MISMATCH',
      'The payment live mode does not match MP_LIVE_MODE.',
    );
  }
  if (payment.currencyId !== MP_CURRENCY) {
    throw new MercadoPagoIntegrationError(
      'MP_RESOURCE_MISMATCH',
      `The payment currency must be ${MP_CURRENCY}.`,
    );
  }
}

export async function buscarPagosPorReserva(reservaId: string) {
  const pageSize = 100;
  const maxPayments = 500;
  const payments: MpPaymentSearchResult[] = [];

  try {
    const client = new Payment(getMercadoPagoClient());
    let offset = 0;
    let total = 0;

    do {
      const page = await client.search({
        options: {
          external_reference: reservaId,
          sort: 'date_created',
          criteria: 'desc',
          limit: pageSize,
          offset,
        },
      });
      const pageResults = page.results ?? [];
      total = page.paging?.total ?? pageResults.length;

      if (total > maxPayments) {
        throw new MercadoPagoIntegrationError(
          'MP_INVALID_RESOURCE',
          'The reservation has too many payments for automatic reconciliation.',
          true,
        );
      }

      payments.push(...pageResults);
      offset += pageResults.length;
      if (pageResults.length === 0) break;
    } while (offset < total);

    if (payments.length < total) {
      throw new MercadoPagoIntegrationError(
        'MP_EXTERNAL_ERROR',
        'Mercado Pago returned an incomplete payment search.',
        true,
      );
    }

    return payments;
  } catch (error) {
    if (error instanceof MercadoPagoIntegrationError) throw error;
    throw new MercadoPagoIntegrationError(
      'MP_EXTERNAL_ERROR',
      'Mercado Pago payment reconciliation failed.',
      true,
    );
  }
}

export interface ProcesarEventoResult {
  eventId: string;
  status: 'procesado' | 'ignorado' | 'ocupado' | 'diferido';
  reservaId?: string;
  reason?: string;
}

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  return message.replaceAll(/[\r\n\t]+/g, ' ').slice(0, 500);
}

function retryAt(attempt: number) {
  const seconds = Math.min(3_600, 30 * 2 ** Math.max(0, attempt - 1));
  return new Date(Date.now() + seconds * 1_000).toISOString();
}

async function finishEvent(
  event: MpWebhookEvent,
  status: 'procesado' | 'ignorado',
  error: string | null = null,
) {
  const { data, error: updateError } = await getSupabaseAdmin()
    .from('mp_webhook_events')
    .update({
      status,
      error,
      processed_at: new Date().toISOString(),
    })
    .eq('id', event.id)
    .eq('status', 'procesando')
    .eq('attempts', event.attempts)
    .select('id')
    .maybeSingle();

  if (updateError) throw new Error('No se pudo cerrar el evento de Mercado Pago');
  return Boolean(data);
}

async function failEvent(event: MpWebhookEvent, error: unknown) {
  const { data, error: updateError } = await getSupabaseAdmin()
    .from('mp_webhook_events')
    .update({
      status: 'error',
      error: compactError(error),
      next_attempt_at: retryAt(event.attempts),
    })
    .eq('id', event.id)
    .eq('status', 'procesando')
    .eq('attempts', event.attempts)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('No se pudo reprogramar evento de Mercado Pago', {
      eventId: event.id,
      code: updateError.code,
    });
  }
  return Boolean(data);
}

async function claimEvent(eventId: string) {
  const client = getSupabaseAdmin();
  const { data: current, error } = await client
    .from('mp_webhook_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw new Error('No se pudo leer el evento de Mercado Pago');
  if (!current) return { kind: 'missing' as const };
  if (current.status === 'procesado' || current.status === 'ignorado') {
    return { kind: 'finished' as const, event: current };
  }
  if (current.status === 'procesando') return { kind: 'busy' as const, event: current };
  if (new Date(current.next_attempt_at).getTime() > Date.now()) {
    return { kind: 'deferred' as const, event: current };
  }

  const { data: claimed, error: claimError } = await client
    .from('mp_webhook_events')
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

  if (claimError) throw new Error('No se pudo tomar el evento de Mercado Pago');
  return claimed
    ? { kind: 'claimed' as const, event: claimed }
    : { kind: 'busy' as const, event: current };
}

function toPagoObservado(payment: PagoMercadoPagoObservado): PagoObservado {
  return {
    id: payment.id,
    estado: payment.estado,
    preferenceId: payment.preferenceId,
    merchantOrderId: payment.merchantOrderId,
    currencyId: payment.currencyId,
    transactionAmount: payment.transactionAmount,
  };
}

function toSnapshot(reserva: Reserva): ReservaStateSnapshot {
  return {
    estado: reserva.estado,
    estadoPago: reserva.estado_pago,
    mpPaymentId: reserva.mp_payment_id,
    mpPreferenceId: reserva.mp_preference_id,
    montoSena: reserva.monto_sena,
    requiereRevision: reserva.requiere_revision,
    revisionMotivo: reserva.revision_motivo,
  };
}

async function enqueueReservationReview(
  reservaId: string,
  event: MpWebhookEvent,
  payment: PagoMercadoPagoObservado,
  reason: string,
) {
  const queued = await encolarRevisionReserva({
    reservaId,
    sourceKey: [payment.id, payment.estado, reason].join(':'),
    reason,
    paymentId: payment.id,
    eventKey: event.event_key,
  });
  if (!queued.ok) throw new Error(queued.error.message);
}

async function markReservationForReview(
  reserva: Reserva,
  event: MpWebhookEvent,
  payment: PagoMercadoPagoObservado,
  reason: string,
) {
  const normalizedReason = reason.trim().slice(0, 500) || 'Revisión manual requerida';
  const { error } = await getSupabaseAdmin()
    .from('reservas')
    .update({
      requiere_revision: true,
      revision_motivo: normalizedReason,
      mp_last_payment_id: payment.id,
      mp_last_event_id: event.event_key,
      mp_empty_reconciliation_at: null,
    })
    .eq('id', reserva.id);
  if (error) throw new Error('No se pudo marcar la reserva para revisión');
  await enqueueReservationReview(reserva.id, event, payment, normalizedReason);
}

async function applyPaymentTransition(
  initial: Reserva,
  event: MpWebhookEvent,
  payment: PagoMercadoPagoObservado,
) {
  const client = getSupabaseAdmin();
  let reserva = initial;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decision = decidirTransicionPago(toSnapshot(reserva), toPagoObservado(payment));
    if (!decision.ok) {
      await markReservationForReview(reserva, event, payment, decision.error.message);
      return { reserva, action: 'marcar_revision' as const, reason: decision.error.message };
    }

    const update = {
      estado: decision.value.next.estado,
      estado_pago: decision.value.next.estadoPago,
      mp_payment_id: decision.value.next.mpPaymentId,
      mp_last_payment_id: payment.id,
      mp_last_event_id: event.event_key,
      mp_empty_reconciliation_at: null,
      requiere_revision: decision.value.next.requiereRevision,
      revision_motivo: decision.value.next.revisionMotivo,
    };

    const { data: updated, error } = await client
      .from('reservas')
      .update(update)
      .eq('id', reserva.id)
      .eq('estado', reserva.estado)
      .eq('estado_pago', reserva.estado_pago)
      .eq('requiere_revision', reserva.requiere_revision)
      .select()
      .maybeSingle();

    if (error?.code === '23514') {
      const { data: reloaded, error: reloadError } = await client
        .from('reservas')
        .select('*')
        .eq('id', reserva.id)
        .maybeSingle();
      if (reloadError || !reloaded) {
        throw new Error('No se pudo revalidar la reserva tras una transición concurrente');
      }
      reserva = reloaded;
      continue;
    }
    if (error) throw new Error(`No se pudo aplicar la transición de pago (${error.code})`);
    if (updated) {
      reserva = updated;
      const shouldEnqueueConfirmation =
        reserva.estado === 'confirmada' &&
        reserva.estado_pago === 'aprobado' &&
        reserva.mp_payment_id === payment.id;

      if (shouldEnqueueConfirmation) {
        const queued = await encolarEmail({
          reservaId: reserva.id,
          tipo: 'reserva_confirmada',
          dedupeKey: `reserva-confirmada:${reserva.id}:${payment.id}`,
          payload: { reservaId: reserva.id, paymentId: payment.id },
        });
        if (!queued.ok) throw new Error(queued.error.message);
      }

      if (decision.value.action === 'marcar_revision') {
        await enqueueReservationReview(
          reserva.id,
          event,
          payment,
          decision.value.next.revisionMotivo ?? decision.value.reason,
        );
      }

      return {
        reserva,
        action: decision.value.action,
        reason: decision.value.reason,
      };
    }

    const { data: reloaded, error: reloadError } = await client
      .from('reservas')
      .select('*')
      .eq('id', reserva.id)
      .maybeSingle();
    if (reloadError || !reloaded) throw new Error('No se pudo revalidar la reserva concurrente');
    reserva = reloaded;
  }

  throw new Error('La reserva cambió demasiadas veces durante la conciliación');
}

export async function procesarEventoMercadoPago(eventId: string): Promise<ProcesarEventoResult> {
  const claimed = await claimEvent(eventId);
  if (claimed.kind === 'missing') {
    return { eventId, status: 'ignorado', reason: 'Evento inexistente' };
  }
  if (claimed.kind === 'finished') {
    return { eventId, status: claimed.event.status as 'procesado' | 'ignorado' };
  }
  if (claimed.kind === 'busy') return { eventId, status: 'ocupado' };
  if (claimed.kind === 'deferred') return { eventId, status: 'diferido' };

  const event = claimed.event;
  try {
    if (
      event.topic !== 'payment' &&
      event.topic !== 'topic_merchant_order_wh' &&
      event.topic !== 'topic_chargebacks_wh'
    ) {
      if (!(await finishEvent(event, 'ignorado', 'Tópico no soportado'))) {
        return { eventId, status: 'ocupado', reason: 'Lease reemplazada' };
      }
      return { eventId, status: 'ignorado', reason: 'Tópico no soportado' };
    }

    const payment = await obtenerPagoMercadoPago({
      topic: event.topic,
      resourceId: event.resource_id,
    });
    validarPagoContraConfiguracion(payment);

    if (!payment.reservaId) {
      if (!(await finishEvent(event, 'ignorado', 'El pago no tiene referencia de reserva'))) {
        return { eventId, status: 'ocupado', reason: 'Lease reemplazada' };
      }
      return { eventId, status: 'ignorado', reason: 'Sin referencia de reserva' };
    }

    const { data, error } = await getSupabaseAdmin()
      .from('reservas')
      .select('*')
      .eq('id', payment.reservaId)
      .maybeSingle();
    if (error) throw new Error('No se pudo buscar la reserva del pago');
    if (!data) {
      if (!(await finishEvent(event, 'ignorado', 'Reserva no encontrada'))) {
        return { eventId, status: 'ocupado', reason: 'Lease reemplazada' };
      }
      return { eventId, status: 'ignorado', reason: 'Reserva no encontrada' };
    }

    const result = await applyPaymentTransition(data, event, payment);
    if (payment.hasReversal && payment.estado === 'aprobado') {
      await markReservationForReview(
        result.reserva,
        event,
        payment,
        'La orden conserva cobertura aprobada pero contiene otro intento revertido',
      );
    }
    if (!(await finishEvent(event, 'procesado'))) {
      return { eventId, status: 'ocupado', reason: 'Lease reemplazada' };
    }
    return {
      eventId,
      status: 'procesado',
      reservaId: result.reserva.id,
      reason: result.reason,
    };
  } catch (error) {
    const isPermanentMismatch =
      error instanceof MercadoPagoIntegrationError &&
      (error.code === 'MP_RESOURCE_MISMATCH' ||
        (error.code === 'MP_INVALID_RESOURCE' && !error.retryable));
    if (isPermanentMismatch) {
      if (!(await finishEvent(event, 'ignorado', compactError(error)))) {
        return { eventId, status: 'ocupado', reason: 'Lease reemplazada' };
      }
      return { eventId, status: 'ignorado', reason: compactError(error) };
    }

    await failEvent(event, error);
    throw error;
  }
}

export interface ReconciliarReservaResult {
  reservaId: string;
  result:
    | 'primera_busqueda_vacia'
    | 'cancelada_sin_pago'
    | 'cancelada_con_intentos'
    | 'confirmada'
    | 'requiere_revision'
    | 'pago_pendiente';
  eventosProcesados?: number;
}

export async function reprogramarConciliacionReserva(
  reservaId: string,
  now = Date.now(),
) {
  const nextReconciliationAt = getNextReconciliationAt(now);
  const { error } = await getSupabaseAdmin()
    .from('reservas')
    .update({ next_reconciliation_at: nextReconciliationAt })
    .eq('id', reservaId)
    .eq('estado', 'pendiente')
    .eq('requiere_revision', false);

  if (error) throw new Error('No se pudo reprogramar la conciliación de la reserva');
  return nextReconciliationAt;
}

export async function reconciliarReservaMercadoPago(
  reserva: Reserva,
): Promise<ReconciliarReservaResult> {
  const payments = (await buscarPagosPorReserva(reserva.id))
    .filter((payment): payment is MpPaymentSearchResult & { id: string } => Boolean(payment.id))
    .filter(
      (payment, index, all) =>
        all.findIndex((candidate) => candidate.id === payment.id) === index,
    )
    .sort(
      (left, right) =>
        toTimestamp(left.date_created) - toTimestamp(right.date_created),
    );

  const now = new Date();
  const graceCutoff = new Date(
    now.getTime() - getReconciliationGraceMinutes() * 60 * 1_000,
  ).toISOString();

  if (payments.length === 0) {
    const client = getSupabaseAdmin();
    const emptyDecision = decidirConciliacionVacia({
      holdExpiresAt: reserva.hold_expires_at,
      firstEmptyAt: reserva.mp_empty_reconciliation_at,
      now: now.getTime(),
    });
    if (emptyDecision === 'esperar_gracia' || emptyDecision === 'esperar_reintento') {
      await reprogramarConciliacionReserva(reserva.id, now.getTime());
      return { reservaId: reserva.id, result: 'pago_pendiente' };
    }

    if (emptyDecision === 'registrar_primera') {
      const { data, error } = await client
        .from('reservas')
        .update({
          mp_empty_reconciliation_at: now.toISOString(),
          next_reconciliation_at: getNextReconciliationAt(now.getTime()),
        })
        .eq('id', reserva.id)
        .eq('estado', 'pendiente')
        .eq('requiere_revision', false)
        .is('mp_empty_reconciliation_at', null)
        .lte('hold_expires_at', graceCutoff)
        .select('id')
        .maybeSingle();
      if (error) throw new Error('No se pudo registrar la primera conciliación vacía');
      if (!data) await reprogramarConciliacionReserva(reserva.id, now.getTime());
      return {
        reservaId: reserva.id,
        result: data ? 'primera_busqueda_vacia' : 'pago_pendiente',
      };
    }

    const { data, error } = await client
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', reserva.id)
      .eq('estado', 'pendiente')
      .eq('requiere_revision', false)
      .eq('mp_empty_reconciliation_at', reserva.mp_empty_reconciliation_at as string)
      .lte('hold_expires_at', graceCutoff)
      .select('id')
      .maybeSingle();
    if (error) throw new Error('No se pudo cancelar el hold tras la segunda búsqueda vacía');
    if (!data) await reprogramarConciliacionReserva(reserva.id, now.getTime());
    return {
      reservaId: reserva.id,
      result: data ? 'cancelada_sin_pago' : 'pago_pendiente',
    };
  }

  const { error: clearEmptyMarkerError } = await getSupabaseAdmin()
    .from('reservas')
    .update({ mp_empty_reconciliation_at: null })
    .eq('id', reserva.id)
    .eq('estado', 'pendiente');
  if (clearEmptyMarkerError) {
    throw new Error('No se pudo limpiar la marca de conciliación vacía');
  }

  let unsafeEvent: { reason: string; eventKey: string; paymentId: string } | null = null;
  for (const payment of payments) {
    const eventKey = [
      'reconciliation',
      payment.id,
      payment.date_last_updated ?? payment.date_created ?? 'unknown',
    ].join(':');
    const registered = await registrarEventoWebhook({
      eventKey,
      resourceId: payment.id,
      topic: 'payment',
      action: 'payment.reconciled',
      payload: {
        id: eventKey,
        type: 'payment',
        action: 'payment.reconciled',
        data: { id: payment.id },
      } as Json,
    });
    if (!registered.ok) throw new Error(registered.error.message);

    const processed = await procesarEventoMercadoPago(registered.value.id);
    if (processed.status === 'ocupado' || processed.status === 'diferido') {
      await reprogramarConciliacionReserva(reserva.id, now.getTime());
      return {
        reservaId: reserva.id,
        result: 'pago_pendiente',
        eventosProcesados: payments.indexOf(payment),
      };
    }
    if (processed.status === 'ignorado') {
      unsafeEvent = {
        reason: processed.reason ?? 'Un pago conciliado no pudo vincularse',
        eventKey,
        paymentId: payment.id,
      };
    }
  }

  const client = getSupabaseAdmin();
  if (unsafeEvent) {
    // En esta rama no hay un evento reintentable: el cron deja de seleccionar la
    // reserva cuando requiere_revision pasa a true. Encolamos primero; si luego
    // falla el UPDATE, la dedupe permite reintentar sin duplicar el aviso.
    const queued = await encolarRevisionReserva({
      reservaId: reserva.id,
      sourceKey: `reconciliation:${unsafeEvent.paymentId}:ignored`,
      reason: unsafeEvent.reason,
      paymentId: unsafeEvent.paymentId,
      eventKey: unsafeEvent.eventKey,
    });
    if (!queued.ok) throw new Error(queued.error.message);

    const { data: reviewed, error } = await client
      .from('reservas')
      .update({
        requiere_revision: true,
        revision_motivo: unsafeEvent.reason.slice(0, 500),
      })
      .eq('id', reserva.id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error('No se pudo marcar la conciliación para revisión');
    if (!reviewed) throw new Error('La reserva conciliada dejó de estar disponible');
  }

  const { data: current, error: readError } = await client
    .from('reservas')
    .select('*')
    .eq('id', reserva.id)
    .maybeSingle();
  if (readError || !current) throw new Error('No se pudo releer la reserva conciliada');

  if (current.estado === 'confirmada') {
    return {
      reservaId: reserva.id,
      result: 'confirmada',
      eventosProcesados: payments.length,
    };
  }
  if (current.requiere_revision) {
    return {
      reservaId: reserva.id,
      result: 'requiere_revision',
      eventosProcesados: payments.length,
    };
  }
  if (current.estado === 'pendiente' && current.estado_pago === 'pendiente') {
    // Un intento realmente pendiente todavía puede acreditarse. El próximo cron
    // lo vuelve a consultar; liberar la fecha ahora crearía un cobro sin cupo.
    await reprogramarConciliacionReserva(reserva.id, now.getTime());
    return {
      reservaId: reserva.id,
      result: 'pago_pendiente',
      eventosProcesados: payments.length,
    };
  }
  if (current.estado !== 'pendiente') {
    return {
      reservaId: reserva.id,
      result: 'cancelada_con_intentos',
      eventosProcesados: payments.length,
    };
  }

  const { data: cancelled, error: cancelError } = await client
    .from('reservas')
    .update({ estado: 'cancelada' })
    .eq('id', reserva.id)
    .eq('estado', 'pendiente')
    .eq('requiere_revision', false)
    .lte('hold_expires_at', graceCutoff)
    .select('id')
    .maybeSingle();
  if (cancelError) throw new Error('No se pudo cancelar el hold después de conciliarlo');

  return {
    reservaId: reserva.id,
    result: cancelled ? 'cancelada_con_intentos' : 'pago_pendiente',
    eventosProcesados: payments.length,
  };
}
