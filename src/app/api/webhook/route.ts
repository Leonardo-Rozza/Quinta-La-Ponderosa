// ═══════════════════════════════════════════════════════════════════════════════
// /api/webhook/route.ts - Webhook de MercadoPago
// ═══════════════════════════════════════════════════════════════════════════════
import { supabaseAdmin } from '@/lib/supabase';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📩 Webhook recibido:', JSON.stringify(body, null, 2));

    if (body.type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.error('No se encontró payment ID');
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 });
    }

    const payment = new Payment(mpClient);
    const paymentInfo = await payment.get({ id: paymentId });

    console.log('💳 Info del pago:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      external_reference: paymentInfo.external_reference,
    });

    const reservaId = paymentInfo.external_reference;
    if (!reservaId) {
      console.error('No se encontró external_reference (reserva ID)');
      return NextResponse.json({ error: 'No reserva ID' }, { status: 400 });
    }

    let nuevoEstado: string;

    switch (paymentInfo.status) {
      case 'approved':
        nuevoEstado = 'confirmada';
        console.log('✅ Pago aprobado - Confirmando reserva:', reservaId);
        break;
      case 'rejected':
      case 'cancelled':
        nuevoEstado = 'cancelada';
        console.log('❌ Pago rechazado/cancelado - Cancelando reserva:', reservaId);
        break;
      case 'pending':
      case 'in_process':
        console.log('⏳ Pago pendiente - Reserva sigue pendiente:', reservaId);
        return NextResponse.json({ received: true });
      default:
        console.log('❓ Estado desconocido:', paymentInfo.status);
        return NextResponse.json({ received: true });
    }

    const { error: updateError } = await supabaseAdmin
      .from('reservas')
      .update({
        estado: nuevoEstado,
        mp_payment_id: String(paymentInfo.id),
      })
      .eq('id', reservaId);

    if (updateError) {
      console.error('Error actualizando reserva:', updateError);
      return NextResponse.json({ error: 'Error actualizando reserva' }, { status: 500 });
    }

    console.log(`✅ Reserva ${reservaId} actualizada a: ${nuevoEstado}`);

    return NextResponse.json({ received: true, status: nuevoEstado });
  } catch (error) {
    console.error('Error en webhook:', error);
    return NextResponse.json({ error: 'Error procesando webhook' });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Webhook activo',
    timestamp: new Date().toISOString(),
  });
}
