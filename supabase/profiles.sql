-- ============================================================
-- Waslerr Fields — user profiles (OPTIONAL)
-- ============================================================
-- NOTE: You do NOT need this for login to work. Supabase Auth already
-- stores every user's email + hashed password in `auth.users`
-- (Dashboard → Authentication → Users). Passwords are never stored in
-- plain text and you should never store them yourself.
--
-- This table just mirrors auth.users into a readable `profiles` table
-- (with the sign-up name) so you can query/show your users in the app.
-- Run it in the Supabase SQL editor.
-- ============================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- a signed-in user can read / update their own profile
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- (admin reads all users server-side via the service-role key, which
--  bypasses RLS — so no extra policy is needed for that.)

-- auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
