-- ============================================================
-- Waslerr Fields — Articles (homepage "The Articles" slideshow)
-- Run this in the Supabase SQL editor once.
--
-- Articles are separate from announcements: announcements feed the
-- notification bell, articles are the homepage slideshow only.
-- The backend (service-role) is the only writer; everyone may read.
-- ============================================================

create table if not exists public.articles (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  image_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists articles_created_idx on public.articles (created_at desc);

alter table public.articles enable row level security;

-- anyone may read articles (homepage slideshow — guests + members)
drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read" on public.articles for select using (true);
