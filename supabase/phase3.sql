-- ============================================================
-- Waslerr Fields — Supabase schema (Phase 3: announcements)
-- Run in the Supabase SQL editor after schema.sql + phase2.sql.
-- ============================================================

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  tag        text not null default 'NEW FIELD',   -- NEW FIELD | ENGINE | COMMUNITY
  title      text not null,
  body       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- anyone may read announcements (homepage Journal + What's new page)
drop policy if exists "announcements_public_read" on public.announcements;
create policy "announcements_public_read" on public.announcements
  for select using (true);

-- writes go through the backend with the service-role key (admin only),
-- so no client write policy is defined.

-- seed the starter journal entries (only if empty)
insert into public.announcements (tag, title, body, created_at)
select * from (values
  ('NEW FIELD', 'Valentine Ultimate Male Aura is live', 'Our most requested Desire Code yet — a magnetic masculine presence layered over a fresh Akashic carrier.', now()),
  ('ENGINE', 'Akashic engine v3', 'Rebuilt carrier rendering for cleaner sub-bass and longer silent layers. Every existing Akashic field updated free.', now() - interval '6 days'),
  ('COMMUNITY', '50,000 listeners across 60 countries', 'Custom field requests now open for Inner Circle members.', now() - interval '15 days'),
  ('NEW FIELD', 'Wealth Magnetism Field', 'Abundance encoding with a decisiveness sub-layer. Built for daily morning loops.', now() - interval '25 days')
) as seed(tag, title, body, created_at)
where not exists (select 1 from public.announcements);
