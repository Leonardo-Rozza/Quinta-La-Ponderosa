"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, CreditCard, Clock } from "lucide-react";
import { useCalendario } from "@/hooks/useCalendario";
import { Calendario } from "./Calendario";
import { FormReserva, DatosReserva } from "./FormReserva";
import { PRECIOS, FECHAS_OCUPADAS_MOCK } from "@/lib/constants";
import { formatearPrecio } from "@/lib/utils";

export function Reservas() {
  // Hook del calendario
  const calendario = useCalendario({
    fechasOcupadas: FECHAS_OCUPADAS_MOCK, // En producción, esto viene del backend
  });

  // Estado para el proceso de pago
  const [isLoading, setIsLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Handler del formulario
  // ─────────────────────────────────────────────────────────────────────────
  const handleSubmit = async (datos: DatosReserva) => {
    if (!calendario.fechaSeleccionada) {
      alert("Por favor seleccioná una fecha");
      return;
    }

    setIsLoading(true);

    try {
      // Preparar datos para el backend
      const reservaData = {
        ...datos,
        fecha: calendario.fechaSeleccionada.toISOString(),
        precioTotal: PRECIOS.porDia,
        montoSena: PRECIOS.porDia * PRECIOS.porcentajeSena,
      };

      console.log("Datos de reserva:", reservaData);

      // TODO: Llamar a la API para crear la reserva y obtener el link de MercadoPago
      // const response = await fetch("/api/reservas", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(reservaData),
      // });
      // const { mercadoPagoUrl } = await response.json();
      // window.location.href = mercadoPagoUrl;

      // Por ahora, simular el proceso
      await new Promise((resolve) => setTimeout(resolve, 2000));
      alert(
        `¡Reserva simulada!\n\n` +
          `Fecha: ${format(calendario.fechaSeleccionada, "EEEE d 'de' MMMM", { locale: es })}\n` +
          `Personas: ${datos.cantidadPersonas}\n` +
          `Seña: ${formatearPrecio(PRECIOS.porDia * PRECIOS.porcentajeSena)}\n\n` +
          `En producción, acá se redirigiría a MercadoPago.`
      );
    } catch (error) {
      console.error("Error:", error);
      alert("Hubo un error al procesar la reserva. Intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="reservas" className="py-16 sm:py-20 lg:py-24 bg-blanco">
      <div className="section-container">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="section-label">Reservas</span>
          <h2 className="section-title mb-4">Reservá tu día</h2>
          <p className="text-negro/70 text-base sm:text-lg max-w-2xl mx-auto">
            Seleccioná la fecha, completá tus datos y pagá la seña online
          </p>
        </div>

        {/* Contenido principal: 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Columna izquierda: Info + Calendario */}
          <div className="space-y-6">
            {/* Card de precio */}
            <div className="precio-card">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-white/80 text-sm">Precio por día</span>
                  <p className="font-serif text-3xl sm:text-4xl text-white mt-1">
                    {formatearPrecio(PRECIOS.porDia)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-white/80 text-sm">Seña (50%)</span>
                  <p className="font-semibold text-xl text-white mt-1">
                    {formatearPrecio(PRECIOS.porDia * PRECIOS.porcentajeSena)}
                  </p>
                </div>
              </div>
              
              {/* Info adicional */}
              <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{PRECIOS.horarioInicio} a {PRECIOS.horarioFin} hs</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>Hasta {PRECIOS.maximoPersonas} personas</span>
                </div>
              </div>
            </div>

            {/* Calendario */}
            <Calendario
              nombreMes={calendario.nombreMes}
              diasDelMes={calendario.diasDelMes}
              getDiaInfo={calendario.getDiaInfo}
              onSeleccionarDia={calendario.seleccionarDia}
              onMesAnterior={calendario.irMesAnterior}
              onMesSiguiente={calendario.irMesSiguiente}
              puedeIrAtras={calendario.puedeIrAtras}
            />
          </div>

          {/* Columna derecha: Formulario */}
          <div>
            {/* Fecha seleccionada */}
            {calendario.fechaSeleccionada ? (
              <div className="fecha-seleccionada-card mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-terracota/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-terracota" />
                  </div>
                  <div>
                    <span className="text-negro/60 text-sm">Fecha seleccionada</span>
                    <p className="font-serif text-lg text-negro capitalize">
                      {format(calendario.fechaSeleccionada, "EEEE d 'de' MMMM", {
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="fecha-seleccionada-card mb-6 border-dashed">
                <div className="flex items-center gap-3 text-negro/50">
                  <div className="w-12 h-12 rounded-full bg-negro/5 flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium">Seleccioná una fecha</p>
                    <p className="text-sm">Hacé click en un día disponible</p>
                  </div>
                </div>
              </div>
            )}

            {/* Formulario */}
            <div className="form-container">
              <h3 className="font-serif text-xl text-negro mb-6">
                Datos de contacto
              </h3>
              <FormReserva
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </div>

            {/* Resumen del pago */}
            {calendario.fechaSeleccionada && (
              <div className="resumen-pago mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-negro/70" />
                  <h4 className="font-semibold text-negro">Resumen</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-negro/70">Alquiler por día</span>
                    <span className="text-negro">{formatearPrecio(PRECIOS.porDia)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-negro/70">Seña a pagar (50%)</span>
                    <span className="text-negro font-medium">
                      {formatearPrecio(PRECIOS.porDia * PRECIOS.porcentajeSena)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-negro/10">
                    <span className="text-negro/70">Resto a pagar en el lugar</span>
                    <span className="text-negro">
                      {formatearPrecio(PRECIOS.porDia * (1 - PRECIOS.porcentajeSena))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
