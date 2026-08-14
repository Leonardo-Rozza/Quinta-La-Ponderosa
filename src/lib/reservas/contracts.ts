import type { ApiErrorBody } from '../api-errors';
import type { EstadoPago, EstadoReserva } from './types';

export interface CrearReservaSuccessResponse {
  success: true;
  reservaId: string;
  bookingRequestId: string;
  checkoutUrl: string;
  holdExpiresAt: string;
}

export type CrearReservaResponse = CrearReservaSuccessResponse | ApiErrorBody;

export interface DisponibilidadResponse {
  fechasOcupadas: string[];
  maxAdvanceDays: number;
}

export interface ReservaStatusResponse {
  reservaId: string;
  estado: EstadoReserva;
  estadoPago: EstadoPago;
  requiereRevision: boolean;
  fecha: string;
  holdExpiresAt: string;
  checkoutUrl?: string;
}
