import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { reservasOnlineHabilitadas } from './online-config';

describe('configuracion de reservas online', () => {
  it('habilita el flujo cuando se configura explicitamente', () => {
    expect(
      reservasOnlineHabilitadas({
        NODE_ENV: 'production',
        RESERVAS_ONLINE_ENABLED: ' true ',
        VERCEL: '1',
      }),
    ).toBe(true);
  });

  it('respeta la pausa explicita incluso en desarrollo', () => {
    expect(
      reservasOnlineHabilitadas({
        NODE_ENV: 'development',
        RESERVAS_ONLINE_ENABLED: 'false',
        VERCEL: undefined,
      }),
    ).toBe(false);
  });

  it('falla cerrado ante un valor desconocido', () => {
    expect(
      reservasOnlineHabilitadas({
        NODE_ENV: 'production',
        RESERVAS_ONLINE_ENABLED: 'yes',
        VERCEL: '1',
      }),
    ).toBe(false);
  });

  it('queda pausado por defecto en Vercel y en produccion', () => {
    expect(
      reservasOnlineHabilitadas({
        NODE_ENV: 'production',
        RESERVAS_ONLINE_ENABLED: undefined,
        VERCEL: '1',
      }),
    ).toBe(false);
    expect(
      reservasOnlineHabilitadas({
        NODE_ENV: 'production',
        RESERVAS_ONLINE_ENABLED: undefined,
        VERCEL: undefined,
      }),
    ).toBe(false);
  });

  it('permite pruebas locales cuando no hay una configuracion explicita', () => {
    expect(
      reservasOnlineHabilitadas({
        NODE_ENV: 'development',
        RESERVAS_ONLINE_ENABLED: undefined,
        VERCEL: undefined,
      }),
    ).toBe(true);
  });
});
