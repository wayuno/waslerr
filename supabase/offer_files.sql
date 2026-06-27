-- ============================================================
-- Waslerr Fields — Multi-file deliveries
-- Run this once in the Supabase SQL editor (after offers.sql).
--
-- An admin can now deliver more than one file per offer. Files are stored as a
-- JSON array of { path, name }. The legacy single-file columns
-- (delivery_file_url / delivery_file_name) are kept in sync with the first file
-- for backward compatibility.
-- ============================================================

alter table public.offers
  add column if not exists delivery_files jsonb not null default '[]'::jsonb;
