-- ============================================================
-- Waslerr Fields — Free fields (separate table from paid products)
-- Run this in the Supabase SQL editor once.
--
-- Free fields live in their own table so the paid catalogue (products) stays
-- clean and the two are managed independently in the admin panel.
-- ============================================================

create table if not exists public.free_fields (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  line        text not null default 'desire',   -- 'desire' | 'akashic' | 'wealth' | any
  description text not null default '',
  image_url   text,
  created_at  timestamptz not null default now()
);

alter table public.free_fields enable row level security;

-- Anyone may read free fields (public storefront).
drop policy if exists "free_fields_public_read" on public.free_fields;
create policy "free_fields_public_read" on public.free_fields
  for select using (true);

-- Writes go through the backend (service-role key) after admin verification —
-- no client write policy on purpose.

-- ------------------------------------------------------------
-- One-time migration: move existing FREE products (price = 0) out of
-- products and into free_fields, then delete them from products.
-- Safe to run repeatedly (only inserts rows not already present by title).
-- ------------------------------------------------------------
insert into public.free_fields (title, line, description, image_url, created_at)
select p.title, p.line, p.description, p.image_url, p.created_at
from public.products p
where p.price = 0
  and not exists (select 1 from public.free_fields f where f.title = p.title);

delete from public.products where price = 0;
