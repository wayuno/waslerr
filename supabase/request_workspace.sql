-- ------------------------------------------------------------
-- Request workspace: extend `offers` so each offer doubles as the production
-- workspace for a custom-code request in the per-person Support inbox.
--
--   production_status — the 4-stage PRODUCTION pipeline, separate from the
--     payment `status` (sent|paid|delivered|cancelled). An unpaid offer can
--     still advance to review; delivering a file is what flips payment status.
--     requested → production → review → delivered
--   focus / intention — the request spec (focus headline + long intention body)
--   budget / length_estimate — meta-grid free text
--   internal_note — ADMIN-ONLY. Never serialized into publicOffer() / chat /
--     the account page; only the admin-shape adminOffer() exposes it.
--
-- Read paths (people inbox, conversation) work without this migration — fields
-- just default. Saving a workspace (PATCH /api/admin/offers/:id) needs it.
-- Safe to re-run.
-- ------------------------------------------------------------
alter table public.offers
  add column if not exists production_status text not null default 'requested',
  add column if not exists focus            text,
  add column if not exists intention        text,
  add column if not exists requested_at     timestamptz default now(),
  add column if not exists budget           text,
  add column if not exists length_estimate  text,
  add column if not exists internal_note    text;

create index if not exists offers_prodstatus_idx on public.offers (production_status);
