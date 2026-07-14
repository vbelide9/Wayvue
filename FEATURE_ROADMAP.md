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

**Known follow-ons** (see [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md)): email
invites, realtime sync (currently ~10s polling), cost-splitting, a self-hosted Overpass /
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
- [ ] Road trip social feed — share trip photos, tips, favorite stops.
- [x] Ratings on recommendations — users rate hotels/restaurants Wayvue suggested; feeds
      back into recommendation quality and builds trust. **Shipped**: star ratings on stops
      & hotels, community reviews with author names/avatars, and a "Top rated" sort.
- [x] Group trip planning — **shipped** (merged to `main`): shareable invite links, shared
      member-editable itinerary, voting (route style + per-stop), a collaborator activity
      feed + unread notifications, and member avatars/activity badges on My Trips. Follow-ons:
      email invites, realtime sync (currently ~10s polling), and cost-splitting (**deferred**).
      Technical detail in [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md) §6.

### Integrations & partnerships
- [~] **Activities / things-to-do — Viator (TripAdvisor)**, affiliate. Surface bookable
      experiences near the destination (jet ski, parasailing, tours, theme parks like
      Cedar Point at Sandusky) with "Book on Viator" links. **Placeholder shipped**: an
      Activities section, `/api/trip/activity-recommendations` endpoint, and a
      null-guarded `viatorService` all exist and degrade to a "coming soon" state.
      Remaining: a Viator Partner **Basic/Affiliate API key** (`VIATOR_API_KEY`) + wiring
      the product search + response mapping. Technical details in
      [FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md).
- [ ] Spotify/Apple Music — curated playlist sized to the trip duration.
- [ ] Gas/EV charging payment — partner with fuel networks (Shell, Tesla, Electrify
      America) for in-app payment; affiliate revenue.
- [ ] Hotel/rental booking — book directly instead of just recommending (Booking.com,
      Airbnb affiliate links).
- [ ] Insurance & roadside assistance partnerships — trip-specific coverage
      recommendations.
- [ ] **Travel shopping recommendations** — surface trip-relevant gear/products with
      affiliate links (Amazon Associates, etc.), tailored to the trip: rain gear for a
      wet forecast, a cooler / sunshade for a long summer drive, dash cam, phone mount,
      EV adapter, camping gear when the plan has campsites. Could live as its own
      insights section ("Pack for this trip") and/or "Add to plan" items. High-intent,
      low-friction affiliate revenue.

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
