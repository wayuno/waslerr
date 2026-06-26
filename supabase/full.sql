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

-- ---------- reviews wall ----------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  field      text not null,                       -- product id the story is about
  name       text not null,
  rating     int  not null default 5 check (rating between 1 and 5),
  text       text not null,
  featured   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reviews_created_idx on public.reviews (created_at desc);
alter table public.reviews enable row level security;
grant select, insert on public.reviews to anon, authenticated;

-- anyone may read the wall
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews for select using (true);

-- anyone may post a story (the wall is open) — but never self-mark featured,
-- and name/text are length-bounded. Featuring + deletes go through the backend.
drop policy if exists "reviews_public_insert" on public.reviews;
create policy "reviews_public_insert" on public.reviews for insert
  with check (featured = false
    and char_length(name) between 1 and 80
    and char_length(text) between 4 and 2000);

-- seed a few stories tied to real product ids (only if the table is empty)
insert into public.reviews (field, name, rating, text, featured, created_at)
select p.id::text, s.name, s.rating, s.text, s.featured, s.created_at
from (values
  ('Valentine Ultimate Male Aura', 'Marcus T.', 5, 'Three weeks in and people treat me differently. I walk slower, talk lower, and somehow the room turns. This is the one I keep coming back to.', true,  now() - interval '6 days'),
  ('Limitless Wealth',             'Lena R.',   5, 'My relationship with money completely changed. I stopped flinching at big numbers and started asking for what I am worth.',                    true,  now() - interval '14 days'),
  ('Deep Akashic Healing',         'Sofia A.',  5, 'The calmest I have felt in years. Old tension I had carried since childhood just loosened. I sleep through the night now.',                     false, now() - interval '18 days'),
  ('Porn-Addiction Freedom',       'Devon K.',  5, 'Forty days clean after years of trying. It never felt like willpower — the urge just quietly lost its grip.',                                false, now() - interval '22 days'),
  ('Morning Ignition',             'Priya M.',  4, 'Two minutes before my day and I am decisive instead of foggy. Free, and better than apps I have paid for.',                                  false, now() - interval '27 days')
) as s(title, name, rating, text, featured, created_at)
join public.products p on p.title = s.title
where not exists (select 1 from public.reviews);

-- ---------- site settings (community links, etc.) ----------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
grant select on public.settings to anon, authenticated;

-- anyone may read settings (community links power the Community page + footer)
drop policy if exists "settings_public_read" on public.settings;
create policy "settings_public_read" on public.settings for select using (true);
-- writes go through the backend (admin, service-role)

insert into public.settings (key, value)
values ('community_links',
  '{"youtube":"https://youtube.com/@waslerrfields","discord":"https://discord.gg/waslerrfields","creator":"hello@waslerrfields.com"}'::jsonb)
on conflict (key) do nothing;
