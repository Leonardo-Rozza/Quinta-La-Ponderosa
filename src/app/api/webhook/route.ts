import { getSupabaseAdmin } from '@/lib/supabase';
import { MercadoPagoConfig, MerchantOrder, Payment } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

function getMercadoPagoClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN is required.');
  }

  return new MercadoPagoConfig({ accessToken });
}

function getNotificationType(request: NextRequest, body: Record<string, unknown>) {
  const typeFromBody = typeof body.type === 'string' ? body.type : null;
  const topicFromBody = typeof body.topic === 'string' ? body.topic : null;
  const typeFromQuery = request.nextUrl.searchParams.get('type');
  const topicFromQuery = request.nextUrl.searchParams.get('topic');

  return typeFromBody || topicFromBody || typeFromQuery || topicFromQuery;
}

function getResourceId(body: Record<string, unknown>, request: NextRequest) {
  const data = typeof body.data === 'object' && body.data ? body.data : null;
  const dataId =
    data && 'id' in data && (typeof data.id === 'string' || typeof data.id === 'number')
      ? String(data.id)
      : null;

  if (dataId) {
    return dataId;
  }

  const resource =
    typeof body.resource === 'string'
      ? body.resource
      : request.nextUrl.searchParams.get('resource');

  if (resource) {
    const match = resource.match(/\/(\d+)(?:\?.*)?$/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return request.nextUrl.searchParams.get('id');
}

function getReservaId(paymentInfo: {
  external_reference?: string;
  metadata?: Record<string, unknown>;
}) {
  if (paymentInfo.external_reference) {
    return paymentInfo.external_reference;
  }

  const metadataReservaId = paymentInfo.metadata?.reserva_id;
  return typeof metadataReservaId === 'string' ? metadataReservaId : null;
}

function mapPaymentStatus(status?: string) {
  switch (status) {
    case 'approved':
      return 'confirmada';
    case 'rejected':
    case 'cancelled':
    case 'refunded':
    case 'charged_back':
      return 'cancelada';
    case 'pending':
    case 'in_process':
    case 'authorized':
    case 'in_mediation':
      return null;
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const notificationType = getNotificationType(request, body);
    const resourceId = getResourceId(body, request);

    if (notificationType && notificationType !== 'payment' && notificationType !== 'merchant_order') {
      return NextResponse.json({ received: true });
    }

    if (!resourceId) {
      return NextResponse.json({ error: 'No resource ID' }, { status: 400 });
    }

    const mpClient = getMercadoPagoClient();
    const payment = new Payment(mpClient);

    let paymentId = resourceId;

    if (notificationType === 'merchant_order') {
      const merchantOrder = new MerchantOrder(mpClient);
      const orderInfo = await merchantOrder.get({ merchantOrderId: resourceId });
      const latestPayment = [...(orderInfo.payments ?? [])]
        .filter((candidate) => candidate.id)
        .sort((a, b) => {
          const dateA = new Date(a.last_modified || a.date_created || 0).getTime();
          const dateB = new Date(b.last_modified || b.date_created || 0).getTime();
          return dateB - dateA;
        })[0];

      if (!latestPayment?.id) {
        return NextResponse.json({ received: true, skipped: 'merchant_order_without_payment' });
      }

      paymentId = String(latestPayment.id);
    }

    const paymentInfo = await payment.get({ id: paymentId });

    const reservaId = getReservaId(paymentInfo);
    if (!reservaId) {
      return NextResponse.json({ error: 'No reserva ID' }, { status: 400 });
    }

    const nuevoEstado = mapPaymentStatus(paymentInfo.status);
    if (!nuevoEstado) {
      return NextResponse.json({ received: true, status: paymentInfo.status });
    }

    const { error: updateError } = await getSupabaseAdmin()
      .from('reservas')
      .update({
        estado: nuevoEstado,
        mp_payment_id: String(paymentInfo.id),
      } as never)
      .eq('id', reservaId);

    if (updateError) {
      return NextResponse.json({ error: 'Error actualizando reserva' }, { status: 500 });
    }

    return NextResponse.json({ received: true, status: nuevoEstado });
  } catch (error) {
    console.error('Error procesando webhook de Mercado Pago:', error);
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Webhook activo',
    timestamp: new Date().toISOString(),
  });
}
