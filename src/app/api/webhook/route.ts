import { supabaseAdmin } from '@/lib/supabase';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 });
    }

    const payment = new Payment(mpClient);
    const paymentInfo = await payment.get({ id: paymentId });

    const reservaId = paymentInfo.external_reference;
    if (!reservaId) {
      return NextResponse.json({ error: 'No reserva ID' }, { status: 400 });
    }

    let nuevoEstado: string;

    switch (paymentInfo.status) {
      case 'approved':
        nuevoEstado = 'confirmada';
        break;
      case 'rejected':
      case 'cancelled':
        nuevoEstado = 'cancelada';
        break;
      case 'pending':
      case 'in_process':
        return NextResponse.json({ received: true });
      default:
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
      return NextResponse.json({ error: 'Error actualizando reserva' }, { status: 500 });
    }

    return NextResponse.json({ received: true, status: nuevoEstado });
  } catch (error) {
    return NextResponse.json({ error: 'Error procesando webhook' });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Webhook activo',
    timestamp: new Date().toISOString(),
  });
}
