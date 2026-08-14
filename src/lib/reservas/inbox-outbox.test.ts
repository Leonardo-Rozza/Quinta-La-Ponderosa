import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  crearDedupeKeyRevisionReserva,
  encolarRevisionReserva,
} from './inbox-outbox';

describe('outbox de revisión de reservas', () => {
  it('genera una clave estable, acotada y distinta por anomalía semántica', () => {
    const first = crearDedupeKeyRevisionReserva('reserva-1', 'pay-1:reembolsado:motivo');
    const replay = crearDedupeKeyRevisionReserva('reserva-1', 'pay-1:reembolsado:motivo');
    const chargeback = crearDedupeKeyRevisionReserva(
      'reserva-1',
      'pay-1:contracargo:otro motivo',
    );

    expect(first).toBe(replay);
    expect(first).not.toBe(chargeback);
    expect(first).toMatch(/^reserva-revision:reserva-1:[a-f0-9]{32}$/);
    expect(first.length).toBeLessThan(100);
  });

  it('recupera la fila existente cuando la clave única ya fue encolada', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505' },
    });
    const lookupSingle = vi.fn().mockResolvedValue({
      data: { id: 'outbox-existing' },
      error: null,
    });
    const lookupEq = vi.fn(() => ({ single: lookupSingle }));
    const table = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: insertSingle })),
      })),
      select: vi.fn(() => ({ eq: lookupEq })),
    };
    const client = { from: vi.fn(() => table) };

    const result = await encolarRevisionReserva(
      {
        reservaId: 'reserva-1',
        sourceKey: 'pay-1:reembolsado:motivo',
        reason: 'El pago fue reembolsado',
        paymentId: 'pay-1',
        eventKey: 'event-1',
      },
      client as never,
    );

    expect(result).toEqual({ ok: true, value: { id: 'outbox-existing', duplicate: true } });
    expect(table.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'reserva_revision',
        reserva_id: 'reserva-1',
        payload: expect.objectContaining({
          reason: 'El pago fue reembolsado',
          paymentId: 'pay-1',
          eventKey: 'event-1',
        }),
      }),
    );
    expect(lookupEq).toHaveBeenCalledWith(
      'dedupe_key',
      crearDedupeKeyRevisionReserva('reserva-1', 'pay-1:reembolsado:motivo'),
    );
  });
});
