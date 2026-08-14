import { z } from 'zod';
import { PRECIOS } from './constants';
import {
  getConfiguredReservaMaxAdvanceDays,
  validarFechaReserva,
  type ReservaDatePolicy,
} from './reservas/dates';

export interface ReservaSchemaOptions extends ReservaDatePolicy {
  maxAdvanceDays?: number;
}

/**
 * Construye el esquema compartido. Aceptar opciones evita depender del reloj
 * real en pruebas y permite que cliente y servidor usen la misma política.
 */
export function crearReservaInputSchema(options: ReservaSchemaOptions = {}) {
  const maxAdvanceDays =
    options.maxAdvanceDays ?? getConfiguredReservaMaxAdvanceDays();

  return z
    .object({
      bookingRequestId: z
        .string()
        .uuid('La referencia de la solicitud es inválida'),
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
      comentarios: z
        .string()
        .trim()
        .max(500, 'Los comentarios son muy largos')
        .optional()
        .nullable(),
      fecha: z.string().superRefine((value, context) => {
        const result = validarFechaReserva(value, {
          today: options.today,
          timeZone: options.timeZone,
          maxAdvanceDays,
        });

        if (!result.ok) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: result.error.message });
        }
      }),
      aceptarTerminos: z.literal(true, {
        invalid_type_error: 'Debés aceptar los términos y la política de cancelación',
      }),
      // Campo trampa: se envía vacío y nunca se persiste.
      honeypot: z
        .string()
        .trim()
        .max(0, 'No se pudo validar la solicitud')
        .default(''),
    })
    .strict('La solicitud contiene campos no permitidos');
}

export const reservaInputSchema = crearReservaInputSchema();

export type ReservaInput = z.infer<typeof reservaInputSchema>;
