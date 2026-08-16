import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const boundarySpies = vi.hoisted(() => ({
  consumeDistributedRateLimit: vi.fn(),
  crearPreferenciaMercadoPago: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  hasSupabaseAdminConfig: vi.fn(),
  hashRateLimitActor: vi.fn(),
  hashRateLimitSignal: vi.fn(),
  validarConfiguracionCheckoutMercadoPago: vi.fn(),
  validarConfiguracionEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/email', () => ({
  validarConfiguracionEmail: boundarySpies.validarConfiguracionEmail,
}));
vi.mock('@/lib/mercado-pago', () => ({
  crearPreferenciaMercadoPago: boundarySpies.crearPreferenciaMercadoPago,
  getSiteUrl: vi.fn(() => 'https://quinta.example.com'),
  isDeployedEnvironment: vi.fn(() => true),
  MercadoPagoIntegrationError: class extends Error {},
  validarConfiguracionCheckoutMercadoPago:
    boundarySpies.validarConfiguracionCheckoutMercadoPago,
}));
vi.mock('@/lib/rate-limit', () => ({
  consumeDistributedRateLimit: boundarySpies.consumeDistributedRateLimit,
  hashRateLimitActor: boundarySpies.hashRateLimitActor,
  hashRateLimitSignal: boundarySpies.hashRateLimitSignal,
}));
vi.mock('@/lib/reservas', () => ({
  getConfiguredReservaMaxAdvanceDays: vi.fn(() => 365),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: boundarySpies.getSupabaseAdmin,
  hasSupabaseAdminConfig: boundarySpies.hasSupabaseAdminConfig,
}));

import { POST } from './route';

describe('frontera de reservas en modo demostracion', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it.each([
    ['flag apagado', { RESERVAS_ONLINE_ENABLED: 'false', VERCEL: '1' }],
    ['flag ausente en deploy', { RESERVAS_ONLINE_ENABLED: undefined, VERCEL: '1' }],
  ])('responde 503 sin tocar proveedores cuando el %s', async (_case, environment) => {
    if (environment.RESERVAS_ONLINE_ENABLED === undefined) {
      delete process.env.RESERVAS_ONLINE_ENABLED;
    } else {
      vi.stubEnv('RESERVAS_ONLINE_ENABLED', environment.RESERVAS_ONLINE_ENABLED);
    }
    vi.stubEnv('VERCEL', environment.VERCEL);

    const response = await POST(
      new NextRequest('https://quinta.example.com/api/reservas', { method: 'POST' }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'Las reservas online están pausadas temporalmente. Consultanos por WhatsApp.',
        retryable: false,
      },
    });
    expect(boundarySpies.hasSupabaseAdminConfig).not.toHaveBeenCalled();
    expect(boundarySpies.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(boundarySpies.consumeDistributedRateLimit).not.toHaveBeenCalled();
    expect(boundarySpies.validarConfiguracionEmail).not.toHaveBeenCalled();
    expect(boundarySpies.validarConfiguracionCheckoutMercadoPago).not.toHaveBeenCalled();
    expect(boundarySpies.crearPreferenciaMercadoPago).not.toHaveBeenCalled();
  });
});
