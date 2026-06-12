import { RESERVA_HOLD_MINUTES } from '@/lib/constants';
import { getSupabaseAdmin, hasSupabaseAdminConfig, type Reserva } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Cancela las reservas "pendiente" cuyo hold ya venció (no se acreditó el pago
// dentro de RESERVA_HOLD_MINUTES). Pensado para ejecutarse periódicamente desde
// Vercel Cron; mantiene la base prolija en vez de depender solo de la limpieza
// perezosa que hace el POST /api/reservas.
// ─────────────────────────────────────────────────────────────────────────────

function autorizado(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  // Sin secret configurado dejamos pasar (útil en desarrollo). En producción,
  // definir CRON_SECRET para que solo el cron pueda invocarlo.
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 });
  }

  const limite = new Date(Date.now() - RESERVA_HOLD_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from('reservas')
    .update({ estado: 'cancelada' } as never)
    .eq('estado', 'pendiente')
    .lt('creado_en', limite)
    .select('id');

  if (error) {
    console.error('Error limpiando reservas pendientes vencidas:', error);
    return NextResponse.json({ error: 'Error al limpiar reservas' }, { status: 500 });
  }

  const canceladas = (data as Pick<Reserva, 'id'>[] | null)?.length ?? 0;
  return NextResponse.json({ ok: true, canceladas });
}
