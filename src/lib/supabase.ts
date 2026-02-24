// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE.TS - Clientes de Supabase
// ═══════════════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE LA BASE DE DATOS
// ─────────────────────────────────────────────────────────────────────────────
export interface Reserva {
  id: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  fecha: string;
  cantidad_personas: number;
  comentarios: string | null;
  precio_total: number;
  monto_sena: number;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  creado_en: string;
  actualizado_en: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE PÚBLICO (para el frontend)
// ─────────────────────────────────────────────────────────────────────────────
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE ADMIN (solo para el backend/API Routes)
// ─────────────────────────────────────────────────────────────────────────────
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES HELPER
// ─────────────────────────────────────────────────────────────────────────────
export async function obtenerFechasOcupadas(): Promise<string[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select('fecha')
    .eq('estado', 'confirmada');

  if (error) {
    console.error('Error obteniendo fechas ocupadas:', error);
    return [];
  }

  return data.map((r) => r.fecha);
}
