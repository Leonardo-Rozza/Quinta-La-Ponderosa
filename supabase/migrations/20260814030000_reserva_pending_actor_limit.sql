-- El chequeo previo de la API mejora la respuesta, pero solo la base puede
-- impedir que dos solicitudes concurrentes creen más holds de los permitidos.

create or replace function public.enforce_reserva_pending_actor_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pending_count integer;
begin
  if new.actor_hash is null or new.estado <> 'pendiente' then
    return new;
  end if;

  -- El hash HMAC de la IP es la clave de serialización. El lock dura hasta el
  -- final de la transacción, de modo que el siguiente insert ve el anterior.
  perform pg_advisory_xact_lock(
    hashtextextended('reserva-pending:' || new.actor_hash, 0)
  );

  select count(*)
  into v_pending_count
  from public.reservas
  where actor_hash = new.actor_hash
    and estado = 'pendiente'
    and id is distinct from new.id;

  if v_pending_count >= 2 then
    raise exception using
      errcode = '23514',
      message = 'reservas_actor_pending_limit',
      detail = 'No puede haber más de dos reservas pendientes por actor',
      constraint = 'reservas_actor_pending_limit';
  end if;

  return new;
end
$$;

drop trigger if exists reservas_pending_actor_limit_insert on public.reservas;
create trigger reservas_pending_actor_limit_insert
before insert on public.reservas
for each row
execute function public.enforce_reserva_pending_actor_limit();

drop trigger if exists reservas_pending_actor_limit_update on public.reservas;
create trigger reservas_pending_actor_limit_update
before update of estado, actor_hash on public.reservas
for each row
execute function public.enforce_reserva_pending_actor_limit();

revoke all on function public.enforce_reserva_pending_actor_limit() from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.enforce_reserva_pending_actor_limit() from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.enforce_reserva_pending_actor_limit() from authenticated;
  end if;
end
$$;
