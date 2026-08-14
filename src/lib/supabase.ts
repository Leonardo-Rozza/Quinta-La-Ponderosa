import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { EstadoPago, EstadoReserva } from './reservas/types';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Reserva = {
  id: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  fecha: string;
  cantidad_personas: number;
  comentarios: string | null;
  precio_total: number;
  monto_sena: number;
  estado: EstadoReserva;
  estado_pago: EstadoPago;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_last_payment_id: string | null;
  mp_last_event_id: string | null;
  mp_empty_reconciliation_at: string | null;
  next_reconciliation_at: string;
  booking_request_id: string | null;
  hold_expires_at: string;
  checkout_url: string | null;
  sandbox_checkout_url: string | null;
  actor_hash: string | null;
  terminos_aceptados_en: string | null;
  requiere_revision: boolean;
  revision_motivo: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type MpWebhookEventStatus =
  | 'pendiente'
  | 'procesando'
  | 'procesado'
  | 'ignorado'
  | 'error';

export type MpWebhookEvent = {
  id: string;
  event_key: string;
  resource_id: string;
  topic: string;
  action: string | null;
  payload: Json;
  signature_timestamp: string | null;
  status: MpWebhookEventStatus;
  attempts: number;
  next_attempt_at: string;
  error: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailOutboxStatus = 'pendiente' | 'procesando' | 'enviado' | 'error';
export type EmailOutboxType = 'reserva_confirmada' | 'reserva_revision';

export type EmailOutboxEntry = {
  id: string;
  reserva_id: string;
  tipo: EmailOutboxType;
  dedupe_key: string;
  payload: Json;
  status: EmailOutboxStatus;
  attempts: number;
  next_attempt_at: string;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiRateLimitRow = {
  actor_hash: string;
  scope: string;
  window_started_at: string;
  request_count: number;
  updated_at: string;
};

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
          estado: EstadoReserva;
          estado_pago?: EstadoPago;
          mp_preference_id?: string | null;
          mp_payment_id?: string | null;
          mp_last_payment_id?: string | null;
          mp_last_event_id?: string | null;
          mp_empty_reconciliation_at?: string | null;
          next_reconciliation_at?: string;
          booking_request_id?: string | null;
          hold_expires_at?: string;
          checkout_url?: string | null;
          sandbox_checkout_url?: string | null;
          actor_hash?: string | null;
          terminos_aceptados_en?: string | null;
          requiere_revision?: boolean;
          revision_motivo?: string | null;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: Partial<Omit<Reserva, 'id'>> & { id?: string };
        Relationships: [];
      };
      mp_webhook_events: {
        Row: MpWebhookEvent;
        Insert: {
          id?: string;
          event_key: string;
          resource_id: string;
          topic: string;
          action?: string | null;
          payload?: Json;
          signature_timestamp?: string | null;
          status?: MpWebhookEventStatus;
          attempts?: number;
          next_attempt_at?: string;
          error?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MpWebhookEvent>;
        Relationships: [];
      };
      email_outbox: {
        Row: EmailOutboxEntry;
        Insert: {
          id?: string;
          reserva_id: string;
          tipo: EmailOutboxType;
          dedupe_key: string;
          payload?: Json;
          status?: EmailOutboxStatus;
          attempts?: number;
          next_attempt_at?: string;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<EmailOutboxEntry>;
        Relationships: [
          {
            foreignKeyName: 'email_outbox_reserva_id_fkey';
            columns: ['reserva_id'];
            isOneToOne: false;
            referencedRelation: 'reservas';
            referencedColumns: ['id'];
          },
        ];
      };
      api_rate_limits: {
        Row: ApiRateLimitRow;
        Insert: ApiRateLimitRow;
        Update: Partial<ApiRateLimitRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_rate_limit: {
        Args: {
          p_actor_hash: string;
          p_scope: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          reset_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

let supabaseAdminClient: SupabaseClient<Database> | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function hasSupabaseAdminConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient<Database>(
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return supabaseAdminClient;
}
