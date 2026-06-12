import { z } from 'zod';
import { PRECIOS } from './constants';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Devuelve la fecha de hoy (medianoche, hora local) para comparar contra la
 * fecha pedida. Se usa para rechazar reservas en el pasado o para el mismo día.
 */
function inicioDeHoy(): Date {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
}

/**
 * Esquema de validación de una reserva en el servidor.
 *
 * Es la fuente de verdad de la API: nunca confiamos en lo que mande el cliente.
 * Valida formato, rangos y que la fecha sea futura (mínimo mañana).
 */
export const reservaInputSchema = z.object({
  nombreCompleto: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre es muy largo'),
  email: z.string().trim().email('Ingresá un email válido').max(254),
  telefono: z
    .string()
    .trim()
    .min(8, 'El teléfono debe tener al menos 8 dígitos')
    .max(20, 'El teléfono es muy largo'),
  cantidadPersonas: z
    .number({ invalid_type_error: 'Cantidad de personas inválida' })
    .int('La cantidad debe ser un número entero')
    .min(1, 'Mínimo 1 persona')
    .max(PRECIOS.maximoPersonas, `Máximo ${PRECIOS.maximoPersonas} personas`),
  comentarios: z.string().trim().max(500, 'Los comentarios son muy largos').optional().nullable(),
  fecha: z
    .string()
    .regex(FECHA_REGEX, 'Formato de fecha inválido (esperado YYYY-MM-DD)')
    .refine((valor) => {
      const fecha = new Date(`${valor}T00:00:00`);
      return !Number.isNaN(fecha.getTime()) && fecha > inicioDeHoy();
    }, 'La fecha debe ser posterior a hoy'),
});

export type ReservaInput = z.infer<typeof reservaInputSchema>;
