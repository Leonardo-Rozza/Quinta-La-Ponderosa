import { PRECIOS, obtenerFechasBloqueadasManuales } from '@/lib/constants';
import { getSupabaseAdmin, hasSupabaseAdminConfig, type Reserva } from '@/lib/supabase';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

const ESTADOS_BLOQUEANTES = ['confirmada', 'pendiente'] as const;
const RESERVA_HOLD_MINUTES = 30;
type ReservaBloqueante = Pick<Reserva, 'id' | 'estado' | 'creado_en'>;
type ReservaBloqueanteConFecha = Pick<Reserva, 'fecha' | 'estado' | 'creado_en'>;

function getMercadoPagoClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN is required.');
  }

  return new MercadoPagoConfig({ accessToken });
}

function getSiteUrl() {
  return (
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

function isPendingReservaActive(creadoEn: string | null) {
  if (!creadoEn) {
    return true;
  }

  const createdAt = new Date(creadoEn).getTime();
  if (Number.isNaN(createdAt)) {
    return true;
  }

  return Date.now() - createdAt < RESERVA_HOLD_MINUTES * 60 * 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST - Crear reserva
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json(
        { error: 'Falta configurar Supabase para registrar reservas' },
        { status: 503 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { nombreCompleto, email, telefono, fecha, cantidadPersonas, comentarios } = body;
    const fechasBloqueadasManuales = obtenerFechasBloqueadasManuales();

    if (!nombreCompleto || !email || !telefono || !fecha || !cantidadPersonas) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    if (fechasBloqueadasManuales.includes(fecha)) {
      return NextResponse.json(
        { error: 'La fecha seleccionada ya está bloqueada manualmente' },
        { status: 409 }
      );
    }

    // Verificar disponibilidad
    const { data, error: disponibilidadError } = await supabaseAdmin
      .from('reservas')
      .select('id, estado, creado_en')
      .eq('fecha', fecha)
      .in('estado', [...ESTADOS_BLOQUEANTES]);

    if (disponibilidadError) {
      return NextResponse.json({ error: 'Error verificando disponibilidad' }, { status: 500 });
    }

    const reservasExistentes = ((data ?? []) as ReservaBloqueante[]);

    const reservasPendientesExpiradas =
      reservasExistentes?.filter(
        (reserva) => reserva.estado === 'pendiente' && !isPendingReservaActive(reserva.creado_en)
      ) ?? [];

    if (reservasPendientesExpiradas.length > 0) {
      await supabaseAdmin
        .from('reservas')
        .update({ estado: 'cancelada' } as never)
        .in(
          'id',
          reservasPendientesExpiradas.map((reserva) => reserva.id)
        );
    }

    const tieneReservaActiva = reservasExistentes?.some((reserva) => {
      if (reserva.estado === 'confirmada') {
        return true;
      }

      return isPendingReservaActive(reserva.creado_en);
    });

    if (tieneReservaActiva) {
      return NextResponse.json(
        { error: 'La fecha seleccionada ya no está disponible' },
        { status: 409 }
      );
    }

    // Calcular precios
    const precioTotal = PRECIOS.porDia;
    const montoSena = Math.round(precioTotal * PRECIOS.porcentajeSena);

    // Crear reserva en Supabase
    const { data: reservaCreada, error: errorReserva } = await supabaseAdmin
      .from('reservas')
      .insert(
        {
          nombre_completo: nombreCompleto,
          email,
          telefono,
          fecha,
          cantidad_personas: cantidadPersonas,
          comentarios: comentarios || null,
          precio_total: precioTotal,
          monto_sena: montoSena,
          estado: 'pendiente',
        } as never
      )
      .select()
      .single();

    if (errorReserva) {
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
    }

    const reserva = reservaCreada as Reserva | null;
    if (!reserva) {
      return NextResponse.json({ error: 'No se pudo recuperar la reserva creada' }, { status: 500 });
    }

    // Crear preferencia de MercadoPago
    const siteUrl = getSiteUrl();
    const preference = new Preference(getMercadoPagoClient());

    let mpPreference;

    try {
      mpPreference = await preference.create({
        body: {
          items: [
            {
              id: reserva.id,
              title: `Seña La Ponderosa - ${fecha}`,
              description: `Reserva para ${cantidadPersonas} personas`,
              quantity: 1,
              currency_id: 'ARS',
              unit_price: montoSena,
            },
          ],
          payer: {
            name: nombreCompleto.split(' ')[0] || 'Cliente',
            surname: nombreCompleto.split(' ').slice(1).join(' ') || '',
            email,
          },
          back_urls: {
            success: siteUrl + '/reserva/confirmada',
            failure: siteUrl + '/reserva/error',
            pending: siteUrl + '/reserva/pendiente',
          },
          auto_return: 'approved',
          external_reference: reserva.id,
          metadata: {
            reserva_id: reserva.id,
            fecha,
          },
          notification_url: siteUrl + '/api/webhook',
        },
        requestOptions: {
          idempotencyKey: reserva.id,
        },
      });
    } catch (error) {
      console.error('Error creando preferencia de Mercado Pago:', error);

      await supabaseAdmin
        .from('reservas')
        .update({ estado: 'cancelada' } as never)
        .eq('id', reserva.id);

      return NextResponse.json(
        { error: 'No se pudo iniciar el pago. Intentá nuevamente.' },
        { status: 502 }
      );
    }

    // Actualizar reserva con preference ID
    const { error: preferenceUpdateError } = await supabaseAdmin
      .from('reservas')
      .update({ mp_preference_id: mpPreference.id } as never)
      .eq('id', reserva.id);

    if (preferenceUpdateError) {
      return NextResponse.json(
        { error: 'La reserva fue creada pero no se pudo guardar la referencia del pago' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reservaId: reserva.id,
      checkoutUrl: mpPreference.init_point,
      sandboxUrl: mpPreference.sandbox_init_point,
    });
  } catch (error) {
    console.error('Error en POST /api/reservas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET - Obtener fechas ocupadas
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const fechasBloqueadasManuales = obtenerFechasBloqueadasManuales();

    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json({
        fechasOcupadas: fechasBloqueadasManuales,
        warning: 'Supabase no está configurado; se muestran solo fechas manuales',
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('reservas')
      .select('fecha, estado, creado_en')
      .in('estado', [...ESTADOS_BLOQUEANTES]);

    if (error) {
      return NextResponse.json({ error: 'Error al obtener fechas' }, { status: 500 });
    }

    const reservas = ((data ?? []) as ReservaBloqueanteConFecha[]);

    const fechasOcupadasDb = reservas
      .filter(
        (reserva) =>
          reserva.estado === 'confirmada' ||
          (reserva.estado === 'pendiente' && isPendingReservaActive(reserva.creado_en))
      )
      .map((reserva) => reserva.fecha);

    const fechasOcupadas = [...new Set([...fechasOcupadasDb, ...fechasBloqueadasManuales])].sort();

    return NextResponse.json({ fechasOcupadas });
  } catch (error) {
    console.error('Error en GET /api/reservas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
