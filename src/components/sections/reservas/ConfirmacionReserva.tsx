'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EstadoReserva } from './EstadoReserva';

type EstadoConsulta = 'checking' | 'confirmed' | 'pending' | 'retry' | 'error';

interface ReservaSegura {
  reservaId?: string;
  estado?: 'pendiente' | 'confirmada' | 'cancelada';
  estadoPago?: 'sin_iniciar' | 'pendiente' | 'aprobado' | 'rechazado' | 'reembolsado' | 'contracargo';
  requiereRevision?: boolean;
  fecha?: string;
  holdExpiresAt?: string;
  checkoutUrl?: string;
}

interface ConfirmacionReservaProps {
  query: string;
}

const RETRASOS = [0, 1800, 3500, 6000] as const;

function normalizarEstado(reserva: ReservaSegura): EstadoConsulta {
  if (reserva.requiereRevision) return 'error';
  if (reserva.estado === 'confirmada' && reserva.estadoPago === 'aprobado') return 'confirmed';
  if (reserva.estado === 'pendiente' && reserva.estadoPago === 'rechazado') {
    return reserva.checkoutUrl && esCheckoutMercadoPago(reserva.checkoutUrl) ? 'retry' : 'error';
  }
  if (
    reserva.estado === 'pendiente' &&
    ['sin_iniciar', 'pendiente', 'aprobado'].includes(reserva.estadoPago ?? '')
  ) return 'pending';
  return 'error';
}

function esCheckoutMercadoPago(urlValue: string) {
  try {
    const url = new URL(urlValue);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      (host === 'mercadopago.com' ||
        host.endsWith('.mercadopago.com') ||
        host === 'mercadopago.com.ar' ||
        host.endsWith('.mercadopago.com.ar'))
    );
  } catch {
    return false;
  }
}

function formatearFecha(fechaISO?: string) {
  if (!fechaISO) return '—';
  const fecha = new Date(`${fechaISO}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return fechaISO;
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(fecha);
}

export function ConfirmacionReserva({ query }: ConfirmacionReservaProps) {
  const [estado, setEstado] = useState<EstadoConsulta>('checking');
  const [reserva, setReserva] = useState<ReservaSegura | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelado = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const consultar = async (intento: number) => {
      if (!query) {
        setEstado('error');
        return;
      }

      if (RETRASOS[intento] > 0) {
        await new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, RETRASOS[intento]);
        });
      }
      if (cancelado) return;

      try {
        const response = await fetch(`/api/reservas/estado?${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | (ReservaSegura & { error?: { code?: string; message?: string; retryable?: boolean } })
          | null;

        if (!response.ok || !data) {
          if (data?.error?.retryable && intento < RETRASOS.length - 1) {
            await consultar(intento + 1);
            return;
          }
          setEstado('error');
          return;
        }

        const estadoNormalizado = normalizarEstado(data);
        setReserva(data);

        if (estadoNormalizado === 'pending' && intento < RETRASOS.length - 1) {
          await consultar(intento + 1);
          return;
        }

        setEstado(estadoNormalizado);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setEstado('error');
      }
    };

    void consultar(0);

    return () => {
      cancelado = true;
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [query, retryKey]);

  if (estado === 'confirmed') {
    return (
      <EstadoReserva
        variante="success"
        eyebrow="Reserva confirmada"
        title="La jornada ya tiene fecha."
        description="La seña fue acreditada. Guardá esta información: también te enviaremos la confirmación por email."
        whatsappMessage="Hola, acabo de confirmar mi reserva en La Ponderosa y quisiera coordinar los próximos pasos."
      >
        {reserva ? (
          <dl className="status-details">
            <div><dt>Fecha</dt><dd className="capitalize">{formatearFecha(reserva.fecha)}</dd></div>
            <div><dt>Estado del pago</dt><dd>Seña acreditada</dd></div>
            {reserva.reservaId ? <div><dt>Referencia</dt><dd>{reserva.reservaId.slice(0, 8).toUpperCase()}</dd></div> : null}
          </dl>
        ) : null}
        <div className="status-note">
          <h2>Próximos pasos</h2>
          <ol>
            <li>Guardá el email y el comprobante de pago.</li>
            <li>Nos contactaremos para coordinar el ingreso.</li>
            <li>El saldo restante se abona según lo acordado para la jornada.</li>
          </ol>
        </div>
      </EstadoReserva>
    );
  }

  if (estado === 'pending') {
    return (
      <EstadoReserva
        variante="pending"
        eyebrow="Acreditación pendiente"
        title="Mercado Pago todavía está procesando la seña."
        description="Ya verificamos varias veces y el pago aún no figura acreditado. No lo repitas: te avisaremos por email cuando cambie el estado."
        whatsappMessage="Hola, mi pago para La Ponderosa figura pendiente y quisiera consultar el estado."
      >
        <div className="status-note">
          <h2>Podés cerrar esta página</h2>
          <p>La acreditación continúa en segundo plano. Conservá el comprobante de Mercado Pago.</p>
        </div>
      </EstadoReserva>
    );
  }

  if (estado === 'retry' && reserva?.checkoutUrl) {
    return (
      <EstadoReserva
        variante="error"
        eyebrow="Pago no acreditado"
        title="Podés volver al mismo checkout."
        description="Mercado Pago no acreditó el intento anterior. El enlace sigue asociado a esta misma solicitud, así que reintentarlo no crea otra reserva ni otro bloqueo."
        primaryHref="/"
        primaryLabel="Volver al inicio"
        whatsappMessage="Hola, Mercado Pago rechazó mi intento y quisiera ayuda con la reserva en La Ponderosa."
      >
        <div className="status-note status-note--warning">
          <h2>Antes de reintentar</h2>
          <p>Revisá el medio de pago y asegurate de que no figure un cobro aprobado o pendiente.</p>
        </div>
        <a className="button button--mercadopago status-checkout" href={reserva.checkoutUrl}>
          Volver a Mercado Pago
        </a>
      </EstadoReserva>
    );
  }

  if (estado === 'error') {
    return (
      <EstadoReserva
        variante="error"
        eyebrow="No pudimos verificar la reserva"
        title="Todavía no podemos mostrarte un estado confiable."
        description="Esto no significa que el pago haya fallado. Revisá Mercado Pago y no repitas la operación si ves un cobro aprobado o pendiente."
        primaryHref="/#reservas"
        primaryLabel="Volver a reservas"
        whatsappMessage="Hola, no pude verificar el estado de mi reserva en La Ponderosa. Quisiera confirmar el pago antes de reintentar."
      >
        <button
          type="button"
          className="button button--quiet status-retry"
          onClick={() => {
            setEstado('checking');
            setRetryKey((value) => value + 1);
          }}
        >
          <RefreshCw aria-hidden="true" />
          Verificar otra vez
        </button>
      </EstadoReserva>
    );
  }

  return (
    <EstadoReserva
      variante="pending"
      eyebrow="Verificando el pago"
      title="Estamos confirmando la seña con Mercado Pago."
      description="Puede tomar unos segundos. No cierres ni actualices esta página mientras hacemos las primeras verificaciones."
      whatsappMessage="Hola, estoy verificando el pago de mi reserva en La Ponderosa."
    >
      <div className="status-loading" role="status">
        <span className="status-loading__spinner" aria-hidden="true" />
        <span>Consulta segura en curso…</span>
      </div>
    </EstadoReserva>
  );
}
