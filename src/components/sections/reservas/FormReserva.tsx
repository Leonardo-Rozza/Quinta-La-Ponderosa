"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PRECIOS } from "@/lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
// ESQUEMA DE VALIDACIÓN CON ZOD
// ─────────────────────────────────────────────────────────────────────────────
const esquemaReserva = z.object({
  nombreCompleto: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(100, "El nombre es muy largo"),
  email: z
    .string()
    .email("Ingresá un email válido"),
  telefono: z
    .string()
    .min(8, "El teléfono debe tener al menos 8 dígitos")
    .max(20, "El teléfono es muy largo"),
  cantidadPersonas: z
    .number()
    .min(1, "Mínimo 1 persona")
    .max(PRECIOS.maximoPersonas, `Máximo ${PRECIOS.maximoPersonas} personas`),
  comentarios: z
    .string()
    .max(500, "Los comentarios son muy largos")
    .optional(),
});

// Tipo inferido del esquema
export type DatosReserva = z.infer<typeof esquemaReserva>;

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface FormReservaProps {
  onSubmit: (datos: DatosReserva) => void;
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────
export function FormReserva({ onSubmit, isLoading = false }: FormReservaProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosReserva>({
    resolver: zodResolver(esquemaReserva),
    defaultValues: {
      cantidadPersonas: 10,
      comentarios: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Nombre */}
      <div className="form-group">
        <label htmlFor="nombreCompleto" className="form-label">
          Nombre completo *
        </label>
        <input
          id="nombreCompleto"
          type="text"
          placeholder="Juan Pérez"
          className={`form-input ${errors.nombreCompleto ? "form-input-error" : ""}`}
          {...register("nombreCompleto")}
        />
        {errors.nombreCompleto && (
          <span className="form-error">{errors.nombreCompleto.message}</span>
        )}
      </div>

      {/* Email y Teléfono en 2 columnas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email *
          </label>
          <input
            id="email"
            type="email"
            placeholder="tu@email.com"
            className={`form-input ${errors.email ? "form-input-error" : ""}`}
            {...register("email")}
          />
          {errors.email && (
            <span className="form-error">{errors.email.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="telefono" className="form-label">
            Teléfono / WhatsApp *
          </label>
          <input
            id="telefono"
            type="tel"
            placeholder="11 1234-5678"
            className={`form-input ${errors.telefono ? "form-input-error" : ""}`}
            {...register("telefono")}
          />
          {errors.telefono && (
            <span className="form-error">{errors.telefono.message}</span>
          )}
        </div>
      </div>

      {/* Cantidad de personas */}
      <div className="form-group">
        <label htmlFor="cantidadPersonas" className="form-label">
          Cantidad de personas *
        </label>
        <select
          id="cantidadPersonas"
          className={`form-input ${errors.cantidadPersonas ? "form-input-error" : ""}`}
          {...register("cantidadPersonas", { valueAsNumber: true })}
        >
          {Array.from({ length: PRECIOS.maximoPersonas }, (_, i) => i + 1).map(
            (num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? "persona" : "personas"}
              </option>
            )
          )}
        </select>
        {errors.cantidadPersonas && (
          <span className="form-error">{errors.cantidadPersonas.message}</span>
        )}
      </div>

      {/* Comentarios */}
      <div className="form-group">
        <label htmlFor="comentarios" className="form-label">
          Comentarios (opcional)
        </label>
        <textarea
          id="comentarios"
          rows={3}
          placeholder="Hora de llegada, requerimientos especiales, etc."
          className="form-input resize-none"
          {...register("comentarios")}
        />
        {errors.comentarios && (
          <span className="form-error">{errors.comentarios.message}</span>
        )}
      </div>

      {/* Botón submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn-mercadopago w-full"
      >
        {isLoading ? (
          <>
            <span className="loading-spinner" />
            Procesando...
          </>
        ) : (
          <>
            <MercadoPagoLogo />
            Pagar seña con MercadoPago
          </>
        )}
      </button>

      <p className="text-xs text-negro/50 text-center">
        Al continuar, aceptás nuestros términos y condiciones
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGO DE MERCADOPAGO
// ─────────────────────────────────────────────────────────────────────────────
function MercadoPagoLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="12" r="2" />
    </svg>
  );
}