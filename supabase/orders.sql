-- ============================================================
-- Waslerr Fields — Orders (server-authoritative payment records)
-- Run this in the Supabase SQL editor once.
--
-- The backend is the ONLY writer (service-role key bypasses RLS). The
-- frontend never sets prices or marks an order paid — it only polls status.
-- ============================================================

create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  reference    text unique not null,            -- WF-XXX-XXXXX note-to-payee
  field_id     text not null,                   -- products.id (uuid as text) or seed id
  field_title  text,
  method       text not null,                   -- 'paypal' | 'binance'
  amount       numeric not null,                -- USD, set server-side from the catalog
  currency     text not null default 'USD',
  status       text not null default 'pending', -- pending | detected | paid | delivered | expired | failed
  txid         text,                            -- transaction id (PayPal capture id / Binance txn)
  prepay_id    text,                            -- Binance Pay prepayId (if order created via merchant API)
  buyer_email  text,
  coupon       text,
  meta         jsonb,                           -- raw provider payload for audit
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists orders_reference_idx on public.orders (reference);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

-- No client policies on purpose: all reads/writes go through the backend with
-- the service-role key after server-side validation. RLS-on with no policy =
-- clients get nothing, which is exactly what we want.

create or replace function public.touch_orders_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_orders_updated_at();
