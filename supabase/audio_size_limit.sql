-- ============================================================
-- Waslerr Fields — fix "413 Payload too large" on audio upload
-- Run this ONCE in the Supabase SQL editor.
--
-- The audio buckets were created without an explicit size limit, and the
-- `deliveries` bucket may carry an old 100MB cap. Clear all bucket-level
-- caps so only the PROJECT-wide upload limit applies.
--
-- IMPORTANT — the project-wide limit itself is a dashboard setting, not SQL:
--   Supabase Dashboard → Project Settings → Storage → "Upload file size limit"
--   Free plan is hard-capped at 50MB per file; Pro can raise it much higher.
-- ============================================================

update storage.buckets
set file_size_limit = null
where id in ('field-audio', 'free-audio', 'deliveries', 'product-images', 'review-images');
