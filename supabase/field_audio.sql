-- ============================================================
-- Waslerr Fields — gated field audio
-- Run this in the Supabase SQL editor once.
--
-- Each field can carry an audio file (the actual product). It lives in a PRIVATE
-- bucket and is only served — for a paid field — after the customer has paid
-- (verified by their order reference) or to the admin. Free fields' audio is open.
-- ============================================================

alter table public.products    add column if not exists audio_url text; -- private path in field-audio
alter table public.free_fields add column if not exists audio_url text;

-- private bucket for the audio products (served via short-lived signed URLs)
insert into storage.buckets (id, name, public)
values ('field-audio', 'field-audio', false)
on conflict (id) do nothing;
