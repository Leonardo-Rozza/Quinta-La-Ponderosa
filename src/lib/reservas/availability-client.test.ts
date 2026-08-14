import { describe, expect, it, vi } from 'vitest';
import {
  consultarDisponibilidad,
  type AvailabilityFetcher,
} from './availability-client';

function response(
  status: number,
  payload: unknown,
): Awaited<ReturnType<AvailabilityFetcher>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe('cliente de disponibilidad', () => {
  it('acepta una respuesta 200 válida', async () => {
    const fetcher = vi.fn<AvailabilityFetcher>().mockResolvedValue(
      response(200, {
        fechasOcupadas: ['2026-08-20', '2026-09-01'],
        maxAdvanceDays: 120,
      }),
    );

    await expect(consultarDisponibilidad({ fetcher })).resolves.toEqual({
      ok: true,
      value: {
        fechasOcupadas: ['2026-08-20', '2026-09-01'],
        maxAdvanceDays: 120,
      },
    });
    expect(fetcher).toHaveBeenCalledWith('/api/reservas', {
      cache: 'no-store',
      signal: undefined,
    });
  });

  it('devuelve el envelope de un 503 como error esperado y reintentable', async () => {
    const fetcher = vi.fn<AvailabilityFetcher>().mockResolvedValue(
      response(503, {
        error: {
          code: 'DATABASE_ERROR',
          message: 'No se pudo obtener la disponibilidad.',
          retryable: true,
        },
      }),
    );

    await expect(consultarDisponibilidad({ fetcher })).resolves.toEqual({
      ok: false,
      error: {
        type: 'http',
        code: 'DATABASE_ERROR',
        message: 'No se pudo obtener la disponibilidad.',
        retryable: true,
        status: 503,
      },
    });
  });

  it('rechaza un payload exitoso inválido de forma fail-closed', async () => {
    const fetcher = vi.fn<AvailabilityFetcher>().mockResolvedValue(
      response(200, {
        fechasOcupadas: ['2026-02-31'],
        maxAdvanceDays: 0,
      }),
    );

    await expect(consultarDisponibilidad({ fetcher })).resolves.toMatchObject({
      ok: false,
      error: {
        type: 'invalid-response',
        retryable: true,
        status: 200,
      },
    });
  });

  it('clasifica una falla de red sin lanzar', async () => {
    const fetcher = vi
      .fn<AvailabilityFetcher>()
      .mockRejectedValue(new TypeError('fetch failed'));

    await expect(consultarDisponibilidad({ fetcher })).resolves.toEqual({
      ok: false,
      error: {
        type: 'network',
        message: 'No pudimos conectarnos para consultar la disponibilidad.',
        retryable: true,
      },
    });
  });

  it('trata AbortError como cancelación silenciosa', async () => {
    const fetcher = vi
      .fn<AvailabilityFetcher>()
      .mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(consultarDisponibilidad({ fetcher })).resolves.toEqual({
      ok: false,
      error: {
        type: 'aborted',
        message: '',
        retryable: false,
      },
    });
  });
});
