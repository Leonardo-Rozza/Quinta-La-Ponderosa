-- Evolución segura e idempotente para reservas, webhooks, notificaciones y rate limit.
-- La migración baseline anterior crea public.reservas en instalaciones nuevas;
-- estos ALTER también permiten actualizar una tabla legacy preexistente.

create extension if not exists pgcrypto;

alter table public.reservas
  add column if not exists booking_request_id uuid,
  add column if not exists hold_expires_at timestamptz,
  add column if not exists checkout_url text,
  add column if not exists sandbox_checkout_url text,
  add column if not exists estado_pago text,
  add column if not exists requiere_revision boolean,
  add column if not exists revision_motivo text,
  add column if not exists mp_last_payment_id text,
  add column if not exists mp_last_event_id text,
  add column if not exists actor_hash text,
  add column if not exists terminos_aceptados_en timestamptz;

update public.reservas
set hold_expires_at = coalesce(creado_en, now()) + interval '30 minutes'
where hold_expires_at is null;

update public.reservas
set estado_pago = case
  when estado = 'confirmada'
    and nullif(btrim(mp_payment_id), '') is not null
    then 'aprobado'
  when estado = 'pendiente'
    and nullif(btrim(mp_preference_id), '') is not null
    then 'pendiente'
  else 'sin_iniciar'
end
where estado_pago is null;

-- No inventamos un resultado financiero al migrar filas históricas ambiguas.
-- Conservan un estado neutro y quedan señaladas para conciliación manual.
update public.reservas
set
  requiere_revision = true,
  revision_motivo = coalesce(
    nullif(btrim(revision_motivo), ''),
    case
      when estado = 'confirmada'
        and nullif(btrim(mp_payment_id), '') is null
        then 'Migración: reserva confirmada sin identificador de pago; requiere conciliación'
      when estado = 'cancelada'
        and nullif(btrim(mp_payment_id), '') is not null
        then 'Migración: reserva cancelada con identificador de pago; requiere conciliación'
    end
  )
where
  (
    estado = 'confirmada'
    and nullif(btrim(mp_payment_id), '') is null
  )
  or (
    estado = 'cancelada'
    and nullif(btrim(mp_payment_id), '') is not null
  );

update public.reservas
set requiere_revision = false
where requiere_revision is null;

alter table public.reservas
  alter column hold_expires_at set default (now() + interval '30 minutes'),
  alter column hold_expires_at set not null,
  alter column estado_pago set default 'sin_iniciar',
  alter column estado_pago set not null,
  alter column requiere_revision set default false,
  alter column requiere_revision set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reservas'::regclass
      and conname = 'reservas_estado_pago_check'
  ) then
    alter table public.reservas
      add constraint reservas_estado_pago_check
      check (
        estado_pago in (
          'sin_iniciar',
          'pendiente',
          'aprobado',
          'rechazado',
          'reembolsado',
          'contracargo'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reservas'::regclass
      and conname = 'reservas_actor_hash_check'
  ) then
    alter table public.reservas
      add constraint reservas_actor_hash_check
      check (actor_hash is null or actor_hash ~ '^[a-f0-9]{64}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reservas'::regclass
      and conname = 'reservas_revision_motivo_check'
  ) then
    alter table public.reservas
      add constraint reservas_revision_motivo_check
      check (
        not requiere_revision
        or (revision_motivo is not null and btrim(revision_motivo) <> '')
      );
  end if;
end
$$;

-- La base, y no el chequeo previo de la API, es la garantía contra carreras.
do $$
begin
  if exists (
    select 1
    from public.reservas
    where estado in ('confirmada', 'pendiente')
    group by fecha
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'No se puede crear reservas_fecha_activa_idx: existen fechas activas duplicadas',
      hint = 'Resolver explícitamente los duplicados históricos antes de volver a aplicar la migración';
  end if;
end
$$;

create unique index if not exists reservas_fecha_activa_idx
  on public.reservas (fecha)
  where estado in ('confirmada', 'pendiente');

create unique index if not exists reservas_booking_request_id_idx
  on public.reservas (booking_request_id)
  where booking_request_id is not null;

create index if not exists reservas_hold_expires_at_idx
  on public.reservas (hold_expires_at)
  where estado = 'pendiente';

create index if not exists reservas_actor_pending_idx
  on public.reservas (actor_hash, hold_expires_at)
  where estado = 'pendiente' and actor_hash is not null;

create or replace function public.enforce_reserva_monotonic_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.estado = 'confirmada' and new.estado <> 'confirmada' then
    raise exception using
      errcode = '23514',
      message = 'Una reserva confirmada no puede degradar su estado';
  end if;

  if old.estado = 'cancelada' and new.estado = 'confirmada' then
    raise exception using
      errcode = '23514',
      message = 'Una aprobación tardía requiere revisión y no puede reactivar la reserva';
  end if;

  if old.estado_pago = 'aprobado'
     and new.estado_pago in ('sin_iniciar', 'pendiente', 'rechazado') then
    raise exception using
      errcode = '23514',
      message = 'Un pago aprobado no puede degradar su estado';
  end if;

  if old.estado_pago = 'contracargo'
     and new.estado_pago <> 'contracargo' then
    raise exception using
      errcode = '23514',
      message = 'Un contracargo es terminal y no puede cambiar de estado';
  end if;

  if old.estado_pago = 'reembolsado'
     and new.estado_pago not in ('reembolsado', 'contracargo') then
    raise exception using
      errcode = '23514',
      message = 'Un reembolso solo puede progresar a contracargo';
  end if;

  return new;
end
$$;

drop trigger if exists reservas_monotonic_state on public.reservas;
create trigger reservas_monotonic_state
before update of estado, estado_pago on public.reservas
for each row
execute function public.enforce_reserva_monotonic_state();

create table if not exists public.mp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  resource_id text not null,
  topic text not null,
  action text,
  payload jsonb not null default '{}'::jsonb,
  signature_timestamp timestamptz,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'procesando', 'procesado', 'ignorado', 'error')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mp_webhook_events_pending_idx
  on public.mp_webhook_events (next_attempt_at, created_at)
  where status in ('pendiente', 'error');

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  tipo text not null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'procesando', 'enviado', 'error')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.email_outbox'::regclass
      and conname = 'email_outbox_tipo_check'
  ) then
    alter table public.email_outbox
      add constraint email_outbox_tipo_check
      check (tipo in ('reserva_confirmada', 'reserva_revision'));
  end if;
end
$$;

-- Las revisiones creadas por el backfill no pueden depender de una UI admin
-- inexistente. Sembramos una alerta durable, sin PII en el payload y con una
-- clave equivalente a la dedupe semántica de la aplicación.
insert into public.email_outbox (
  reserva_id,
  tipo,
  dedupe_key,
  payload
)
select
  reservas.id,
  'reserva_revision',
  'reserva-revision:' || reservas.id::text || ':' || substr(
    encode(
      digest(
        'migration:20260814010000:' || reservas.revision_motivo,
        'sha256'
      ),
      'hex'
    ),
    1,
    32
  ),
  jsonb_build_object(
    'reservaId', reservas.id,
    'reason', left(reservas.revision_motivo, 500),
    'paymentId', reservas.mp_payment_id,
    'eventKey', 'migration:20260814010000'
  )
from public.reservas
where reservas.requiere_revision
  and (
    (
      reservas.estado = 'confirmada'
      and nullif(btrim(reservas.mp_payment_id), '') is null
    )
    or (
      reservas.estado = 'cancelada'
      and nullif(btrim(reservas.mp_payment_id), '') is not null
    )
  )
on conflict (dedupe_key) do nothing;

create index if not exists email_outbox_pending_idx
  on public.email_outbox (next_attempt_at, created_at)
  where status in ('pendiente', 'error');

create table if not exists public.api_rate_limits (
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
  scope text not null check (char_length(scope) between 1 and 100),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (actor_hash, scope, window_started_at)
);

alter table public.mp_webhook_events enable row level security;
alter table public.email_outbox enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.reservas enable row level security;

create index if not exists api_rate_limits_updated_at_idx
  on public.api_rate_limits (updated_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists mp_webhook_events_set_updated_at on public.mp_webhook_events;
create trigger mp_webhook_events_set_updated_at
before update on public.mp_webhook_events
for each row execute function public.set_updated_at();

drop trigger if exists email_outbox_set_updated_at on public.email_outbox;
create trigger email_outbox_set_updated_at
before update on public.email_outbox
for each row execute function public.set_updated_at();

-- Rate limit atómico y distribuido. El RPC solo acepta un HMAC SHA-256; nunca IP cruda.
create or replace function public.consume_rate_limit(
  p_actor_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'actor_hash inválido';
  end if;

  if p_scope is null or char_length(p_scope) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'scope inválido';
  end if;

  if p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'limit inválido';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'window_seconds inválido';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  delete from public.api_rate_limits
  where actor_hash = p_actor_hash
    and scope = p_scope
    and window_started_at < v_window_start;

  insert into public.api_rate_limits (
    actor_hash,
    scope,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_actor_hash,
    p_scope,
    v_window_start,
    1,
    v_now
  )
  on conflict (actor_hash, scope, window_started_at)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into v_count;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  reset_at := v_window_start + make_interval(secs => p_window_seconds);
  return next;
end
$$;

revoke all on table public.mp_webhook_events from public;
revoke all on table public.email_outbox from public;
revoke all on table public.api_rate_limits from public;
revoke all on table public.reservas from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.mp_webhook_events from anon;
    revoke all on table public.email_outbox from anon;
    revoke all on table public.api_rate_limits from anon;
    revoke all on table public.reservas from anon;
    revoke all on function public.consume_rate_limit(text, text, integer, integer) from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.mp_webhook_events from authenticated;
    revoke all on table public.email_outbox from authenticated;
    revoke all on table public.api_rate_limits from authenticated;
    revoke all on table public.reservas from authenticated;
    revoke all on function public.consume_rate_limit(text, text, integer, integer) from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.mp_webhook_events to service_role;
    grant select, insert, update on table public.email_outbox to service_role;
    grant select, insert, update, delete on table public.api_rate_limits to service_role;
    grant select, insert, update on table public.reservas to service_role;
    grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
  end if;
end
$$;
