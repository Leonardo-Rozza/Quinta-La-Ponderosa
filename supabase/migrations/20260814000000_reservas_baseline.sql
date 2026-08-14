-- Baseline reproducible de reservas. En una base nueva crea el contrato completo
-- que consumen las migraciones posteriores; en una base legacy no reemplaza la
-- tabla existente y deja que 0100 agregue y concilie las columnas nuevas.

create extension if not exists pgcrypto;

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid,
  nombre_completo text not null,
  email text not null,
  telefono text not null,
  fecha date not null,
  cantidad_personas integer not null,
  comentarios text,
  precio_total numeric(12, 2) not null,
  monto_sena numeric(12, 2) not null,
  estado text not null default 'pendiente',
  estado_pago text not null default 'sin_iniciar',
  mp_preference_id text,
  mp_payment_id text,
  mp_last_payment_id text,
  mp_last_event_id text,
  mp_empty_reconciliation_at timestamptz,
  next_reconciliation_at timestamptz not null default now(),
  hold_expires_at timestamptz not null default (now() + interval '30 minutes'),
  checkout_url text,
  sandbox_checkout_url text,
  actor_hash text,
  terminos_aceptados_en timestamptz,
  requiere_revision boolean not null default false,
  revision_motivo text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint reservas_estado_check
    check (estado in ('pendiente', 'confirmada', 'cancelada')),
  constraint reservas_estado_pago_check
    check (
      estado_pago in (
        'sin_iniciar',
        'pendiente',
        'aprobado',
        'rechazado',
        'reembolsado',
        'contracargo'
      )
    ),
  constraint reservas_nombre_completo_check
    check (char_length(nombre_completo) between 3 and 100),
  constraint reservas_email_length_check
    check (char_length(email) between 3 and 254),
  constraint reservas_telefono_length_check
    check (char_length(telefono) between 8 and 20),
  constraint reservas_cantidad_personas_check
    check (cantidad_personas between 1 and 30),
  constraint reservas_comentarios_length_check
    check (comentarios is null or char_length(comentarios) <= 500),
  constraint reservas_importes_check
    check (precio_total > 0 and monto_sena > 0 and monto_sena <= precio_total),
  constraint reservas_actor_hash_check
    check (actor_hash is null or actor_hash ~ '^[a-f0-9]{64}$'),
  constraint reservas_revision_motivo_check
    check (
      not requiere_revision
      or (revision_motivo is not null and btrim(revision_motivo) <> '')
    )
);

create or replace function public.set_reserva_actualizado_en()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.actualizado_en = now();
  return new;
end
$$;

drop trigger if exists reservas_set_actualizado_en on public.reservas;
create trigger reservas_set_actualizado_en
before update on public.reservas
for each row
execute function public.set_reserva_actualizado_en();

alter table public.reservas enable row level security;

revoke all on table public.reservas from public;
revoke all on function public.set_reserva_actualizado_en() from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.reservas from anon;
    revoke all on function public.set_reserva_actualizado_en() from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.reservas from authenticated;
    revoke all on function public.set_reserva_actualizado_en() from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.reservas to service_role;
  end if;
end
$$;
