import { describe, expect, it } from 'vitest';
import { decidirTransicionPago } from './transitions';
import type { PagoObservado, ReservaStateSnapshot } from './types';

const pending: ReservaStateSnapshot = {
  estado: 'pendiente',
  estadoPago: 'pendiente',
  mpPaymentId: null,
  mpPreferenceId: 'pref-123',
  montoSena: 150_000,
  requiereRevision: false,
  revisionMotivo: null,
};

const approved: PagoObservado = {
  id: 'pay-1',
  estado: 'aprobado',
  preferenceId: 'pref-123',
  merchantOrderId: 'order-1',
  currencyId: 'ARS',
  transactionAmount: 150_000,
};

describe('transiciones monotónicas de pago', () => {
  it('confirma una pendiente solo con un pago completamente vinculado', () => {
    const result = decidirTransicionPago(pending, approved);
    expect(result).toMatchObject({
      ok: true,
      value: {
        action: 'confirmar',
        next: {
          estado: 'confirmada',
          estadoPago: 'aprobado',
          mpPaymentId: 'pay-1',
        },
      },
    });

  });

  it('ignora un rechazo fuera de orden después de confirmar', () => {
    const confirmed: ReservaStateSnapshot = {
      ...pending,
      estado: 'confirmada',
      estadoPago: 'aprobado',
      mpPaymentId: 'pay-1',
    };

    const result = decidirTransicionPago(confirmed, {
      ...approved,
      id: 'pay-2',
      estado: 'rechazado',
      transactionAmount: 0,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        action: 'ignorar',
        changed: false,
        next: { estado: 'confirmada', estadoPago: 'aprobado', mpPaymentId: 'pay-1' },
      },
    });

  });

  it('mantiene la fecha confirmada y marca revisión ante refund del pago confirmado', () => {
    const confirmed: ReservaStateSnapshot = {
      ...pending,
      estado: 'confirmada',
      estadoPago: 'aprobado',
      mpPaymentId: 'pay-1',
    };

    const result = decidirTransicionPago(confirmed, {
      ...approved,
      estado: 'reembolsado',
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        action: 'marcar_revision',
        next: {
          estado: 'confirmada',
          estadoPago: 'reembolsado',
          requiereRevision: true,
        },
      },
    });
  });

  it('permite elevar un reembolso a contracargo sin liberar la fecha', () => {
    const refunded: ReservaStateSnapshot = {
      ...pending,
      estado: 'confirmada',
      estadoPago: 'reembolsado',
      mpPaymentId: 'pay-1',
      requiereRevision: true,
      revisionMotivo: 'El pago confirmado fue reembolsado',
    };

    const result = decidirTransicionPago(refunded, {
      ...approved,
      estado: 'contracargo',
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        action: 'marcar_revision',
        changed: true,
        next: {
          estado: 'confirmada',
          estadoPago: 'contracargo',
          mpPaymentId: 'pay-1',
          requiereRevision: true,
          revisionMotivo: 'El pago confirmado recibió un contracargo',
        },
      },
    });
  });

  it('no aplica una reversión de otro pago sobre el pago confirmado', () => {
    const confirmed: ReservaStateSnapshot = {
      ...pending,
      estado: 'confirmada',
      estadoPago: 'aprobado',
      mpPaymentId: 'pay-1',
    };

    const result = decidirTransicionPago(confirmed, {
      ...approved,
      id: 'pay-2',
      estado: 'contracargo',
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        action: 'marcar_revision',
        next: {
          estado: 'confirmada',
          estadoPago: 'aprobado',
          mpPaymentId: 'pay-1',
          requiereRevision: true,
        },
      },
    });
  });

  it('una aprobación tardía no reactiva una reserva cancelada', () => {
    const canceled: ReservaStateSnapshot = {
      ...pending,
      estado: 'cancelada',
      estadoPago: 'rechazado',
    };

    const result = decidirTransicionPago(canceled, approved);
    expect(result).toMatchObject({
      ok: true,
      value: {
        action: 'marcar_revision',
        next: {
          estado: 'cancelada',
          estadoPago: 'aprobado',
          requiereRevision: true,
          mpPaymentId: 'pay-1',
        },
      },
    });
  });

  it('una reversión en una pendiente conserva la fecha bloqueada y marca revisión', () => {
    const result = decidirTransicionPago(pending, {
      ...approved,
      estado: 'contracargo',
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        action: 'marcar_revision',
        next: {
          estado: 'pendiente',
          estadoPago: 'pendiente',
          requiereRevision: true,
        },
      },
    });

    if (!result.ok) throw new Error('La reversión debía producir revisión');
    expect(
      decidirTransicionPago(
        {
          ...pending,
          estado: result.value.next.estado,
          estadoPago: result.value.next.estadoPago,
          requiereRevision: result.value.next.requiereRevision,
          revisionMotivo: result.value.next.revisionMotivo,
        },
        { ...approved, id: 'pay-2' },
      ),
    ).toMatchObject({
      ok: true,
      value: {
        action: 'confirmar',
        next: { estado: 'confirmada', estadoPago: 'aprobado', requiereRevision: true },
      },
    });
  });

  it('un rechazo mantiene el hold y una aprobación posterior todavía puede confirmar', () => {
    const rejectedResult = decidirTransicionPago(pending, {
      ...approved,
      estado: 'rechazado',
      transactionAmount: 0,
    });

    expect(rejectedResult).toMatchObject({
      ok: true,
      value: {
        action: 'actualizar_pago',
        next: { estado: 'pendiente', estadoPago: 'rechazado' },
      },
    });

    if (!rejectedResult.ok) throw new Error('La transición rechazada debía ser válida');

    const approvedAfterRetry = decidirTransicionPago(
      {
        ...pending,
        estado: rejectedResult.value.next.estado,
        estadoPago: rejectedResult.value.next.estadoPago,
      },
      approved
    );

    expect(approvedAfterRetry).toMatchObject({
      ok: true,
      value: { action: 'confirmar', next: { estado: 'confirmada' } },
    });
  });

  it('rechaza preferencia, moneda o monto que no coincidan exactamente', () => {
    expect(
      decidirTransicionPago(pending, { ...approved, preferenceId: 'otra' })
    ).toMatchObject({ ok: false, error: { code: 'PAYMENT_PREFERENCE_MISMATCH' } });

    expect(
      decidirTransicionPago(pending, { ...approved, currencyId: 'USD' })
    ).toMatchObject({ ok: false, error: { code: 'PAYMENT_CURRENCY_MISMATCH' } });

    expect(
      decidirTransicionPago(pending, { ...approved, transactionAmount: 149_999.99 })
    ).toMatchObject({ ok: false, error: { code: 'PAYMENT_AMOUNT_MISMATCH' } });

    expect(
      decidirTransicionPago(pending, { ...approved, transactionAmount: 150_000.01 })
    ).toMatchObject({ ok: false, error: { code: 'PAYMENT_AMOUNT_MISMATCH' } });
  });
});
