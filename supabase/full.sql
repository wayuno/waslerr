-- ============================================================
-- Waslerr Fields — full schema (run this ONCE in Supabase SQL editor)
-- Idempotent: safe to re-run. Replaces needing schema/phase2/phase3
-- separately, and adds the announcement image column.
-- ============================================================

-- ---------- products ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  line        text not null default 'desire',
  price       numeric not null default 0,
  description text not null default '',
  image_url   text,
  created_at  timestamptz not null default now()
);
alter table public.products enable row level security;
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (true);

-- ---------- coupons ----------
create table if not exists public.coupons (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  type       text not null default 'percent',
  value      numeric not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

-- ---------- support chat ----------
create table if not exists public.support_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  sender          text not null,
  body            text not null,
  email           text,
  created_at      timestamptz not null default now()
);
create index if not exists support_messages_conv_idx on public.support_messages (conversation_id, created_at);
alter table public.support_messages enable row level security;

-- ---------- announcements (+ image) ----------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  tag        text not null default 'NEW FIELD',
  title      text not null,
  body       text not null default '',
  image_url  text,
  created_at timestamptz not null default now()
);
alter table public.announcements add column if not exists image_url text;
alter table public.announcements enable row level security;
drop policy if exists "announcements_public_read" on public.announcements;
create policy "announcements_public_read" on public.announcements for select using (true);

-- ---------- storage bucket for images ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ---------- seed products (only if empty) ----------
insert into public.products (title, line, price, description)
select * from (values
  ('Valentine Ultimate Male Aura', 'desire', 151, 'An advanced, slightly-audible subliminal layering Desire Code and Akashic Field to build a magnetic masculine aura and an unshakable presence.'),
  ('Porn-Addiction Freedom', 'akashic', 95, 'A complex audio with audible affirmations engineered to dissolve compulsive habits and restore self-control.'),
  ('Limitless Wealth', 'wealth', 199, 'Reprogram your money setpoint. Desire Code and Akashic Field align identity, action and opportunity around lasting wealth.'),
  ('Morning Ignition', 'desire', 0, 'A two-minute primer of confidence and clarity to start the day decisive.'),
  ('Calm Current', 'akashic', 0, 'Grounding delta tones to release tension and return you to center.'),
  ('Abundance Spark', 'wealth', 0, 'A taster of the wealth field — feel the shift in your money mindset before you commit.')
) as seed(title, line, price, description)
where not exists (select 1 from public.products);

-- ---------- seed announcements (only if empty) ----------
insert into public.announcements (tag, title, body, created_at)
select * from (values
  ('NEW FIELD', 'Valentine Ultimate Male Aura is live', 'Our most requested Desire Code yet — a magnetic masculine presence layered over a fresh Akashic carrier.', now()),
  ('ENGINE', 'Akashic engine v3', 'Rebuilt carrier rendering for cleaner sub-bass and longer silent layers.', now() - interval '6 days'),
  ('COMMUNITY', '50,000 listeners across 60 countries', 'Custom field requests now open for Inner Circle members.', now() - interval '15 days')
) as seed(tag, title, body, created_at)
where not exists (select 1 from public.announcements);
