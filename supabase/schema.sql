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
-- 8. Saved trips — a user's persisted trips (foundation for the feed + group
--    planning). Owner-only for now; a `shared`/members model comes with groups.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trips (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text,
  start_label       text not null,
  destination_label text not null,
  start_coords      jsonb,   -- { lat, lng }
  dest_coords       jsonb,
  waypoints         jsonb not null default '[]',
  departure_date    text,
  departure_time    text,
  return_date       text,
  return_time       text,
  is_round_trip     boolean not null default false,
  preference        text,    -- 'fastest' | 'scenic'
  distance          text,    -- display, e.g. "377 mi"
  duration          text,    -- display, e.g. "7 hr 52 min"
  invite_token      uuid not null default gen_random_uuid(),  -- shareable group-invite link
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id, created_at desc);

drop trigger if exists trips_touch_updated_at on public.trips;
create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();

alter table public.trips enable row level security;

-- RLS policies are defined in section 10 (participant-based: owner + invited members),
-- since they depend on the group-planning helper functions declared there.

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Trip items — the editable itinerary of a saved trip: chosen stops, hotels,
--    attractions, restaurants, and free-text notes. Ordered by `position`.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trip_items (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,   -- 'stop' | 'hotel' | 'attraction' | 'restaurant' | 'note'
  title        text not null,
  detail       text,
  location     text,
  image_url    text,
  external_url text,
  notes        text,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists trip_items_trip_idx on public.trip_items (trip_id, position);

alter table public.trip_items enable row level security;

-- RLS policies are defined in section 10 (participant-based: any trip member may edit the
-- shared itinerary), since they depend on the group-planning helpers declared there.

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Group trip planning — shared trips with invited members, collaborative editing,
--     and voting (route preference + candidate stops).
--
--     RLS turns the owner-only model above into PARTICIPANT-based access. To avoid
--     recursive policy evaluation (a `trips` policy reading `trip_members` while a
--     `trip_members` policy reads `trips`), membership checks go through SECURITY
--     DEFINER helper functions: owned by the table owner, their internal reads bypass
--     RLS, breaking the cycle. This is the standard Supabase pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- Existing deployments: add the invite token to trips that predate section 8's column.
alter table public.trips add column if not exists invite_token uuid not null default gen_random_uuid();
create unique index if not exists trips_invite_token_idx on public.trips (invite_token);

-- 10a. Membership. The owner is always present as a 'owner' row (trigger + backfill below),
--      so `is_trip_member` alone is the participant check everywhere.
create table if not exists public.trip_members (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member',   -- 'owner' | 'member'
  joined_at  timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index if not exists trip_members_trip_idx on public.trip_members (trip_id);
create index if not exists trip_members_user_idx on public.trip_members (user_id);

-- 10b. Votes: one route-preference vote per member per trip.
create table if not exists public.trip_votes (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  choice     text not null check (choice in ('fastest', 'scenic')),
  updated_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index if not exists trip_votes_trip_idx on public.trip_votes (trip_id);

-- 10c. Votes: up/down on individual itinerary items. `trip_id` is denormalized so RLS can
--      authorize without a join back to trip_items.
create table if not exists public.trip_item_votes (
  id            uuid primary key default gen_random_uuid(),
  trip_item_id  uuid not null references public.trip_items(id) on delete cascade,
  trip_id       uuid not null references public.trips(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  value         smallint not null check (value in (-1, 1)),
  updated_at    timestamptz not null default now(),
  unique (trip_item_id, user_id)
);
create index if not exists trip_item_votes_item_idx on public.trip_item_votes (trip_item_id);
create index if not exists trip_item_votes_trip_idx on public.trip_item_votes (trip_id);

drop trigger if exists trip_votes_touch_updated_at on public.trip_votes;
create trigger trip_votes_touch_updated_at
  before update on public.trip_votes
  for each row execute function public.touch_updated_at();

drop trigger if exists trip_item_votes_touch_updated_at on public.trip_item_votes;
create trigger trip_item_votes_touch_updated_at
  before update on public.trip_item_votes
  for each row execute function public.touch_updated_at();

-- 10d. Keep the owner in trip_members automatically, and backfill existing trips.
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (trip_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists trips_add_owner_member on public.trips;
create trigger trips_add_owner_member
  after insert on public.trips
  for each row execute function public.add_owner_as_member();

insert into public.trip_members (trip_id, user_id, role)
  select id, user_id, 'owner' from public.trips
  on conflict (trip_id, user_id) do nothing;

-- 10e. Recursion-safe membership helpers (SECURITY DEFINER → internal reads bypass RLS).
create or replace function public.is_trip_member(_trip_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_owner(_trip_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.trips
    where id = _trip_id and user_id = auth.uid()
  );
$$;

-- Join a trip by its invite token: inserts the caller as a member. Runs as definer so it
-- can write the membership without exposing a broad insert policy. Returns the trip id.
create or replace function public.join_trip(_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _trip_id uuid;
begin
  select id into _trip_id from public.trips where invite_token = _token;
  if _trip_id is null then
    raise exception 'Invalid or expired invite link';
  end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (_trip_id, auth.uid(), 'member')
  on conflict (trip_id, user_id) do nothing;
  return _trip_id;
end $$;

grant execute on function public.join_trip(uuid) to authenticated;

-- 10f. Participant-based RLS for trips + trip_items (replaces the owner-only policies).
drop policy if exists trips_select_own on public.trips;
drop policy if exists trips_update_own on public.trips;
drop policy if exists trips_delete_own on public.trips;
drop policy if exists trips_insert_own on public.trips;

-- Note the explicit `user_id = auth.uid()` alongside the membership check: it lets the
-- owner read/update their trip WITHOUT depending on the owner's trip_members row, which
-- matters right after INSERT — `saveTrip` does insert().select(), and the AFTER-INSERT
-- trigger's membership write isn't reliably visible to that same statement's RLS SELECT.
drop policy if exists trips_select_member on public.trips;
create policy trips_select_member on public.trips
  for select to authenticated using (auth.uid() = user_id or public.is_trip_member(id));

drop policy if exists trips_insert_own on public.trips;
create policy trips_insert_own on public.trips
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists trips_update_member on public.trips;
create policy trips_update_member on public.trips
  for update to authenticated
  using (auth.uid() = user_id or public.is_trip_member(id))
  with check (auth.uid() = user_id or public.is_trip_member(id));

drop policy if exists trips_delete_owner on public.trips;
create policy trips_delete_owner on public.trips
  for delete to authenticated using (public.is_trip_owner(id));

drop policy if exists trip_items_select_own on public.trip_items;
drop policy if exists trip_items_insert_own on public.trip_items;
drop policy if exists trip_items_update_own on public.trip_items;
drop policy if exists trip_items_delete_own on public.trip_items;

drop policy if exists trip_items_select_member on public.trip_items;
create policy trip_items_select_member on public.trip_items
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists trip_items_insert_member on public.trip_items;
create policy trip_items_insert_member on public.trip_items
  for insert to authenticated with check (public.is_trip_member(trip_id) and auth.uid() = user_id);

drop policy if exists trip_items_update_member on public.trip_items;
create policy trip_items_update_member on public.trip_items
  for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

drop policy if exists trip_items_delete_member on public.trip_items;
create policy trip_items_delete_member on public.trip_items
  for delete to authenticated using (public.is_trip_member(trip_id));

-- 10g. RLS for members + votes.
alter table public.trip_members    enable row level security;
alter table public.trip_votes      enable row level security;
alter table public.trip_item_votes enable row level security;

-- members: any participant sees the roster; owner removes anyone, a member removes self.
-- Inserts happen via join_trip() / the owner trigger (both SECURITY DEFINER).
drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists trip_members_delete on public.trip_members;
create policy trip_members_delete on public.trip_members
  for delete to authenticated using (public.is_trip_owner(trip_id) or auth.uid() = user_id);

-- votes: participants read all; each user writes only their own row.
drop policy if exists trip_votes_select on public.trip_votes;
create policy trip_votes_select on public.trip_votes
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists trip_votes_write on public.trip_votes;
create policy trip_votes_write on public.trip_votes
  for all to authenticated
  using (auth.uid() = user_id and public.is_trip_member(trip_id))
  with check (auth.uid() = user_id and public.is_trip_member(trip_id));

drop policy if exists trip_item_votes_select on public.trip_item_votes;
create policy trip_item_votes_select on public.trip_item_votes
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists trip_item_votes_write on public.trip_item_votes;
create policy trip_item_votes_write on public.trip_item_votes
  for all to authenticated
  using (auth.uid() = user_id and public.is_trip_member(trip_id))
  with check (auth.uid() = user_id and public.is_trip_member(trip_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Trip playlist — collaborative Spotify song list per trip. Mirrors trip_items and
--     reuses the is_trip_member() helper, so any trip member may add/remove tracks (that
--     is the collaborative playlist for shared trips). Tracks come from Spotify's catalog
--     search; the list itself lives here. (Section 11 is the social feed on another branch;
--     numbered 12 so they merge without collision.)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trip_tracks (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  added_by     uuid not null references auth.users(id) on delete cascade,
  spotify_id   text not null,
  uri          text,
  name         text not null,
  artists      text,
  album        text,
  image_url    text,
  preview_url  text,
  external_url text,
  duration_ms  integer,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists trip_tracks_trip_idx on public.trip_tracks (trip_id, position);

alter table public.trip_tracks enable row level security;

-- Participant-based (any trip member collaborates), same shape as trip_items.
drop policy if exists trip_tracks_select_member on public.trip_tracks;
create policy trip_tracks_select_member on public.trip_tracks
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists trip_tracks_insert_member on public.trip_tracks;
create policy trip_tracks_insert_member on public.trip_tracks
  for insert to authenticated with check (public.is_trip_member(trip_id) and auth.uid() = added_by);

drop policy if exists trip_tracks_update_member on public.trip_tracks;
create policy trip_tracks_update_member on public.trip_tracks
  for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

drop policy if exists trip_tracks_delete_member on public.trip_tracks;
create policy trip_tracks_delete_member on public.trip_tracks
  for delete to authenticated using (public.is_trip_member(trip_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Follow-ons (not in this migration, tracked in FUTURE_IMPLEMENTATION.md):
--   • Email invites (needs an email provider) + Realtime live sync + cost-split.
--   • posts + post_likes (+ Storage photos) for the social feed.
--   • Spotify: export/sync to a real Spotify playlist (owner OAuth); AI "fill to trip length".
--   • rateable hotels/rentals once live pricing yields stable property IDs.
--   • periodic refresh/TTL for route_recommendations (places change over time).
-- ─────────────────────────────────────────────────────────────────────────────
