-- ------------------------------------------------------------
-- Multiple audio files per field (and per version).
--
-- A field can now hold a BUNDLE of audio files; the buyer (or free
-- downloader) gets them all. Stored as jsonb: [{ path, name, size }].
-- The legacy single `audio_url` column is kept in sync (= the first file)
-- so older download paths keep working and `hasAudio` stays correct.
--
-- Per-version audios live nested inside the existing `versions` jsonb
-- (each version object gets its own `audios` array) — no column needed there.
--
-- Reads degrade gracefully without this migration (falls back to the single
-- audio_url). Run it to persist multi-file bundles. Safe to re-run.
-- ------------------------------------------------------------
alter table public.products    add column if not exists audios jsonb;
alter table public.free_fields add column if not exists audios jsonb;
