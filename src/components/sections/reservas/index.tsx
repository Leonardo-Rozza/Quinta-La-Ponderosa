'use client';

import { useCalendario } from '@/hooks/useCalendario';
import { PRECIOS } from '@/lib/constants';
import { consultarDisponibilidad } from '@/lib/reservas/availability-client';
import { formatearPrecio, generarLinkWhatsApp } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ArrowRight, CalendarDays, Check, Clock3, Loader2, MessageCircle, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SectionIntro } from '../shared/SectionIntro';
import { Calendario } from './Calendario';
import { DatosReserva, FormReserva } from './FormReserva';

type Paso = 1 | 2 | 3;
type EstadoDisponibilidad = 'loading' | 'ready' | 'error';

interface ReservasProps {
  onlineEnabled: boolean;
}

const PASOS = [
  { numero: 1, titulo: 'Elegí el día', detalle: 'Disponibilidad real' },
  { numero: 2, titulo: 'Tus datos', detalle: 'Para coordinar' },
  { numero: 3, titulo: 'Seña segura', detalle: 'Con Mercado Pago' },
] as const;

function crearBookingRequestId() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function esCheckoutMercadoPago(urlValue: string) {
  try {
    const url = new URL(urlValue);
    const host = url.hostname.toLowerCase();
    const dominioValido =
      host === 'mercadopago.com' ||
      host.endsWith('.mercadopago.com') ||
      host === 'mercadopago.com.ar' ||
      host.endsWith('.mercadopago.com.ar');
    return url.protocol === 'https:' && dominioValido;
  } catch {
    return false;
  }
}

export function Reservas({ onlineEnabled }: ReservasProps) {
  const [pasoActivo, setPasoActivo] = useState<Paso>(1);
  const [fechasOcupadas, setFechasOcupadas] = useState<Date[]>([]);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(0);
  const [estadoDisponibilidad, setEstadoDisponibilidad] = useState<EstadoDisponibilidad>('loading');
  const [errorDisponibilidad, setErrorDisponibilidad] = useState('');
  const [puedeReintentarDisponibilidad, setPuedeReintentarDisponibilidad] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookingRequest = useRef<{ id: string; fingerprint: string } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const pasoAnterior = useRef<Paso>(1);

  const calendario = useCalendario({ fechasOcupadas, maxAdvanceDays });

  const cargarFechasOcupadas = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve();
    if (signal?.aborted) return;
    setEstadoDisponibilidad('loading');
    setErrorDisponibilidad('');
    setPuedeReintentarDisponibilidad(false);

    const resultado = await consultarDisponibilidad({ signal });
    if (!resultado.ok) {
      if (resultado.error.type === 'aborted') return;
      setFechasOcupadas([]);
      setMaxAdvanceDays(0);
      setEstadoDisponibilidad('error');
      setErrorDisponibilidad(resultado.error.message);
      setPuedeReintentarDisponibilidad(resultado.error.retryable);
      return;
    }

    setFechasOcupadas(
      resultado.value.fechasOcupadas.map((fecha) => new Date(`${fecha}T12:00:00`)),
    );
    setMaxAdvanceDays(resultado.value.maxAdvanceDays);
    setEstadoDisponibilidad('ready');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void cargarFechasOcupadas(controller.signal), 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [cargarFechasOcupadas]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (pasoAnterior.current === pasoActivo) return;
    pasoAnterior.current = pasoActivo;
    const targetId = pasoActivo === 1 ? 'booking-date-title' : pasoActivo === 2 ? 'booking-contact-title' : 'booking-review-title';
    const frame = window.requestAnimationFrame(() => document.getElementById(targetId)?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [pasoActivo]);

  const fechaLabel = calendario.fechaSeleccionada
    ? format(calendario.fechaSeleccionada, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    : '';
  const whatsappConsulta = generarLinkWhatsApp(
    fechaLabel
      ? `Hola! Quiero consultar la disponibilidad para el ${fechaLabel} en La Ponderosa.`
      : 'Hola! Quiero consultar una fecha disponible en La Ponderosa.',
  );

  const avanzarADatos = () => {
    if (!onlineEnabled) return;
    if (!calendario.fechaSeleccionada) {
      setError('Elegí una fecha disponible para continuar.');
      return;
    }
    setError(null);
    setPasoActivo(2);
  };

  const handleSubmit = async (datos: DatosReserva) => {
    if (!onlineEnabled || !calendario.fechaSeleccionada || isLoading) return;

    setIsLoading(true);
    setError(null);

    const requestPayload = {
      nombreCompleto: datos.nombreCompleto.trim(),
      email: datos.email.trim(),
      telefono: datos.telefono.trim(),
      cantidadPersonas: datos.cantidadPersonas,
      comentarios: datos.comentarios?.trim() || '',
      fecha: format(calendario.fechaSeleccionada, 'yyyy-MM-dd'),
      honeypot: datos.honeypot || '',
      aceptarTerminos: datos.aceptarTerminos,
    };
    const fingerprint = JSON.stringify(requestPayload);
    if (!bookingRequest.current || bookingRequest.current.fingerprint !== fingerprint) {
      bookingRequest.current = { id: crearBookingRequestId(), fingerprint };
    }

    try {
      const response = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestPayload,
          bookingRequestId: bookingRequest.current.id,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; sandboxUrl?: string; error?: { code?: string; message?: string; retryable?: boolean; field?: string } }
        | null;

      if (!response.ok) {
        if (response.status === 409) {
          calendario.resetearSeleccion();
          setPasoActivo(1);
          bookingRequest.current = null;
          void cargarFechasOcupadas();
          throw new Error('Esa fecha acaba de ocuparse. Actualizamos el calendario para que elijas otra.');
        }
        throw new Error(data?.error?.message || 'No pudimos preparar el pago. Intentá nuevamente.');
      }

      const checkoutUrl = data?.checkoutUrl || data?.sandboxUrl;
      if (!checkoutUrl || !esCheckoutMercadoPago(checkoutUrl)) {
        throw new Error('No pudimos validar el enlace de pago. Escribinos o intentá nuevamente.');
      }

      window.location.assign(checkoutUrl);
    } catch (submitError) {
      console.error('Error iniciando reserva:', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No pudimos iniciar el pago. Intentá nuevamente.'
      );
      setIsLoading(false);
    }
  };

  return (
    <section className="booking section-shell" aria-labelledby="booking-title">
      <div id="reservas" className="section-container booking__container">
        <SectionIntro
          eyebrow={onlineEnabled ? '04 · Reservar la jornada' : '04 · Consultar disponibilidad'}
          title={
            <span id="booking-title">
              {onlineEnabled
                ? 'Tres pasos. Una fecha para encontrarse.'
                : 'Elegí una fecha y conversemos.'}
            </span>
          }
          description={
            onlineEnabled
              ? 'Consultá disponibilidad en tiempo real, dejá tus datos y pagá sólo la seña desde el entorno seguro de Mercado Pago.'
              : 'Revisá el calendario actualizado y escribinos por WhatsApp para coordinar tu jornada.'
          }
        />

        {!onlineEnabled ? (
          <aside className="booking-demo-notice" aria-labelledby="booking-demo-title">
            <MessageCircle aria-hidden="true" />
            <div>
              <strong id="booking-demo-title">Reservas online próximamente</strong>
              <p>
                Las señas y los pagos están pausados temporalmente. El calendario sigue disponible
                para que nos indiques qué día te interesa.
              </p>
            </div>
            <a
              href={whatsappConsulta}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar por WhatsApp
            </a>
          </aside>
        ) : null}

        {onlineEnabled ? (
          <ol className="booking-steps" aria-label="Pasos de la reserva">
            {PASOS.map((paso) => {
              const completo = paso.numero < pasoActivo;
              const habilitado = paso.numero <= pasoActivo && (paso.numero === 1 || calendario.fechaSeleccionada);
              return (
                <li className={paso.numero === pasoActivo ? 'booking-step--active' : completo ? 'booking-step--complete' : ''} key={paso.numero}>
                  <button
                    type="button"
                    onClick={() => habilitado && setPasoActivo(paso.numero as Paso)}
                    disabled={!habilitado}
                    aria-current={paso.numero === pasoActivo ? 'step' : undefined}
                  >
                    <span className="booking-step__number" aria-hidden="true">{completo ? <Check /> : paso.numero}</span>
                    <span><strong>{paso.titulo}</strong><small>{paso.detalle}</small></span>
                  </button>
                  {paso.numero < 3 ? <i aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ol>
        ) : null}

        {error ? (
          <div className="booking-alert booking-alert--error" role="alert" tabIndex={-1} ref={errorRef}>
            <AlertTriangle aria-hidden="true" />
            <div><strong>No pudimos continuar</strong><p>{error}</p></div>
            <button type="button" onClick={() => setError(null)} aria-label="Cerrar mensaje">×</button>
          </div>
        ) : null}

        <div className="booking-stage" hidden={pasoActivo !== 1}>
          <h3 className="sr-only" id="booking-date-title" tabIndex={-1}>Elegí una fecha disponible</h3>
          <div className="booking-stage__calendar">
            {estadoDisponibilidad === 'loading' ? (
              <div className="availability-state" role="status">
                <Loader2 className="spin" aria-hidden="true" />
                <h3>Consultando fechas</h3>
                <p>Un momento, estamos verificando la disponibilidad real.</p>
              </div>
            ) : estadoDisponibilidad === 'error' ? (
              <div className="availability-state availability-state--error" role="alert">
                <AlertTriangle aria-hidden="true" />
                <h3>No podemos confirmar fechas ahora</h3>
                <p>{errorDisponibilidad} Para evitar superposiciones, pausamos la selección.</p>
                {puedeReintentarDisponibilidad ? (
                  <button type="button" className="button button--secondary" onClick={() => void cargarFechasOcupadas()}>
                    <RefreshCw aria-hidden="true" />
                    Volver a intentar
                  </button>
                ) : null}
              </div>
            ) : (
              <Calendario
                nombreMes={calendario.nombreMes}
                diasDelMes={calendario.diasDelMes}
                getDiaInfo={calendario.getDiaInfo}
                onSeleccionarDia={(fecha) => {
                  calendario.seleccionarDia(fecha);
                  setError(null);
                }}
                onMesAnterior={calendario.irMesAnterior}
                onMesSiguiente={calendario.irMesSiguiente}
                puedeIrAtras={calendario.puedeIrAtras}
                puedeIrAdelante={calendario.puedeIrAdelante}
              />
            )}
          </div>

          <aside className="booking-stage__summary" aria-label="Resumen de la jornada">
            <p className="booking-stage__eyebrow">La jornada completa</p>
            <p className="booking-stage__price">{formatearPrecio(PRECIOS.porDia)}</p>
            <ul>
              <li><Clock3 aria-hidden="true" /><span><strong>{PRECIOS.horarioInicio} a {PRECIOS.horarioFin} hs</strong>Uso exclusivo durante el día</span></li>
              <li><Users aria-hidden="true" /><span><strong>Hasta {PRECIOS.maximoPersonas} personas</strong>Una tarifa clara para todo el grupo</span></li>
              <li><ShieldCheck aria-hidden="true" /><span><strong>Seña del {PRECIOS.porcentajeSena * 100}%</strong>{formatearPrecio(PRECIOS.sena)} mediante Mercado Pago</span></li>
            </ul>

            <div className={`selected-date${calendario.fechaSeleccionada ? ' selected-date--ready' : ''}`} aria-live="polite">
              <CalendarDays aria-hidden="true" />
              <div>
                <span>{calendario.fechaSeleccionada ? 'Fecha elegida' : 'Primero elegí el día'}</span>
                <strong className={calendario.fechaSeleccionada ? 'capitalize' : undefined}>
                  {fechaLabel || 'El calendario está a la izquierda'}
                </strong>
              </div>
            </div>

            {onlineEnabled ? (
              <button
                type="button"
                className="button button--primary button--large booking-stage__continue"
                onClick={avanzarADatos}
                disabled={!calendario.fechaSeleccionada || estadoDisponibilidad !== 'ready'}
              >
                Continuar con esta fecha
                <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <a
                className="button button--large booking-stage__continue booking-stage__whatsapp"
                href={whatsappConsulta}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" />
                {fechaLabel ? 'Consultar esta fecha' : 'Consultar por WhatsApp'}
              </a>
            )}
          </aside>
        </div>

        {onlineEnabled ? (
          <div hidden={pasoActivo === 1}>
            <FormReserva
              activeStep={pasoActivo === 3 ? 3 : 2}
              fechaLabel={fechaLabel}
              isLoading={isLoading}
              onBack={() => setPasoActivo(pasoActivo === 3 ? 2 : 1)}
              onReview={() => setPasoActivo(3)}
              onSubmit={handleSubmit}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
