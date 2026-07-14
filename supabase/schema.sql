-- Wayvue community features — Phase 1: Ratings on recommended places.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE and drops policies before recreating.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Places that can be rated.
--    Keyed by a canonical, STABLE identifier so every user's rating lands on the
--    same row: OSM points of interest → 'osm:<node_id>'.
--    Generic fallback stops (index/town-generated, not a real business) are
--    intentionally NOT rateable and never get a place_key.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.places (
  place_key   text primary key,
  name        text not null,
  type        text,                          -- food | gas | charging | view | rest | ...
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ratings — one per user per place (re-rating updates the same row via upsert).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  place_key   text not null references public.places(place_key) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  review      text check (char_length(review) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (place_key, user_id)
);

create index if not exists ratings_place_key_idx on public.ratings (place_key);
create index if not exists ratings_user_id_idx  on public.ratings (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Public aggregate — lets a card show "★ 4.3 (12)" without exposing who rated.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.place_rating_stats as
select
  place_key,
  round(avg(stars)::numeric, 2) as avg_stars,
  count(*)                      as rating_count
from public.ratings
group by place_key;

-- Keep updated_at fresh on re-rating.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists ratings_touch_updated_at on public.ratings;
create trigger ratings_touch_updated_at
  before update on public.ratings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row-Level Security. The client talks to Supabase directly with the public
--    anon key; these policies are what actually keep the data safe.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.places  enable row level security;
alter table public.ratings enable row level security;

-- places: anyone may read; any signed-in user may add a place they're rating.
drop policy if exists places_select_all  on public.places;
create policy places_select_all on public.places
  for select using (true);

drop policy if exists places_insert_auth on public.places;
create policy places_insert_auth on public.places
  for insert to authenticated with check (true);

-- ratings: anyone may read (public reviews + aggregates);
--          a user may write ONLY their own row (auth.uid() = user_id).
drop policy if exists ratings_select_all on public.ratings;
create policy ratings_select_all on public.ratings
  for select using (true);

drop policy if exists ratings_insert_own on public.ratings;
create policy ratings_insert_own on public.ratings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists ratings_update_own on public.ratings;
create policy ratings_update_own on public.ratings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ratings_delete_own on public.ratings;
create policy ratings_delete_own on public.ratings
  for delete to authenticated using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Route recommendation cache (server-owned).
--    Overpass (OSM) is flaky, so live-fetching returns a different mix of places on
--    every search — which means a rated stop can vanish. The server caches the first
--    good result per route here and reuses it, keeping the place set stable.
--
--    Written/read ONLY by the server via the service_role key (which bypasses RLS).
--    RLS is enabled with NO policies, so the anon/browser key can't touch it.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.route_recommendations (
  route_key       text primary key,
  recommendations jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.route_recommendations enable row level security;
-- (Intentionally no policies — only service_role, which bypasses RLS, may access it.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Profiles — a public identity (display name + avatar) per user, so posts,
--    reviews, and group members can show a person instead of a raw user id.
--    Provisioned client-side on first login from the Google profile (upsert); the
--    row is keyed by auth.users.id.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

-- Anyone may read profiles (public identity); a user may create/update ONLY their own.
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Storage: avatars bucket. Public read; each user may write ONLY within a folder
--    named by their own uid (path: <uid>/avatar.<ext>). Lets users upload a Wayvue
--    profile picture when Google has none (or to override it).
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_user_insert on storage.objects;
create policy avatars_user_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_user_update on storage.objects;
create policy avatars_user_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_user_delete on storage.objects;
create policy avatars_user_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- Follow-ons (not in this migration, tracked in FUTURE_IMPLEMENTATION.md):
--   • public.trips (saved/persisted trips) — foundation for feed + group planning.
--   • rateable hotels/rentals once live pricing yields stable property IDs.
--   • periodic refresh/TTL for route_recommendations (places change over time).
-- ─────────────────────────────────────────────────────────────────────────────
