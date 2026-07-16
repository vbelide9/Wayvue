# Wayvue — Feature & Product Roadmap

Product-facing feature ideas, growth levers, and monetization strategy.
For technical implementation tracking (backend work, API keys, code TODOs), see
[FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md).

Last updated: 2026-07-14.

---

## ✅ Shipped (live on `main`)

### Core trip planning
- **Route planning** with Fastest / Scenic alternatives (the map draws the alternate as a
  dashed line) + multi-stop waypoints, on an interactive MapLibre map.
- Live **weather** along the route, **traffic / road conditions**, and **incident alerts**.
- **Trip confidence score** — hazard-aware (weather, traffic, incidents by type/count,
  long-haul fatigue, night driving).
- **Fuel / EV cost** + **toll** estimates.
- **Stop recommendations** (dining, fuel, EV charging, scenic, rest areas) from OSM.
- **Hotel** + **rental-vehicle** recommendations (hotels support live pricing when keyed).
- **AI trip-planner chat** ("Ask Wayvue AI", Claude tool-calling).
- **PDF itinerary export**.

### Social & community
- **User profiles + avatars** (Google sign-in; photo upload or preset avatar picker).
- **Ratings & reviews** on stops and hotels — star ratings, written reviews with author
  name/avatar, and a **Top-rated** sort.
- **Saved trips / My Trips** (trip history) + editable **itinerary builder** ("My Plan").
- **Group trip planning** — shareable invite links, shared member-editable itinerary,
  **voting** (route style + per-stop like/dislike with "view results"), a **collaborator
  activity feed** with an unread counter, and member avatars + activity badges on My Trips.
- **Expense splitting** — a Splitwise-style **Expenses** tab on shared trips: log a cost,
  split it **equally / by exact amounts / by shares / by percentage**, see everyone's running
  **balance**, and **settle up** via a minimized set of payments (debt simplification).

**Known follow-ons** (see [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md)): email
invites, realtime sync (currently ~10s polling), a self-hosted Overpass /
POI provider for reliable stops (esp. rest areas), and the Viator activities API key.

---

## Growth, Professionalism & Monetization

Brainstormed direction for turning Wayvue from a working prototype into a product with
retention loops and revenue. Nothing here is scoped or committed — treat as a backlog to
pull from, not a sprint plan.

### Core experience
- [ ] Mobile app (iOS first, then Android) — trip planning on the go, live notifications
      during drives, offline map access.
- [~] Trip sharing & collaboration — **shipped**: shareable invite links + shared
      member-editable itinerary (suggest/vote on stops). **Remaining**: a read-only
      "passenger" view and real-time location during the drive.
- [x] Trip history & saved routes — **shipped** as Saved Trips / My Trips + editable
      per-trip itinerary ("My Plan"). Biggest lever for repeat usage and retention.
- [ ] Calendar integration (Google, Outlook) — auto-populate departure from calendar
      events; send a calendar invite for group trips.
- [ ] Smart notifications — departure reminders, "leave now" based on live traffic,
      weather alerts, fuel/charging warnings.

### Social & community
- [~] Road trip social feed — share trip photos, tips, favorite stops. **Built** (branch
      `feature/social-feed`): follow-based feed + Discover, a composer (text / photo /
      attach a saved trip / share a stop), likes, comments, follow/unfollow, user profiles,
      and report → auto-hide moderation. Follow-ons: a notifications center (likes/comments/
      new-follower), algorithmic ranking, hashtags/mentions, image moderation, blocking.
      Technical detail in [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md) §12.
- [x] Ratings on recommendations — users rate hotels/restaurants Wayvue suggested; feeds
      back into recommendation quality and builds trust. **Shipped**: star ratings on stops
      & hotels, community reviews with author names/avatars, and a "Top rated" sort.
- [x] Group trip planning — **shipped** (merged to `main`): shareable invite links, shared
      member-editable itinerary, voting (route style + per-stop), a collaborator activity
      feed + unread notifications, and member avatars/activity badges on My Trips. Follow-ons:
      email invites and realtime sync (currently ~10s polling). **Cost-splitting shipped** —
      a Splitwise-style Expenses tab (equal / exact / shares / % + settle-up), branch
      `feature/expense-splitting`, detail in [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md) §6/§14.

### Integrations & partnerships
- [~] **Activities / things-to-do — Viator (TripAdvisor)**, affiliate. Surface bookable
      experiences near the destination (jet ski, parasailing, tours, theme parks like
      Cedar Point at Sandusky) with "Book on Viator" links. **Placeholder shipped**: an
      Activities section, `/api/trip/activity-recommendations` endpoint, and a
      null-guarded `viatorService` all exist and degrade to a "coming soon" state.
      Remaining: a Viator Partner **Basic/Affiliate API key** (`VIATOR_API_KEY`) + wiring
      the product search + response mapping. Technical details in
      [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md).
- [~] Spotify/Apple Music — **built** (branch `feature/spotify-playlist`): a collaborative
      per-trip **playlist** — search Spotify's catalog and add songs; on a shared trip every
      member can add/remove (reuses group RLS + the activity feed). Playback = 30s previews
      (best-effort) + "Open in Spotify". Follow-ons: export to a real Spotify playlist, full
      in-app playback, and the roadmap's "curated playlist sized to trip duration" (AI fill).
      Technical detail in [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md) §13.
- [ ] Gas/EV charging payment — partner with fuel networks (Shell, Tesla, Electrify
      America) for in-app payment; affiliate revenue.
- [~] Hotel/rental booking — **Tier 1 built** (branch `feature/booking-affiliates`): the
      existing hotel & rental cards now deep-link to **Booking.com, Expedia, Vrbo, and Kayak**
      via an affiliate-aware `bookingPartners` registry (env-gated IDs; links work
      un-monetized until set, with disclosure). Booking.com earns natively via `aid`; Expedia/
      Vrbo have a network-wrap seam (Impact/Partnerize) to fill in. (Airbnb has no affiliate
      program since 2021 — use Vrbo/Stay22.) Follow-ons: turn on the Expedia network wrap;
      Tier 2 embedded search widget; Tier 3 true in-app booking (Amadeus/Expedia Rapid).
      Technical detail in [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md) §7.
- [ ] Insurance & roadside assistance partnerships — trip-specific coverage
      recommendations.
- [~] **Travel shopping recommendations** — **built** (branch `feature/travel-shopping`): a
      **"Pack for this trip"** tab that recommends trip-tailored gear with **Amazon Associates**
      affiliate links — rain gear on a wet forecast, sunshade/cooler for warm weather, a
      thermal blanket/ice scraper for cold, travel pillow/snacks for long drives, and camp
      gear for outdoorsy routes, on top of always-on essentials (phone mount, charger, dash
      cam, first-aid). Rules-based off the route's weather/duration/season; each product
      carries its own search query so specific categories can later point at higher-commission
      merchants (REI/YETI, via AvantLink/ShareASale). Follow-ons: Amazon PA-API for live
      prices/images, "Add to plan", more merchants. Detail in
      [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md) §7.

### Monetization
- [ ] **Freemium tiers**
  - Free: basic route planning, weather, 1 saved trip, standard recommendations.
  - Premium (~$4.99–9.99/mo): unlimited saved trips, offline maps, group planning,
    real-time collaboration, priority support.
  - Pro (~$19.99/mo): + carbon footprint / cost-breakdown analytics, predictive traffic
    rerouting, integration API for businesses.
- [ ] **Affiliate revenue** — Booking.com/Airbnb/Expedia (hotels & rentals), gas/EV
      networks, travel insurance (World Nomads, SafetyWing), car rentals (Hertz, Avis,
      Enterprise), travel gear (Amazon Associates).
- [ ] **B2B/Enterprise** — fleet management for rideshare/delivery companies, white-label
      route planning for travel agencies/tour operators, embedded licensing for car
      rental companies, risk-scoring API for insurers.
- [ ] **Advertising (contextual only)** — non-intrusive "recommended by [partner]" badges,
      local search ads for gas/EV/restaurants near the route. Avoid banner/pop-up ads —
      explicitly a UX regression, not just a preference.
- [ ] **Premium one-off features** — paid PDF/CSV trip cost + carbon offset report,
      custom trip templates for recurring trips, priority weather/traffic API access for
      B2B logistics partners.

### Suggested near-term priority (if picking a starting point)
1. ✅ **Done** — saved trips / trip history, ratings & reviews, and group trip planning
   (invite-link sharing + collaboration) are all shipped.
2. **Reliable stops** (self-hosted Overpass / POI provider) — foundational quality fix; the
   public Overpass mirrors throttle and leave categories (esp. rest areas) thin. Improves
   the entire recommendation surface. See [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md).
3. Booking affiliate links (hotels/rentals) — revenue with the least engineering lift,
   since recommendation cards already exist.
4. Travel shopping recommendations ("Pack for this trip") — high-intent, low-friction
   affiliate revenue.
5. Freemium paywall — enough premium-worthy functionality now exists (saved trips, group
   planning, PDF export) to gate.
6. Mobile app — largest lift; sequence after the above prove out on web.
