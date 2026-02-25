// ═══════════════════════════════════════════════════════════════════════════════
// /api/reservas/route.ts - Crear reserva y generar link de MercadoPago
// ═══════════════════════════════════════════════════════════════════════════════
import { PRECIOS } from '@/lib/constants';
import { supabaseAdmin } from '@/lib/supabase';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

// Configurar MercadoPago
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

// ─────────────────────────────────────────────────────────────────────────────
// POST - Crear reserva
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombreCompleto, email, telefono, fecha, cantidadPersonas, comentarios } = body;

    console.log('📝 Datos recibidos:', {
      nombreCompleto,
      email,
      telefono,
      fecha,
      cantidadPersonas,
    });

    if (!nombreCompleto || !email || !telefono || !fecha || !cantidadPersonas) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // Verificar disponibilidad
    const { data: reservaExistente } = await supabaseAdmin
      .from('reservas')
      .select('id')
      .eq('fecha', fecha)
      .eq('estado', 'confirmada')
      .single();

    if (reservaExistente) {
      return NextResponse.json(
        { error: 'La fecha seleccionada ya no está disponible' },
        { status: 409 }
      );
    }

    // Calcular precios
    const precioTotal = PRECIOS.porDia;
    const montoSena = Math.round(precioTotal * PRECIOS.porcentajeSena);

    console.log('💰 Precios:', { precioTotal, montoSena });

    // Crear reserva en Supabase
    const { data: reserva, error: errorReserva } = await supabaseAdmin
      .from('reservas')
      .insert({
        nombre_completo: nombreCompleto,
        email,
        telefono,
        fecha,
        cantidad_personas: cantidadPersonas,
        comentarios: comentarios || null,
        precio_total: precioTotal,
        monto_sena: montoSena,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (errorReserva) {
      console.error('❌ Error creando reserva en Supabase:', errorReserva);
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
    }

    console.log('✅ Reserva creada en Supabase:', reserva.id);

    // Crear preferencia de MercadoPago
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const preference = new Preference(mpClient);

    const mpPreference = await preference.create({
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
          email: email,
        },
        back_urls: {
          success: siteUrl + '/reserva/confirmada',
          failure: siteUrl + '/reserva/error',
          pending: siteUrl + '/reserva/pendiente',
        },
        external_reference: reserva.id,
      },
    });

    console.log('✅ Preferencia MP creada:', mpPreference.id);
    console.log('🔗 URL de pago:', mpPreference.init_point);

    // Actualizar reserva con preference ID
    await supabaseAdmin
      .from('reservas')
      .update({ mp_preference_id: mpPreference.id })
      .eq('id', reserva.id);

    return NextResponse.json({
      success: true,
      reservaId: reserva.id,
      checkoutUrl: mpPreference.init_point,
      sandboxUrl: mpPreference.sandbox_init_point,
    });
  } catch (error) {
    console.error('❌ Error en POST /api/reservas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET - Obtener fechas ocupadas
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('reservas')
      .select('fecha')
      .eq('estado', 'confirmada');

    if (error) {
      console.error('Error obteniendo fechas:', error);
      return NextResponse.json({ error: 'Error al obtener fechas' }, { status: 500 });
    }

    const fechasOcupadas = data.map((r) => r.fecha);

    return NextResponse.json({ fechasOcupadas });
  } catch (error) {
    console.error('Error en GET /api/reservas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
