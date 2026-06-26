-- ============================================================
-- Waslerr Fields — Stats (dedicated rollup table)
-- Run this in the Supabase SQL editor once (after orders.sql).
--
-- Stats live in their OWN table (stats_daily): one row per calendar day with
-- revenue + sales + downloads. A trigger on `orders` rolls each delivered/paid
-- order into its day automatically, so weekly / monthly / yearly / all-time
-- figures are always real and current. The admin stats endpoint reads from
-- this table (not by re-scanning orders).
-- ============================================================

create table if not exists public.stats_daily (
  day        date primary key,
  revenue    numeric not null default 0,
  sales      integer not null default 0,
  downloads  integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.stats_daily enable row level security;
-- backend (service-role) is the only reader/writer; no client policy on purpose.

-- ------------------------------------------------------------
-- Trigger: roll a paid/delivered order into its day exactly once.
-- Fires when an order first enters a paid/delivered state.
-- ------------------------------------------------------------
create or replace function public.rollup_order_stats()
returns trigger language plpgsql as $$
declare
  d date;
begin
  if (TG_OP = 'INSERT' and NEW.status in ('paid','delivered'))
     or (TG_OP = 'UPDATE'
         and NEW.status in ('paid','delivered')
         and coalesce(OLD.status,'') not in ('paid','delivered')) then
    d := (NEW.created_at)::date;
    insert into public.stats_daily (day, revenue, sales, downloads)
    values (d, coalesce(NEW.amount, 0), 1, 1)
    on conflict (day) do update set
      revenue   = public.stats_daily.revenue + coalesce(NEW.amount, 0),
      sales     = public.stats_daily.sales + 1,
      downloads = public.stats_daily.downloads + 1,
      updated_at = now();
  end if;
  return NEW;
end $$;

drop trigger if exists orders_rollup_stats on public.orders;
create trigger orders_rollup_stats
  after insert or update on public.orders
  for each row execute function public.rollup_order_stats();

-- ------------------------------------------------------------
-- Backfill: seed stats_daily from any orders that are already paid/delivered.
-- Safe to re-run (overwrites each day's totals from the source orders).
-- ------------------------------------------------------------
insert into public.stats_daily (day, revenue, sales, downloads)
select (created_at)::date, sum(coalesce(amount,0)), count(*), count(*)
from public.orders
where status in ('paid','delivered')
group by (created_at)::date
on conflict (day) do update set
  revenue   = excluded.revenue,
  sales     = excluded.sales,
  downloads = excluded.downloads,
  updated_at = now();
