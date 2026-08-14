export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada';

export type EstadoPago =
  | 'sin_iniciar'
  | 'pendiente'
  | 'aprobado'
  | 'rechazado'
  | 'reembolsado'
  | 'contracargo';

export type EstadoPagoObservado = Exclude<EstadoPago, 'sin_iniciar'>;

export interface ReservaStateSnapshot {
  estado: EstadoReserva;
  estadoPago: EstadoPago;
  mpPaymentId: string | null;
  mpPreferenceId: string | null;
  montoSena: number;
  requiereRevision: boolean;
  revisionMotivo?: string | null;
}

export interface PagoObservado {
  id: string;
  estado: EstadoPagoObservado;
  preferenceId: string | null;
  merchantOrderId: string | null;
  currencyId: string;
  transactionAmount: number;
}

export type PaymentTransitionAction =
  | 'confirmar'
  | 'marcar_revision'
  | 'actualizar_pago'
  | 'ignorar';

export interface PaymentTransitionDecision {
  action: PaymentTransitionAction;
  changed: boolean;
  next: {
    estado: EstadoReserva;
    estadoPago: EstadoPago;
    mpPaymentId: string | null;
    requiereRevision: boolean;
    revisionMotivo: string | null;
  };
  reason: string;
}

export type DomainErrorCode =
  | 'INVALID_PAYMENT_ID'
  | 'PAYMENT_PREFERENCE_MISSING'
  | 'PAYMENT_PREFERENCE_MISMATCH'
  | 'PAYMENT_CURRENCY_MISMATCH'
  | 'PAYMENT_AMOUNT_INVALID'
  | 'PAYMENT_AMOUNT_MISMATCH';

export interface DomainError {
  code: DomainErrorCode;
  message: string;
}
