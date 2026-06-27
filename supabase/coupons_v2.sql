-- ============================================================
-- Waslerr Fields — Coupons v2: per-field scope + usage + expiry
-- Run this in the Supabase SQL editor once.
--
-- field_id   : the paid field this coupon applies to (NULL = all paid fields)
-- max_uses   : how many times it can be redeemed (NULL = unlimited)
-- uses       : redemptions so far (incremented on confirmed payment)
-- expires_at : when it stops working (NULL = never)
-- ============================================================

alter table public.coupons add column if not exists field_id   text;
alter table public.coupons add column if not exists max_uses   integer;
alter table public.coupons add column if not exists uses       integer not null default 0;
alter table public.coupons add column if not exists expires_at timestamptz;
