// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL.TS - Envío de emails transaccionales vía Resend (API REST, sin SDK)
// ═══════════════════════════════════════════════════════════════════════════════
import { CONFIG } from './constants';
import type { Reserva } from './supabase';
import { formatearPrecio } from './utils';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 8_000;
const RESEND_API_KEY_PATTERN = /^re_[A-Za-z0-9_-]+$/;

export type EmailConfigurationIssue =
  | 'RESEND_API_KEY_INVALID'
  | 'EMAIL_FROM_INVALID'
  | 'OWNER_EMAIL_INVALID';

export type EmailConfigurationResult =
  | {
      ok: true;
      value: { from: string; ownerEmail: string };
    }
  | {
      ok: false;
      issues: EmailConfigurationIssue[];
    };

function isDeployedEnvironment() {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function isValidEmailIdentity(value: string) {
  if (/[\r\n]/.test(value)) return false;
  const angleMatch = value.match(/<([^<>]+)>\s*$/);
  if ((value.includes('<') || value.includes('>')) && !angleMatch) return false;
  const address = (angleMatch?.[1] ?? value).trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address);
}

function getConfiguredFrom() {
  const configured = process.env.EMAIL_FROM?.trim();
  if (configured && isValidEmailIdentity(configured)) return configured;
  if (!isDeployedEnvironment()) return `${CONFIG.siteName} <onboarding@resend.dev>`;
  return null;
}

function getConfiguredOwnerEmail() {
  const configured = process.env.OWNER_EMAIL?.trim();
  const ownerEmail = configured || CONFIG.email;
  return isValidEmailIdentity(ownerEmail) ? ownerEmail : null;
}

/**
 * Valida la configuración sin exponer secretos. En deploy el remitente debe
 * ser explícito; el destinatario puede usar el email de CONFIG como fallback.
 */
export function validarConfiguracionEmail(): EmailConfigurationResult {
  const issues: EmailConfigurationIssue[] = [];
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  const from = getConfiguredFrom();
  const ownerEmail = getConfiguredOwnerEmail();

  if (!RESEND_API_KEY_PATTERN.test(apiKey)) issues.push('RESEND_API_KEY_INVALID');
  if (!from) issues.push('EMAIL_FROM_INVALID');
  if (!ownerEmail) issues.push('OWNER_EMAIL_INVALID');

  if (issues.length > 0 || !from || !ownerEmail) return { ok: false, issues };
  return { ok: true, value: { from, ownerEmail } };
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function hasEmailConfig() {
  return validarConfiguracionEmail().ok;
}

function getFrom() {
  const configured = getConfiguredFrom();
  if (configured) return configured;
  throw new Error('EMAIL_FROM debe configurarse con una identidad válida en deploy.');
}

function getOwnerEmail() {
  const configured = getConfiguredOwnerEmail();
  if (configured) return configured;
  throw new Error('OWNER_EMAIL (o su fallback) debe ser una dirección válida.');
}

function formatearFechaLarga(fechaISO: string) {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return fechaISO;
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha);
}

async function enviarEmail(
  payload: { to: string; subject: string; html: string },
  idempotencyKey?: string,
) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('RESEND_API_KEY no configurada; se omite el envío de email.');
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: getFrom(), ...payload }),
    });

    if (!response.ok) {
      const requestId =
        response.headers.get('x-request-id') ?? response.headers.get('cf-ray') ?? 'unknown';
      console.error('Error enviando email vía Resend', {
        status: response.status,
        requestId: requestId.replaceAll(/[^A-Za-z0-9._:-]/g, '').slice(0, 100),
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error de red enviando email vía Resend:', error);
    return false;
  }
}

const resumenReserva = (reserva: Reserva) => `
  <ul style="line-height:1.8;color:#2c2c2c">
    <li><strong>Fecha:</strong> ${escapeHtml(formatearFechaLarga(reserva.fecha))}</li>
    <li><strong>Personas:</strong> ${escapeHtml(reserva.cantidad_personas)}</li>
    <li><strong>Seña pagada:</strong> ${escapeHtml(formatearPrecio(reserva.monto_sena))}</li>
    <li><strong>Resto a pagar en el lugar:</strong> ${escapeHtml(
      formatearPrecio(reserva.precio_total - reserva.monto_sena),
    )}</li>
  </ul>`;

/**
 * Envía el email de confirmación al cliente y el aviso al dueño.
 * No lanza: si algo falla, lo loguea y devuelve. El webhook no debe romperse
 * por un problema de email.
 */
export async function enviarEmailsReservaConfirmada(
  reserva: Reserva,
  deliveryKey?: string,
) {
  if (!hasEmailConfig()) {
    console.error(
      'Email no configurado: revisar credencial, remitente y destinatario del dueño.',
      { reservaId: reserva.id },
    );
    return false;
  }

  const resultados = await Promise.all([
    enviarEmail(
      {
        to: reserva.email,
        subject: `Reserva confirmada en ${CONFIG.siteName} 🎉`,
        html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h1 style="color:#5c6b4a">¡Tu reserva está confirmada!</h1>
          <p>Hola ${escapeHtml(reserva.nombre_completo.split(' ')[0])}, recibimos tu seña y tu fecha quedó reservada.</p>
          ${resumenReserva(reserva)}
          <p>Te vamos a contactar para coordinar los detalles de tu llegada.</p>
          <p>Cualquier duda, escribinos a ${escapeHtml(CONFIG.telefonoDisplay)}.</p>
          <p style="color:#888">${escapeHtml(CONFIG.siteName)} · ${escapeHtml(CONFIG.direccionLocalidad)}</p>
        </div>`,
      },
      deliveryKey ? `${deliveryKey}:cliente` : undefined,
    ),
    enviarEmail(
      {
        to: getOwnerEmail(),
        subject: `Nueva reserva confirmada · ${formatearFechaLarga(reserva.fecha)}`,
        html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2>Nueva reserva confirmada</h2>
          <p><strong>${escapeHtml(reserva.nombre_completo)}</strong> reservó La Ponderosa.</p>
          <ul style="line-height:1.8">
            <li><strong>Email:</strong> ${escapeHtml(reserva.email)}</li>
            <li><strong>Teléfono:</strong> ${escapeHtml(reserva.telefono)}</li>
          </ul>
          ${resumenReserva(reserva)}
          ${reserva.comentarios ? `<p><strong>Comentarios:</strong> ${escapeHtml(reserva.comentarios)}</p>` : ''}
        </div>`,
      },
      deliveryKey ? `${deliveryKey}:duenio` : undefined,
    ),
  ]);

  return resultados.every(Boolean);
}

export interface ReservaRevisionEmailDetails {
  reason?: string | null;
  paymentId?: string | null;
  eventKey?: string | null;
}

/** Envía únicamente al dueño una alerta operacional de revisión manual. */
export async function enviarEmailReservaRevision(
  reserva: Reserva,
  details: ReservaRevisionEmailDetails,
  deliveryKey?: string,
) {
  if (!hasEmailConfig()) {
    console.error('Email de revisión no configurado; la notificación se reintentará.', {
      reservaId: reserva.id,
    });
    return false;
  }

  const reason = details.reason?.trim() || reserva.revision_motivo || 'Revisión manual requerida';
  return enviarEmail(
    {
      to: getOwnerEmail(),
      subject: `Reserva requiere revisión · ${formatearFechaLarga(reserva.fecha)}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#9a3412">Reserva pendiente de revisión manual</h2>
          <p>El sistema conservó el estado seguro de la reserva y requiere una decisión del dueño.</p>
          <ul style="line-height:1.8">
            <li><strong>Reserva:</strong> ${escapeHtml(reserva.id)}</li>
            <li><strong>Cliente:</strong> ${escapeHtml(reserva.nombre_completo)}</li>
            <li><strong>Email:</strong> ${escapeHtml(reserva.email)}</li>
            <li><strong>Teléfono:</strong> ${escapeHtml(reserva.telefono)}</li>
            <li><strong>Estado:</strong> ${escapeHtml(reserva.estado)}</li>
            <li><strong>Estado de pago:</strong> ${escapeHtml(reserva.estado_pago)}</li>
            <li><strong>Motivo:</strong> ${escapeHtml(reason)}</li>
            ${details.paymentId ? `<li><strong>Pago MP:</strong> ${escapeHtml(details.paymentId)}</li>` : ''}
            ${details.eventKey ? `<li><strong>Evento:</strong> ${escapeHtml(details.eventKey)}</li>` : ''}
          </ul>
          ${resumenReserva(reserva)}
          <p><strong>No liberes la fecha ni devuelvas dinero sin verificar primero en Mercado Pago.</strong></p>
        </div>`,
    },
    deliveryKey ? `${deliveryKey}:duenio` : undefined,
  );
}
