-- ============================================================
-- Waslerr Fields — Supabase schema (Phase 1: products + auth)
-- Run this in the Supabase SQL editor once.
-- ============================================================

-- Products (subs) ------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  line        text not null default 'desire',   -- 'desire' | 'akashic' | 'wealth'
  price       numeric not null default 0,         -- 0 = free
  description text not null default '',
  image_url   text,
  created_at  timestamptz not null default now()
);

alter table public.products enable row level security;

-- Anyone may read the catalogue.
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (true);

-- Writes are NOT exposed to clients. The backend performs inserts/deletes
-- with the service-role key (which bypasses RLS) only after verifying the
-- caller is the admin. So no client write policy is defined on purpose.

-- Storage bucket for product images (public read) ----------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Seed the starter catalogue (only if empty) ---------------------
insert into public.products (title, line, price, description)
select * from (values
  ('Valentine Ultimate Male Aura', 'desire', 151, 'An advanced, slightly-audible subliminal layering Desire Code and Akashic Field to build a magnetic masculine aura and an unshakable presence.'),
  ('Perfect Hairs', 'desire', 320, 'Two audios in one. Each blends subliminal affirmations, a Desire Code and a dedicated hair field to support thicker, healthier growth.'),
  ('Porn-Addiction Freedom', 'akashic', 95, 'A complex audio with audible affirmations, Akashic Field and Desire Code engineered to dissolve compulsive habits and restore self-control.'),
  ('Harem Paradise', 'desire', 795, 'A premium Desire Code built to manifest a life of abundance, magnetism and devotion — entirely on your own terms.'),
  ('Limitless Wealth', 'wealth', 199, 'Reprogram your money setpoint. Desire Code and Akashic Field align identity, action and opportunity around lasting wealth.'),
  ('Deep Akashic Healing', 'akashic', 249, 'Return to the deeper record of self — release inherited blocks and restore intuition, calm and alignment from the source.'),
  ('Morning Ignition', 'desire', 0, 'A two-minute primer of confidence and clarity to start the day decisive.'),
  ('Calm Current', 'akashic', 0, 'Grounding delta tones to release tension and return you to center.'),
  ('Abundance Spark', 'wealth', 0, 'A taster of the wealth field — feel the shift in your money mindset before you commit.')
) as seed(title, line, price, description)
where not exists (select 1 from public.products);

-- ============================================================
-- Phase 2 (coupons + persistent support chat) lands here later.
-- ============================================================
