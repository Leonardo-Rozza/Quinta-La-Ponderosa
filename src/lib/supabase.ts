// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE.TS - Clientes de Supabase
// ═══════════════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

export interface Database {
  public: {
    Tables: {
      reservas: {
        Row: Reserva;
        Insert: {
          id?: string;
          nombre_completo: string;
          email: string;
          telefono: string;
          fecha: string;
          cantidad_personas: number;
          comentarios?: string | null;
          precio_total: number;
          monto_sena: number;
          estado: Reserva['estado'];
          mp_preference_id?: string | null;
          mp_payment_id?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: Partial<{
          id: string;
          nombre_completo: string;
          email: string;
          telefono: string;
          fecha: string;
          cantidad_personas: number;
          comentarios: string | null;
          precio_total: number;
          monto_sena: number;
          estado: Reserva['estado'];
          mp_preference_id: string | null;
          mp_payment_id: string | null;
          creado_en: string;
          actualizado_en: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

let supabaseClient: SupabaseClient<Database> | null = null;
let supabaseAdminClient: SupabaseClient<Database> | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE PÚBLICO (para el frontend)
// ─────────────────────────────────────────────────────────────────────────────
export function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    );
  }

  return supabaseClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE ADMIN (solo para el backend/API Routes)
// ─────────────────────────────────────────────────────────────────────────────
export function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    );
  }

  return supabaseAdminClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES HELPER
// ─────────────────────────────────────────────────────────────────────────────
export async function obtenerFechasOcupadas(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('reservas')
    .select('fecha')
    .eq('estado', 'confirmada');

  if (error) {
    console.error('Error obteniendo fechas ocupadas:', error);
    return [];
  }

  const reservas = (data ?? []) as Array<Pick<Reserva, 'fecha'>>;
  return reservas.map((reserva) => reserva.fecha);
}
