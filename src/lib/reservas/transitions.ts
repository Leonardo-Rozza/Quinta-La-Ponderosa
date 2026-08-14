import { err, ok, type Result } from '../api-errors';
import type {
  DomainError,
  PagoObservado,
  PaymentTransitionDecision,
  ReservaStateSnapshot,
} from './types';

function baseDecision(snapshot: ReservaStateSnapshot): PaymentTransitionDecision['next'] {
  return {
    estado: snapshot.estado,
    estadoPago: snapshot.estadoPago,
    mpPaymentId: snapshot.mpPaymentId,
    requiereRevision: snapshot.requiereRevision,
    revisionMotivo: snapshot.revisionMotivo ?? null,
  };
}

function validatePaymentBinding(
  snapshot: ReservaStateSnapshot,
  payment: PagoObservado
): Result<true, DomainError> {
  if (!payment.id.trim()) {
    return err({ code: 'INVALID_PAYMENT_ID', message: 'El pago no tiene un ID válido' });
  }

  if (!snapshot.mpPreferenceId) {
    return err({
      code: 'PAYMENT_PREFERENCE_MISSING',
      message: 'La reserva no tiene una preferencia asociada',
    });
  }

  if (payment.preferenceId !== snapshot.mpPreferenceId) {
    return err({
      code: 'PAYMENT_PREFERENCE_MISMATCH',
      message: 'El pago no pertenece a la preferencia de la reserva',
    });
  }

  if (payment.currencyId !== 'ARS') {
    return err({
      code: 'PAYMENT_CURRENCY_MISMATCH',
      message: 'La moneda del pago no coincide con la reserva',
    });
  }

  if (!Number.isFinite(payment.transactionAmount) || payment.transactionAmount < 0) {
    return err({
      code: 'PAYMENT_AMOUNT_INVALID',
      message: 'El monto del pago no es válido',
    });
  }

  const observedMinorUnits = Math.round(payment.transactionAmount * 100);
  const expectedMinorUnits = Math.round(snapshot.montoSena * 100);
  if (payment.estado === 'aprobado' && observedMinorUnits !== expectedMinorUnits) {
    return err({
      code: 'PAYMENT_AMOUNT_MISMATCH',
      message: 'El monto acreditado no coincide exactamente con la seña esperada',
    });
  }

  return ok(true);
}

export function decidirTransicionPago(
  snapshot: ReservaStateSnapshot,
  payment: PagoObservado
): Result<PaymentTransitionDecision, DomainError> {
  const binding = validatePaymentBinding(snapshot, payment);
  if (!binding.ok) return binding;

  const unchanged = baseDecision(snapshot);

  if (snapshot.estado === 'confirmada') {
    if (
      (payment.estado === 'reembolsado' || payment.estado === 'contracargo') &&
      payment.id === snapshot.mpPaymentId
    ) {
      const motivo =
        payment.estado === 'reembolsado'
          ? 'El pago confirmado fue reembolsado'
          : 'El pago confirmado recibió un contracargo';

      return ok({
        action: 'marcar_revision',
        changed:
          snapshot.estadoPago !== payment.estado ||
          !snapshot.requiereRevision ||
          snapshot.revisionMotivo !== motivo,
        next: {
          ...unchanged,
          estadoPago: payment.estado,
          requiereRevision: true,
          revisionMotivo: motivo,
        },
        reason: 'El pago confirmado tuvo una reversión y la fecha permanece bloqueada',
      });
    }

    if (payment.estado === 'reembolsado' || payment.estado === 'contracargo') {
      return ok({
        action: 'marcar_revision',
        changed: !snapshot.requiereRevision,
        next: {
          ...unchanged,
          requiereRevision: true,
          revisionMotivo: 'Se recibió una reversión para un pago diferente al confirmado',
        },
        reason: 'Una reversión ajena al pago confirmado no degrada la reserva',
      });
    }

    return ok({
      action: 'ignorar',
      changed: false,
      next: unchanged,
      reason: 'Una reserva confirmada no se degrada por intentos pendientes o rechazados',
    });
  }

  if (snapshot.estado === 'cancelada') {
    if (payment.estado === 'aprobado') {
      return ok({
        action: 'marcar_revision',
        changed:
          snapshot.estadoPago !== 'aprobado' ||
          snapshot.mpPaymentId !== payment.id ||
          !snapshot.requiereRevision,
        next: {
          ...unchanged,
          estadoPago: 'aprobado',
          mpPaymentId: payment.id,
          requiereRevision: true,
          revisionMotivo: 'Pago aprobado después de que venció o se canceló la reserva',
        },
        reason: 'Una aprobación tardía necesita conciliación y no reactiva la fecha',
      });
    }

    return ok({
      action: 'ignorar',
      changed: false,
      next: unchanged,
      reason: 'El evento no puede reabrir una reserva cancelada',
    });
  }

  switch (payment.estado) {
    case 'aprobado':
      return ok({
        action: 'confirmar',
        changed: true,
        next: {
          ...unchanged,
          estado: 'confirmada',
          estadoPago: 'aprobado',
          mpPaymentId: payment.id,
        },
        reason: 'Pago aprobado y vinculado correctamente',
      });

    case 'pendiente':
      return ok({
        action: 'actualizar_pago',
        changed: snapshot.estadoPago !== 'pendiente',
        next: { ...unchanged, estadoPago: 'pendiente' },
        reason: 'El pago continúa pendiente y conserva el hold',
      });

    case 'rechazado':
      return ok({
        action: 'actualizar_pago',
        changed: snapshot.estadoPago !== 'rechazado',
        next: {
          ...unchanged,
          estadoPago: 'rechazado',
        },
        reason: 'Un intento rechazado conserva el hold para permitir otro intento de pago',
      });

    case 'reembolsado':
    case 'contracargo':
      return ok({
        action: 'marcar_revision',
        changed: true,
        next: {
          ...unchanged,
          requiereRevision: true,
          revisionMotivo: `Estado de pago anómalo recibido: ${payment.estado}`,
        },
        reason: 'La reversión conserva el hold y requiere conciliación manual',
      });
  }
}
