-- ============================================================
-- Waslerr Fields — Offers (field offered in support chat → pay → deliver)
-- Run this in the Supabase SQL editor once.
--
-- An offer is a paid "field" an admin quotes inside a support conversation.
-- State machine (enforced in the backend): sent → paid → delivered (+ cancelled).
-- Payment reuses the existing crypto checkout (orders table); confirmation is
-- poll-based (no webhook in this stack).
-- ============================================================

create table if not exists public.offers (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    text not null,
  customer_email     text,
  name               text not null,
  description        text not null default '',
  amount             numeric not null,
  currency           text not null default 'USD',
  delivery_estimate  text not null default '6–7 days',
  includes           jsonb not null default '[]'::jsonb,
  status             text not null default 'sent',     -- sent | paid | delivered | cancelled
  reference          text,                              -- orders.reference once checkout starts
  payment_method     text,                              -- paypal | binance
  paid_at            timestamptz,
  delivered_at       timestamptz,
  delivery_file_url  text,
  delivery_file_name text,
  delivery_note      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists offers_conv_idx on public.offers (conversation_id, created_at);
create index if not exists offers_reference_idx on public.offers (reference);

alter table public.offers enable row level security;
-- backend (service-role) is the only reader/writer; no client policy on purpose.

create or replace function public.touch_offers_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists offers_touch_updated_at on public.offers;
create trigger offers_touch_updated_at
  before update on public.offers
  for each row execute function public.touch_offers_updated_at();

-- ------------------------------------------------------------
-- Typed chat messages: a support_messages row can render as a card.
-- kind ∈ text | customCodeRequest | offer | systemPaid | delivery
-- meta carries { offerId, ... } for the card.
-- ------------------------------------------------------------
alter table public.support_messages add column if not exists kind text not null default 'text';
alter table public.support_messages add column if not exists meta jsonb;

-- ------------------------------------------------------------
-- Private bucket for delivered files (NOT public — served via signed URL).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('deliveries', 'deliveries', false)
on conflict (id) do nothing;
