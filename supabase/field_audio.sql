-- ============================================================
-- Waslerr Fields — gated field audio
-- Run this in the Supabase SQL editor once.
--
-- Each field can carry an audio file (the actual product). It lives in a PRIVATE
-- bucket and is only served — for a paid field — after the customer has paid
-- (verified by their order reference) or to the admin. Free fields' audio is open.
-- ============================================================

alter table public.products    add column if not exists audio_url text; -- path in field-audio (paid)
alter table public.free_fields add column if not exists audio_url text; -- path in free-audio (free)

-- PAID field audio → private bucket (gated; served via short-lived signed URLs
-- only after the customer has paid).
insert into storage.buckets (id, name, public)
values ('field-audio', 'field-audio', false)
on conflict (id) do nothing;

-- FREE field audio → its OWN separate bucket (open to everyone).
insert into storage.buckets (id, name, public)
values ('free-audio', 'free-audio', false)
on conflict (id) do nothing;
