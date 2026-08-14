-- Evita liberar una fecha por consistencia eventual de /v1/payments/search.
-- La primera búsqueda vacía queda registrada; una ejecución posterior vuelve a
-- consultar Mercado Pago antes de que la aplicación pueda cancelar el hold.

alter table public.reservas
  add column if not exists mp_empty_reconciliation_at timestamptz;

create index if not exists reservas_empty_reconciliation_idx
  on public.reservas (mp_empty_reconciliation_at)
  where estado = 'pendiente' and mp_empty_reconciliation_at is not null;
