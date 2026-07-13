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
- [ ] **You:** run the new table SQL + add `SUPABASE_SERVICE_ROLE_KEY` to `server/.env`.
- [ ] Then verify cache-hit: same route twice → identical place set.

### Follow-ons
- [ ] `public.profiles` (display name/avatar) so reviews show an author.
- [ ] Rateable hotels/rentals once live pricing gives stable property IDs.
- [x] OAuth redirect returned to the landing page (full-page reload dropped trip state).
      Fixed: App snapshots the active trip to sessionStorage; on reload after an auth
      redirect (flag set in `signInWithGoogle`) it rebuilds that trip. Verified: auth
      return → trip view; normal refresh → landing (unchanged). Still shows a brief
      rebuild while the route re-fetches — a later optimization could restore from cache.
- [ ] Places pipeline still leans on one healthy Overpass mirror (overpass-api.de was
      429/504-throttling during testing). Consider a self-hosted Overpass or a POI
      provider (Foursquare/Google Places) for reliability + stable IDs.
- [ ] `route_recommendations` never expires yet — add a periodic refresh/TTL since POIs
      change over time.

---

## Notes / backlog
- [ ] Reconcile the two ranking systems if desired: **bullet priorities** vs. **score
      penalties** use different weightings (e.g. a road closure is bullet-priority 100 but
      only −15 in the score; snow is −40 in the score but bullet-priority 96). Intentionally
      separate today; revisit if they should align.
- [ ] Consider demoting the plain "gas regional average" bullet (priority 52) so
      weather/fatigue/time-of-day insights win borderline 4th slots when present.
