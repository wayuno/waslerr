-- ============================================================
-- Waslerr Fields — Review photos
-- Run this in the Supabase SQL editor once.
--
-- Adds an `images` array to reviews (public URLs into the review-images
-- bucket), and caps each review at 2 photos at the database level.
-- ============================================================

alter table public.reviews
  add column if not exists images jsonb not null default '[]'::jsonb;

-- public bucket for review photos (server also auto-creates this on first upload)
insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do nothing;

-- anyone may read review photos
drop policy if exists "review_images_public_read" on storage.objects;
create policy "review_images_public_read" on storage.objects
  for select using (bucket_id = 'review-images');

-- re-create the public insert policy with a hard 2-photo cap
drop policy if exists "reviews_public_insert" on public.reviews;
create policy "reviews_public_insert" on public.reviews for insert
  with check (
    featured = false
    and char_length(name) between 1 and 80
    and char_length(text) between 4 and 2000
    and (images is null or jsonb_array_length(images) <= 2)
  );
