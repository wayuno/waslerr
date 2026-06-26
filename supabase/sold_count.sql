-- ============================================================
-- Waslerr Fields — editable "sold" count per field
-- Run this in the Supabase SQL editor once.
--
-- An admin-editable social-proof number shown on each field's detail page
-- ("X sold"). Defaults to 0; the admin sets it from the Fields tab.
-- ============================================================

alter table public.products    add column if not exists sold_count integer not null default 0;
alter table public.free_fields add column if not exists sold_count integer not null default 0;
