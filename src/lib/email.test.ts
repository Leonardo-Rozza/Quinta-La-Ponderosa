import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reserva } from './supabase';
import { enviarEmailReservaRevision, validarConfiguracionEmail } from './email';

const reserva: Reserva = {
  id: '11111111-1111-4111-8111-111111111111',
  booking_request_id: '22222222-2222-4222-8222-222222222222',
  nombre_completo: 'Ada <Lovelace>',
  email: 'ada@example.com',
  telefono: '+54 11 1234-5678',
  fecha: '2026-09-01',
  cantidad_personas: 12,
  comentarios: null,
  precio_total: 300_000,
  monto_sena: 150_000,
  estado: 'confirmada',
  estado_pago: 'reembolsado',
  mp_preference_id: 'pref-123',
  mp_payment_id: 'pay-123',
  mp_last_payment_id: 'pay-123',
  mp_last_event_id: 'event-123',
  mp_empty_reconciliation_at: null,
  next_reconciliation_at: '2026-09-01T00:00:00.000Z',
  hold_expires_at: '2026-09-01T00:30:00.000Z',
  checkout_url: null,
  sandbox_checkout_url: null,
  actor_hash: null,
  terminos_aceptados_en: '2026-08-13T20:00:00.000Z',
  requiere_revision: true,
  revision_motivo: 'El pago fue reembolsado',
  creado_en: '2026-08-13T20:00:00.000Z',
  actualizado_en: '2026-08-13T20:01:00.000Z',
};

describe('configuración y alertas de email', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    vi.stubEnv('OWNER_EMAIL', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('permite los fallbacks seguros en desarrollo con una credencial de Resend', () => {
    vi.stubEnv('RESEND_API_KEY', 're_unit-test');

    expect(validarConfiguracionEmail()).toMatchObject({
      ok: true,
      value: {
        from: 'La Ponderosa <onboarding@resend.dev>',
        ownerEmail: 'leonardorozza.dev@gmail.com',
      },
    });
  });

  it('rechaza en deploy credencial, remitente y dueño con formato inválido', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('RESEND_API_KEY', 'replace-me');
    vi.stubEnv('EMAIL_FROM', 'remitente-invalido');
    vi.stubEnv('OWNER_EMAIL', 'duenio-invalido');

    expect(validarConfiguracionEmail()).toEqual({
      ok: false,
      issues: ['RESEND_API_KEY_INVALID', 'EMAIL_FROM_INVALID', 'OWNER_EMAIL_INVALID'],
    });
  });

  it('acepta en deploy el fallback válido del dueño', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('RESEND_API_KEY', 're_production-key');
    vi.stubEnv('EMAIL_FROM', 'La Ponderosa <reservas@example.com>');

    expect(validarConfiguracionEmail()).toMatchObject({
      ok: true,
      value: { ownerEmail: 'leonardorozza.dev@gmail.com' },
    });
  });

  it('envía la alerta de revisión solo al dueño, escapada e idempotente', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('RESEND_API_KEY', 're_production-key');
    vi.stubEnv('EMAIL_FROM', 'La Ponderosa <reservas@example.com>');
    vi.stubEnv('OWNER_EMAIL', 'owner@example.com');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, headers: new Headers() });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      enviarEmailReservaRevision(
        reserva,
        {
          reason: '<script>alert("xss")</script>',
          paymentId: '<pay-123>',
          eventKey: '<event-123>',
        },
        'reserva-revision:dedupe',
      ),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(options.body));
    expect(payload.to).toBe('owner@example.com');
    expect(payload.to).not.toBe(reserva.email);
    expect(payload.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(payload.html).not.toContain('<script>');
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe(
      'reserva-revision:dedupe:duenio',
    );
  });
});
