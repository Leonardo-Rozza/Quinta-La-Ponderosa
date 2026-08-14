-- Evita que pagos pendientes o errores transitorios monopolicen el lote del
-- cron. Cada reserva indica desde cuándo vuelve a ser elegible para conciliarse.

alter table public.reservas
  add column if not exists next_reconciliation_at timestamptz;

update public.reservas
set next_reconciliation_at = now()
where next_reconciliation_at is null;

alter table public.reservas
  alter column next_reconciliation_at set default now(),
  alter column next_reconciliation_at set not null;

create index if not exists reservas_next_reconciliation_idx
  on public.reservas (next_reconciliation_at, hold_expires_at)
  where estado = 'pendiente' and requiere_revision = false;
