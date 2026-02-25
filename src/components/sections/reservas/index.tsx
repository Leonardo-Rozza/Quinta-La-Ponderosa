// ═══════════════════════════════════════════════════════════════════════════════
// Reservas/index.tsx - Sección completa de reservas
// ═══════════════════════════════════════════════════════════════════════════════
'use client';

import { useCalendario } from '@/hooks/useCalendario';
import { PRECIOS } from '@/lib/constants';
import { formatearPrecio } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, CreditCard, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Calendario } from './Calendario';
import { DatosReserva, FormReserva } from './FormReserva';

export function Reservas() {
  const [fechasOcupadas, setFechasOcupadas] = useState<Date[]>([]);
  const [cargandoFechas, setCargandoFechas] = useState(true);

  const calendario = useCalendario({
    fechasOcupadas,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargarFechasOcupadas() {
      try {
        const response = await fetch('/api/reservas');
        const data = await response.json();

        if (data.fechasOcupadas) {
          const fechas = data.fechasOcupadas.map((f: string) => new Date(f + 'T12:00:00'));
          setFechasOcupadas(fechas);
        }
      } catch (err) {
        console.error('Error cargando fechas:', err);
      } finally {
        setCargandoFechas(false);
      }
    }

    cargarFechasOcupadas();
  }, []);

  const handleSubmit = async (datos: DatosReserva) => {
    if (!calendario.fechaSeleccionada) {
      setError('Por favor seleccioná una fecha');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fechaFormateada = format(calendario.fechaSeleccionada, 'yyyy-MM-dd');

      const response = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datos,
          fecha: fechaFormateada,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la reserva');
      }

      const checkoutUrl = data.checkoutUrl || data.sandboxUrl;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No se recibió URL de pago');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar la reserva');
      setIsLoading(false);
    }
  };

  return (
    <section id="reservas" className="py-16 sm:py-20 lg:py-24 bg-blanco">
      <div className="section-container">
        <div className="text-center mb-12 sm:mb-16">
          <span className="section-label">Reservas</span>
          <h2 className="section-title mb-4">Reservá tu día</h2>
          <p className="text-negro/70 text-base sm:text-lg max-w-2xl mx-auto">
            Seleccioná la fecha, completá tus datos y pagá la seña online
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-6">
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

              <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>
                    {PRECIOS.horarioInicio} a {PRECIOS.horarioFin} hs
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>Hasta {PRECIOS.maximoPersonas} personas</span>
                </div>
              </div>
            </div>

            {cargandoFechas ? (
              <div className="calendario-container flex items-center justify-center min-h-75">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-terracota animate-spin mx-auto mb-2" />
                  <p className="text-negro/60 text-sm">Cargando disponibilidad...</p>
                </div>
              </div>
            ) : (
              <Calendario
                nombreMes={calendario.nombreMes}
                diasDelMes={calendario.diasDelMes}
                getDiaInfo={calendario.getDiaInfo}
                onSeleccionarDia={calendario.seleccionarDia}
                onMesAnterior={calendario.irMesAnterior}
                onMesSiguiente={calendario.irMesSiguiente}
                puedeIrAtras={calendario.puedeIrAtras}
              />
            )}
          </div>

          <div>
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

            {error && (
              <div className="bg-ocupado/10 border border-ocupado/20 rounded-xl p-4 mb-6">
                <p className="text-ocupado text-sm">{error}</p>
              </div>
            )}

            <div className="form-container">
              <h3 className="font-serif text-xl text-negro mb-6">Datos de contacto</h3>
              <FormReserva onSubmit={handleSubmit} isLoading={isLoading} />
            </div>

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
