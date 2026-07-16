# Wayvue — Technical Implementation TODO

Running list of planned technical work and the API keys it needs.
For product/feature ideas and monetization strategy, see
[FEATURE_ROADMAP.md](FEATURE_ROADMAP.md).

Last updated: 2026-07-13.

---

## 1. LLM-Powered "Wayvue Intelligence" Summary

**Problem:** The Wayvue Intelligence bullets and the "Fun Moment" are generated from
deterministic templates ([`server/services/aiService.js`](server/services/aiService.js)).
They're safe and fast, but read similarly across trips and the Fun Moment is vague
(generic "scenic overlook" line regardless of the actual route).

**Approach — narrate facts, never compute them.** Keep the two layers separate:
- **FACTS** (deterministic, already solid): scoring, thresholds, structured numbers.
  The LLM must never invent a delay, price, or distance.
- **COPY** (new LLM layer): feed the model *only the trusted facts* and have it rewrite
  them into varied, trip-specific bullets + a real Fun Moment. Prompt rule: "never state
  a number that isn't in the JSON."
- **Fallback:** no API key, or a failed/slow call → fall back to today's deterministic
  templates. The endpoint never hard-fails.

**Why this is low-risk:** with no key set, behavior is exactly what ships today. The key
only *upgrades* quality.

### TODO
- [ ] Add a `narrateTripAnalysis(analysis, options)` layer to
      [`server/services/aiService.js`](server/services/aiService.js):
      facts-only system prompt, JSON-array output, schema validation.
- [ ] Use a cheap model for narration — **Haiku** (`claude-haiku-4-5-20251001`); it's only
      rewriting trusted facts, not reasoning. (Chat already uses `claude-opus-4-8`.)
- [ ] Add timeout (~6s) + try/catch → fall back to deterministic `bullets`/`funMoment`.
- [ ] Cache narration by trip seed (summary is already seed-deterministic) so re-fetches
      and re-renders don't re-bill.
- [ ] Wire it into [`server/services/tripProcessor.js`](server/services/tripProcessor.js)
      where `generateTripAnalysis` is called (line ~358), before returning `aiAnalysis`.
- [ ] Make the **Fun Moment** LLM-driven too — reference the real route/weather/a real stop
      instead of the generic template line.
- [ ] Add a feature flag (e.g. `AI_NARRATION=on|off`) so it can be toggled without removing
      the key.
- [ ] Keep the deterministic priority/scoring tables as the source of truth (see
      `FUTURE` note below on reconciling bullet priorities vs. score penalties).

### Cost & latency
- ~a fraction of a cent per summary with Haiku.
- Adds ~0.5–1.5s to enrichment; mitigated by per-trip caching.

---

## 2. Wayvue AI Chat ("Ask Wayvue AI") — currently not configured

The chat feature already exists ([`server/services/aiChatService.js`](server/services/aiChatService.js),
model `claude-opus-4-8`) but reads `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`, **neither of
which is set in `server/.env`**. So the "Ask Wayvue AI" button is likely failing at runtime today.

### TODO
- [ ] Add `ANTHROPIC_API_KEY` to `server/.env` (unlocks chat **and** the summary narration above).
- [ ] Document `ANTHROPIC_API_KEY` in `.env.example` (it's currently missing there).
- [ ] Add a clear "AI not configured" empty-state in the chat UI when the key is absent.

---

## 3. API Keys — status & what to add

The one key that matters most for the items above is **`ANTHROPIC_API_KEY`** — a single
Anthropic key (from <https://console.anthropic.com> → API Keys) powers **both** the AI chat
and the new AI summary narration. No new provider or account beyond that.

### Currently configured (`server/.env`)
| Key | Powers | Status |
|---|---|---|
| `EIA_API_KEY` | Real gas prices (EIA) | ✅ set |
| `TOMTOM_API_KEY` | Real-time traffic | ✅ set |
| `MAPBOX_ACCESS_TOKEN` | — (unused; routing uses OSRM) | ✅ set, not needed |
| `OPENWEATHER_API_KEY` | — (unused; weather uses Open-Meteo) | ✅ set, not needed |

### Needed / recommended to add
| Key | Powers | Priority | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | AI chat **+** AI summary narration | **Required for AI features** | Not set. Get from console.anthropic.com. Falls back to templates if absent. |
| `TOLLGURU_API_KEY` | Real toll pricing | Optional | Unset → state-based heuristic (flagged "estimated"). Free tier: tollguru.com |
| `AMADEUS_API_KEY` + `AMADEUS_API_SECRET` | Live hotel prices | Optional | Unset → hotels show with booking links but **no prices** (never fabricated). Free tier: developers.amadeus.com. `AMADEUS_ENV=test`\|`production`. |
| `NY_511_API_KEY` | NY traffic camera feeds | Optional | NY-only. Register: 511ny.org |

**Keyless (no action needed):** routing (OSRM), weather (Open-Meteo), and reverse
geocoding (ArcGIS) all run without keys.

### TODO
- [ ] Add `ANTHROPIC_API_KEY` to `server/.env` and to `.env.example`.
- [ ] (Optional) Add `TOLLGURU_API_KEY` to replace the toll heuristic with live tolls.
- [ ] (Optional) Add `AMADEUS_API_KEY` + `AMADEUS_API_SECRET` to show real hotel prices.

---

## 4. Community Features — Phase 1: Ratings on recommendations

Product spec lives in [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) (Social & community).
Backed by **Supabase** (Postgres + Auth; client talks to it directly, secured by RLS).

**Prerequisite (net-new):** the app has no persistence or real user auth today — the
server is stateless and the only "auth" is the `checkAdmin` password header. Ratings
introduces the first real accounts + database.

**Identity model (important):** ratings key on a canonical, stable `place_key`.
Real OSM POIs (`osm-<id>` → `osm:<id>`) are rateable; generic fallback stops
(`fallback-*`, town-generated, not real businesses) are **not**. Hotel/rental cards are
*tiers* with booking links, not specific properties — rateable only once live pricing
yields stable property IDs (deferred).

### Status — built & verified (branch `feature/community-ratings`)
- [x] `supabase/schema.sql` — `places`, `ratings`, `place_rating_stats` view, RLS.
      Verified live: aggregate read → 200; anon writes → 401 (RLS blocks). ✅
- [x] `supabase/README.md` — project setup steps.
- [x] `client/.env.example` + `client/.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
      (publishable key). `client/.npmrc` (`legacy-peer-deps=true`) for the React 19 install.
- [x] Auth method: **Google OAuth**.
- [x] `@supabase/supabase-js` installed; `client/src/lib/supabase.ts` (null when env unset
      → whole feature no-ops).
- [x] `client/src/lib/AuthContext.tsx` — session + `signInWithGoogle` / `signOut`, wrapped
      in `main.tsx`.
- [x] `client/src/lib/useRating.ts` — reads `place_rating_stats` + the user's own rating;
      `submit` upserts place then rating.
- [x] `client/src/components/RatingStars.tsx` — wired into `PlacesRecommendations` card +
      details modal; OSM-only (fallbacks skipped). Verified: 21 OSM stops → stars, 0 on
      fallbacks; signed-out click launches the Google OAuth redirect. ✅
- [x] Supporting fix (`server/services/placesService.js`): dead `overpass.kumi.systems`
      mirror → `maps.mail.ru/osm/tools/overpass`; query/HTTP timeout 15s → 25s. Without
      this, only fallback stops returned and ratings were invisible.

### Remaining (blocked on you)
- [ ] **Supabase → Authentication → Providers → Google**: paste the Client ID + Secret and
      enable it. Until then the OAuth redirect returns `400 provider is not enabled` — this
      is the only thing between here and a working sign-in + rating write.
- [ ] After that: real end-to-end test (sign in with Google, submit a rating, see the
      aggregate update). The write path can only be exercised by a signed-in user.

### Route recommendation cache (place stability) — built
Problem: recommendations were fetched live from Overpass on every search, so the same
route returned a different place mix each time (verified: 35 vs 25 stops back-to-back) —
a rated stop could vanish. Fix: cache the first good result per route in Supabase.
- [x] `route_recommendations` table (server-owned; RLS on, no policies → service_role only)
      in `supabase/schema.sql`.
- [x] `server/services/supabaseAdmin.js` (service_role client, null if unconfigured).
- [x] `server/services/recommendationCache.js` — `buildRouteKey` (start/end/pref/waypoints,
      3-decimal rounding) + get/save; all no-op when disabled.
- [x] Wired into `tripProcessor.js` section C: cache-hit → return; miss → fetch + store.
- [x] `server/.env(.example)`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Verified the
      disabled path (no key) → logs "route cache disabled", route still returns places.
- [x] Table SQL run + `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`.
- [x] Node 20 has no native WebSocket; supabase-js's realtime init threw at
      construction. Added `ws` dep + `realtime: { transport: ws }` in `supabaseAdmin.js`,
      wrapped in try/catch so an init failure can't break `/api/route`.
- [x] **Verified cache-hit:** same route twice → identical 27-stop set (was 35 vs 23
      before); `route_recommendations` has the fastest + scenic rows. ✅
- Note: start the server from `server/` (or via its npm script) so dotenv loads
  `server/.env` — running `node server/index.js` from the repo root loads 0 env vars.

### Follow-ons
- [x] `public.profiles` (display name/avatar) so reviews show an author. Done: profiles
      table + client-side join in `getReviews`; reviews list shows name + avatar.
- [ ] Rateable hotels/rentals once live pricing gives stable property IDs.
- [x] OAuth redirect returned to the landing page (full-page reload dropped trip state).
      Fixed: App snapshots the active trip to sessionStorage; on reload after an auth
      redirect (flag set in `signInWithGoogle`) it rebuilds that trip. Verified: auth
      return → trip view; normal refresh → landing (unchanged). Still shows a brief
      rebuild while the route re-fetches — a later optimization could restore from cache.
- [ ] **Move off public Overpass to a reliable POI source.** The stops pipeline
      (`server/services/placesService.js`) queries the free public Overpass mirrors
      (overpass-api.de / maps.mail.ru), which frequently 429/504-throttle under our
      per-route request volume (~14 segment queries/route). This leaves whole categories
      thin or empty on some searches — most visibly **Rest Areas**, which are largely
      way-mapped `highway=services` plazas that are heavy for the public mirrors (see the
      rest-areas fix: a separate best-effort way query that's skipped when it times out, so
      coverage is inconsistent by design). Options, best value first:
    - **Self-hosted Overpass (recommended):** same OSM data + our existing tag logic (no
      re-mapping), removes the throttling, no per-call cost — just server/infra. Biggest
      reliability win for the least code change; make it the primary and keep public
      mirrors as fallback.
    - **Foursquare Places:** generous free tier, good POI categories; wire as a fallback
      or for destination attractions. Gives stable IDs too.
    - **HERE / TomTom / Mapbox:** usable free tiers; TomTom is already integrated for
      traffic/incidents, so lowest onboarding friction.
    - **Google Places:** best data quality but **paid/metered** (billing account required;
      Nearby/Text Search ≈ $17–35 per 1k requests; free monthly allowance covers only a few
      hundred routes at our call volume). Overkill for "find stops near these coords."
    - Bonus: any of these gives **stable place IDs**, which also firms up the ratings
      `place_key` (currently `osm-<id>`, which can churn when Overpass returns a different
      node).
- [ ] `route_recommendations` never expires yet — add a periodic refresh/TTL since POIs
      change over time.

---

## 5. Activities integration — Viator (TripAdvisor)

Product spec in [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) (Integrations & partnerships).
Bookable things-to-do near the destination with affiliate "Book on Viator" links.

**Placeholder shipped (scaffolding, graceful no-op):**
- [x] `server/services/viatorService.js` — null-guarded `getActivities()`; returns
      `{ configured:false, activities:[] }` when `VIATOR_API_KEY` is unset.
- [x] `GET /api/trip/activity-recommendations?destination=&lat=&lng=` in `server/index.js`.
- [x] Client `ActivityCard` (image / rating / from-price / affiliate CTA) +
      `ActivitiesTab` with a "coming soon" empty state; wired into the insights accordion
      (`activities` tab + Ticket icon). Verified: section renders, endpoint returns the
      placeholder, no regressions.
- [x] `VIATOR_API_KEY` documented in `server/.env(.example)`.

**Remaining to make it live (Phase 2):**
- [ ] **You:** apply for Viator Partner **Basic / Affiliate** access; add `VIATOR_API_KEY`
      to `server/.env` (sandbox key works for building/testing first).
- [ ] In `viatorService.getActivities()`:
  1. Resolve destination name → Viator `destinationId` (`GET /destinations`, cached).
  2. `POST /products/search` `{ filtering:{ destination }, sorting, pagination, currency }`.
  3. Map products → `{ code, title, image, rating, reviewCount, fromPrice, bookingUrl }`.
  - Auth header `exp-api-key: <key>`, `Accept: application/json;version=2.0`.
  - Base `https://api.sandbox.viator.com/partner` | `https://api.viator.com/partner`.
- [ ] Cache activity results per route (reuse the route-cache approach) so it's one
      lookup per trip.
- [ ] Consider anchoring on major en-route stops too, not just the destination.

---

## 6. Group trip planning — shared trips, invites, voting

### Status — built (branch `feature/group-planning`)
Turns owner-only trips into **participant-based** collaboration.
- **Schema** (`supabase/schema.sql` §10): `trips.invite_token`; `trip_members`,
  `trip_votes` (route pref), `trip_item_votes` (per-stop up/down). Owner is auto-added to
  `trip_members` via an `after insert` trigger, with a one-time backfill for existing trips.
- **RLS**: participant-based via `SECURITY DEFINER` helpers `is_trip_member` /
  `is_trip_owner` (they bypass RLS internally, avoiding the `trips ↔ trip_members`
  recursion). `join_trip(token)` RPC inserts the caller's membership. Any member may edit
  `trips` / `trip_items`; only the owner deletes the trip or removes members.
- **Client**: `lib/groupTrips.ts` (data layer) + `GroupTripContext` (members + votes
  state). `GroupMembersBar` in the trip header (avatar stack + copy-invite-link popover +
  remove/leave). Join flow in `App.tsx` reads `?join=<token>`, joins, opens the trip
  (survives the OAuth round-trip via a stashed token). Route-pref tally + per-stop vote
  pills in `MyPlanTab`.

### Remaining (blocked on you)
- [ ] Run the updated `supabase/schema.sql` §10 in the Supabase SQL Editor.
- [ ] Two-account end-to-end test (invite link → join → shared edit + voting → remove).

### Follow-ons
- [ ] **Email invites.** Link-join ships now; add an email provider (Resend/SendGrid) +
      `trip_invites` (email, token, status). The invite popover already has the stubbed
      "Email invites — Soon" row as the seam.
- [ ] **Realtime live sync.** MVP refetches after each action; subscribe to
      `postgres_changes` on `trip_items` / votes / members for live collaboration.
- [x] **Cost splitting** for group trips (expenses + per-member share) — **shipped**, see §14.
- [ ] "Apply winning route vote" is currently manual (organizer re-searches); could
      auto-apply the winner to `trips.preference`.

---

## 7. Hotel / rental booking — affiliate deep links (Tier 1)

### Status — built (branch `feature/booking-affiliates`)
- **Client-only**: `lib/bookingPartners.ts` turns the existing search deep links
  (`utils/deepLinks.ts`) into **affiliate-aware** links. `hotelPartners()` → Booking.com,
  Expedia, Vrbo, Kayak; `rentalPartners()` → Expedia, Kayak, Booking.com Cars. The hotel &
  rental cards render a primary **Book** button + secondary store pills; disclosure shows when
  an affiliate ID is set.
- **Booking.com** earns natively — `withBookingAid()` appends `aid` (+ `label`) from
  `VITE_BOOKING_AFFILIATE_ID`. **Expedia/Vrbo** need an affiliate-network deep-link wrap
  (`wrapExpedia()` is the seam; set `VITE_EXPEDIA_AFFILIATE_ID` and implement the
  Impact/Partnerize tracking URL). Links always work; they just don't earn until wired.

### Requires from you
- [ ] **Booking.com affiliate** (partner.booking.com or via Travelpayouts) → set
      `VITE_BOOKING_AFFILIATE_ID`.
- [ ] **Expedia Group** (Impact/Partnerize) → set `VITE_EXPEDIA_AFFILIATE_ID` **and**
      implement `wrapExpedia()` with the network's deep-link format.

### Follow-ons
- [ ] **Tier 2** — embed a Travelpayouts/Stay22 "where to stay" search widget in the Stay tab
      (Stay22 also monetizes Airbnb, which has no direct affiliate program).
- [ ] **Tier 3** — true in-app booking via the **Amadeus Self-Service Hotel Booking API**
      (already used for pricing) or **Expedia Rapid**: real inventory + payments (Stripe) +
      cancellation/support. Needs a signed agreement + PCI handling.

---

## 8. Travel shopping — "Pack for this trip" affiliate recommendations

### Status — built (branch `feature/travel-shopping`)
- **Client-only** (no schema/server): `lib/travelShopping.ts` — a curated item catalog
  grouped into sub-categories (Essentials / Weather / Comfort / Outdoors), each with
  per-item `show(context)` rules and a **merchant list**. `buildPackContext` derives weather
  (precip / min-max °C from `weatherData[].weather`), drive duration, month/season, and an
  "outdoorsy" heuristic from route/stop names.
- **Multi-store merchant registry** (`MERCHANTS`): **Amazon** works today (tag from
  `VITE_AMAZON_ASSOCIATE_TAG`; plain search when unset). Specialty stores — **REI,
  Backcountry, YETI, Osprey, Cotopaxi, Travelpro, American Tourister** — render as real
  store-search buttons NOW; each has an `affiliate` hook that's a **placeholder** (`undefined`)
  documenting its network (**AvantLink / ShareASale / Impact**). Wire that hook + your
  publisher ID to start earning on those clicks. Networks aren't storefronts, so they're the
  `network` field, not buttons.
- **UI**: a **"Pack for this trip"** tab (`components/trip-view/tabs/PackTab.tsx`) — grouped
  sub-category sections; each item shows a store button per applicable merchant (Amazon
  primary), all with `rel="…sponsored nofollow"`, plus the Amazon Associates disclosure.

### Requires from you
- [ ] **Amazon Associates** (affiliate-program.amazon.com) → `VITE_AMAZON_ASSOCIATE_TAG` in
      `client/.env` (e.g. `wayvue-20`). Until then every link works, just uncommissioned.

### Follow-ons
- [ ] **Turn on the specialty stores**: join AvantLink (REI, Backcountry, Osprey), Impact
      (YETI, Travelpro, American Tourister), ShareASale (Cotopaxi); implement each merchant's
      `affiliate(url)` deep-link wrap in `MERCHANTS`. Until then those buttons link to plain
      store search (no commission).
- [ ] **Amazon Product Advertising API** (needs 3 qualifying sales) for live product
      images/titles/prices instead of search links.
- [ ] "Add to plan" (add a pick as a note/checklist item); non-US Amazon locales; a smarter
      "outdoorsy" signal; EV-adapter suggestion once the vehicle is known to be an EV.

---

## 12. Road-trip social feed — follow-based feed, likes, comments, moderation

### Status — built (branch `feature/social-feed`)
- **Schema** (`supabase/schema.sql` §11): `posts` (photo/tip/stop/trip, optional trip_id /
  place_key / image_url, `hidden` flag), `follows`, `post_likes`, `post_comments`,
  `post_reports`, a `post_stats` view (like/comment counts), an `apply_report_hide()`
  `SECURITY DEFINER` trigger (auto-hide at ≥3 reports), the `is_post_author` helper, and a
  **`post-photos`** Storage bucket (public read, per-user-folder write — like `avatars`).
- **RLS**: posts readable when `not hidden` AND the author is viewable — `profiles.is_private`
  gates this: **public** authors are visible to everyone, **private** authors only to their
  followers (and themselves), via the `can_view_author()` SECURITY DEFINER helper. Follows/
  likes/comments public-read + write-own; reports insert-only (not client-readable).
- **Client**: `lib/feed.ts` (posts/feed/discover, likes, comments, follows, suggested users,
  reports, `uploadPostPhoto`). UI under `components/feed/`: `CommunityFeedPage`
  (Following + Discover tabs, suggested travelers), `PostComposer` (text / photo / attach a
  saved trip / share a stop), `PostCard` (like, expandable comments, delete/report menu),
  `UserProfilePanel` (follow + a user's posts). Nav via `FeedContext` → a "Community" item
  in `AccountMenu`; "Share" on the stop details modal prefills the composer.

### Remaining (blocked on you)
- [ ] Run `supabase/schema.sql` §11 in the SQL editor (creates the tables, `post-photos`
      bucket, and the report-hide trigger).
- [ ] Two-account end-to-end test (post → follow → like/comment → report auto-hide).

### Follow-ons
- [ ] **Notifications center** — notify the recipient of new followers / likes / comments
      (same "since last seen" idea as the group activity feed). Deferred from this build.
- [ ] Algorithmic / recency ranking, hashtags & @mentions, image moderation (NSFW),
      user blocking, reposts, and a signed-out entry point to the feed.

---

## 13. Spotify — collaborative trip playlist

### Status — built (branch `feature/spotify-playlist`)
- **Server**: `services/spotifyService.js` — Spotify **Client Credentials** (app token, no
  user login) catalog search, cached token; endpoint `GET /api/spotify/search?q=` →
  `{ configured, tracks }`. Null-guarded like `viatorService`: with no
  `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` it returns `configured:false`.
- **Schema** (`supabase/schema.sql` §12): `trip_tracks`, participant-based RLS reusing
  `is_trip_member` — **any trip member adds/removes**, which is the collaborative playlist.
- **Client**: `lib/tripTracks.ts` (search / list / add / remove) + a **Playlist tab** in the
  trip view (`components/trip-view/tabs/PlaylistTab.tsx`): search → add, the shared list with
  album art, **added-by avatar** (from `GroupTripContext.memberById`), 30s **preview**
  (best-effort), **Open in Spotify**, remove. `GroupTripContext` also notifies **"X added a
  song"** on shared trips (same activity poll as stops).

### Remaining (blocked on you)
- [ ] Create a free Spotify app (developer.spotify.com) → set `SPOTIFY_CLIENT_ID` /
      `SPOTIFY_CLIENT_SECRET` in `server/.env`; run `supabase/schema.sql` §12.

### Follow-ons
- [ ] **Export / sync to a real Spotify playlist** (owner OAuth + `playlist-modify` scope) —
      the deferred native-Spotify bridge; store `spotify_playlist_id` on the trip.
- [ ] Full in-app playback (Web Playback SDK; requires Spotify Premium + per-user login).
- [ ] **AI "fill to trip length"** — auto-suggest tracks sized to the drive duration
      (Spotify recommendations seeded from the added songs). Note: Spotify `preview_url` is
      null for many tracks now, so previews are best-effort; "Open in Spotify" is primary.

---

## 14. Trip expense splitting — Splitwise-style cost sharing (group trips)

### Status — built (branch `feature/expense-splitting`)
- **Schema** (`supabase/schema.sql` §13): `trip_expenses` (one payer + total, `split_type`)
  and `trip_expense_shares` (the resolved owed amount per member + the raw split input). Both
  use participant RLS via `is_trip_member`, so **any trip member can add/edit/delete** — the
  ledger is shared. **Money is integer cents everywhere** (never floats), so splits sum back
  to the total exactly.
- **Client** `lib/tripExpenses.ts`:
  - `splitByWeight(total, weights)` — proportional split with the **largest-remainder**
    method; leftover cents go to the biggest fractional remainders so parts always sum to the
    total. All four split modes route through it: **equal** (weights = 1), **by shares**
    (weights = share counts), **by percentage** (weights = %), and **exact** (owed cents given
    directly, validated to sum to the total).
  - `computeBalances` → each member's net (`Σ paid − Σ owed`).
  - `simplifyDebts` → **greedy min-cash-flow** (match biggest creditor with biggest debtor);
    produces ≤ n−1 "A pays B $X" transfers that clear every balance.
- **UI** `components/trip-view/tabs/ExpensesTab.tsx` — an **Expenses** tab (group-only; hidden
  on solo trips) with: add-expense form (description, amount, category, payer, split-method
  segmented control + live per-person preview and validation), the expense list with payer
  avatars, a **Balances** panel, and a **Settle up** panel driven by `simplifyDebts`.
- **Collaborative awareness**: `GroupTripContext` polls `trip_expenses` and emits an
  activity-feed item + toast **"X added an expense"** on shared trips (same diff pattern as
  stops/songs).

### Remaining (blocked on you)
- [ ] Run `supabase/schema.sql` §13 (creates `trip_expenses` + `trip_expense_shares` + RLS).

### Follow-ons
- [ ] **Record settlements** — a "mark as paid" that writes a settlement row so balances zero
      out after someone actually pays (today Settle-up is advisory; deleting/adding expenses
      is how the ledger changes).
- [ ] **Edit an expense** in place (the shares table already stores the raw `weight` input to
      rehydrate the form).
- [ ] **Multi-currency** (per-expense currency + FX) — today balances assume one trip
      currency (the first expense's), which covers the common case.
- [ ] Per-member spend summary / category breakdown; export to the trip PDF.

---

## 15. Trip checklist — shared to-do list (group trips)

### Status — built (branch `feature/expense-splitting`)
- **Schema** (`supabase/schema.sql` §14): `trip_checklist_items` (title, `done`,
  `completed_by` / `completed_at`), participant RLS via `is_trip_member` — **any member adds
  items and checks them off**.
- **Client** `lib/tripChecklist.ts` (list / add / toggle-done / remove) + a **Checklist tab**
  (`components/trip-view/tabs/ChecklistTab.tsx`, group-only): add box, tap-to-complete with a
  progress bar and `done`-count, strike-through for finished items (sorted to the bottom),
  "Added by / Done by" attribution avatars, and delete. Toggling is optimistic and reconciles
  with the server row (which stamps who completed it).
- **Collaborative awareness**: `GroupTripContext` notifies **"X added a checklist item"** on
  shared trips (same activity poll as stops / songs / expenses).

### Remaining (blocked on you)
- [ ] Run `supabase/schema.sql` §14 (creates `trip_checklist_items` + RLS).

### Follow-ons
- [ ] Assign an item to a specific member; due dates; reorder (drag).
- [ ] Seed suggested items from the trip (e.g. "book campsite" when the plan has a campground,
      "charge adapter" for an EV) — ties into the "Pack for this trip" signals.

---

## Notes / backlog
- [ ] **Refine user avatars.** The "Choose an avatar" presets in
      `client/src/lib/presetAvatars.ts` are currently code-generated SVG data URIs
      (travel line-icons + Apple-style person silhouettes). Replace/expand with a
      properly designed set later — see the generation prompt shared in chat; drop the
      result straight into `PRESET_AVATARS` (the picker + storage flow already work).
- [ ] Reconcile the two ranking systems if desired: **bullet priorities** vs. **score
      penalties** use different weightings (e.g. a road closure is bullet-priority 100 but
      only −15 in the score; snow is −40 in the score but bullet-priority 96). Intentionally
      separate today; revisit if they should align.
- [ ] Consider demoting the plain "gas regional average" bullet (priority 52) so
      weather/fatigue/time-of-day insights win borderline 4th slots when present.
