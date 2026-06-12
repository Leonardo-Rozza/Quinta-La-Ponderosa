// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL.TS - Envío de emails transaccionales vía Resend (API REST, sin SDK)
// ═══════════════════════════════════════════════════════════════════════════════
import { CONFIG } from './constants';
import type { Reserva } from './supabase';
import { formatearPrecio } from './utils';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function hasEmailConfig() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function getFrom() {
  // En Resend, hasta verificar un dominio propio se puede usar onboarding@resend.dev.
  return process.env.EMAIL_FROM?.trim() || `${CONFIG.siteName} <onboarding@resend.dev>`;
}

function getOwnerEmail() {
  return process.env.OWNER_EMAIL?.trim() || CONFIG.email;
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

async function enviarEmail(payload: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('RESEND_API_KEY no configurada; se omite el envío de email.');
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: getFrom(), ...payload }),
    });

    if (!response.ok) {
      const detalle = await response.text().catch(() => '');
      console.error('Error enviando email vía Resend:', response.status, detalle);
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
    <li><strong>Fecha:</strong> ${formatearFechaLarga(reserva.fecha)}</li>
    <li><strong>Personas:</strong> ${reserva.cantidad_personas}</li>
    <li><strong>Seña pagada:</strong> ${formatearPrecio(reserva.monto_sena)}</li>
    <li><strong>Resto a pagar en el lugar:</strong> ${formatearPrecio(
      reserva.precio_total - reserva.monto_sena
    )}</li>
  </ul>`;

/**
 * Envía el email de confirmación al cliente y el aviso al dueño.
 * No lanza: si algo falla, lo loguea y devuelve. El webhook no debe romperse
 * por un problema de email.
 */
export async function enviarEmailsReservaConfirmada(reserva: Reserva) {
  if (!hasEmailConfig()) {
    console.warn('Email no configurado; se omiten notificaciones de la reserva', reserva.id);
    return;
  }

  await Promise.allSettled([
    enviarEmail({
      to: reserva.email,
      subject: `Reserva confirmada en ${CONFIG.siteName} 🎉`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h1 style="color:#5c6b4a">¡Tu reserva está confirmada!</h1>
          <p>Hola ${reserva.nombre_completo.split(' ')[0]}, recibimos tu seña y tu fecha quedó reservada.</p>
          ${resumenReserva(reserva)}
          <p>Te vamos a contactar para coordinar los detalles de tu llegada.</p>
          <p>Cualquier duda, escribinos a ${CONFIG.telefonoDisplay}.</p>
          <p style="color:#888">${CONFIG.siteName} · ${CONFIG.direccionLocalidad}</p>
        </div>`,
    }),
    enviarEmail({
      to: getOwnerEmail(),
      subject: `Nueva reserva confirmada · ${formatearFechaLarga(reserva.fecha)}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2>Nueva reserva confirmada</h2>
          <p><strong>${reserva.nombre_completo}</strong> reservó La Ponderosa.</p>
          <ul style="line-height:1.8">
            <li><strong>Email:</strong> ${reserva.email}</li>
            <li><strong>Teléfono:</strong> ${reserva.telefono}</li>
          </ul>
          ${resumenReserva(reserva)}
          ${reserva.comentarios ? `<p><strong>Comentarios:</strong> ${reserva.comentarios}</p>` : ''}
        </div>`,
    }),
  ]);
}
