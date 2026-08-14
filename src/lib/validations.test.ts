import { describe, expect, it } from 'vitest';
import { crearReservaInputSchema } from './validations';

const validInput = {
  bookingRequestId: '11111111-1111-4111-8111-111111111111',
  nombreCompleto: 'Ada Lovelace',
  email: 'ada@example.com',
  telefono: '1123456789',
  fecha: '2026-09-01',
  cantidadPersonas: 10,
  comentarios: '',
  aceptarTerminos: true,
  honeypot: '',
} as const;

describe('reservaInputSchema compartido', () => {
  const schema = crearReservaInputSchema({
    today: '2026-08-13',
    maxAdvanceDays: 90,
  });

  it('acepta una solicitud completa y conserva su bookingRequestId', () => {
    const result = schema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookingRequestId).toBe(validInput.bookingRequestId);
      expect(result.data.aceptarTerminos).toBe(true);
    }
  });

  it('rechaza una fecha inexistente', () => {
    const result = schema.safeParse({ ...validInput, fecha: '2026-02-31' });
    expect(result.success).toBe(false);
  });

  it('rechaza honeypot completo y términos no aceptados', () => {
    expect(schema.safeParse({ ...validInput, honeypot: 'soy un bot' }).success).toBe(false);
    expect(schema.safeParse({ ...validInput, aceptarTerminos: false }).success).toBe(false);
  });

  it('rechaza campos inesperados para reducir mass assignment', () => {
    expect(
      schema.safeParse({ ...validInput, estado: 'confirmada' }).success
    ).toBe(false);
  });
});
