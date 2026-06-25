-- ============================================================
-- Waslerr Fields — Supabase schema (Phase 2: coupons + support chat)
-- Run this in the Supabase SQL editor after schema.sql.
-- Both tables are accessed only through the backend (service-role key),
-- so RLS is enabled with no client policies (clients can't read/write directly).
-- ============================================================

-- Coupons / discounts -------------------------------------------
create table if not exists public.coupons (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  type       text not null default 'percent',   -- 'percent' | 'fixed'
  value      numeric not null default 0,         -- percent (0-100) or fixed dollars
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

-- Support chat --------------------------------------------------
create table if not exists public.support_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  sender          text not null,                 -- 'user' | 'admin'
  body            text not null,
  email           text,
  created_at      timestamptz not null default now()
);
create index if not exists support_messages_conv_idx
  on public.support_messages (conversation_id, created_at);
alter table public.support_messages enable row level security;
