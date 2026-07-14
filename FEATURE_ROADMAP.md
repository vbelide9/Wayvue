# Wayvue — Feature & Product Roadmap

Product-facing feature ideas, growth levers, and monetization strategy.
For technical implementation tracking (backend work, API keys, code TODOs), see
[FUTURE_IMPLEMENTATION.md](FUTURE_IMPLEMENTATION.md).

Last updated: 2026-07-13.

---

## Growth, Professionalism & Monetization

Brainstormed direction for turning Wayvue from a working prototype into a product with
retention loops and revenue. Nothing here is scoped or committed — treat as a backlog to
pull from, not a sprint plan.

### Core experience
- [ ] Mobile app (iOS first, then Android) — trip planning on the go, live notifications
      during drives, offline map access.
- [ ] Trip sharing & collaboration — shareable link so passengers see the live itinerary;
      suggest stops; real-time location during the trip.
- [ ] Trip history & saved routes — biggest lever for repeat usage and retention.
- [ ] Calendar integration (Google, Outlook) — auto-populate departure from calendar
      events; send a calendar invite for group trips.
- [ ] Smart notifications — departure reminders, "leave now" based on live traffic,
      weather alerts, fuel/charging warnings.

### Social & community
- [ ] Road trip social feed — share trip photos, tips, favorite stops.
- [ ] Ratings on recommendations — users rate hotels/restaurants Wayvue suggested; feeds
      back into recommendation quality and builds trust.
- [ ] Group trip planning — organizer creates the trip, invites friends, the group votes
      on route preferences and can split costs.

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
1. Trip sharing (shareable link) — viral loop, relatively contained scope.
2. Saved trips / trip history — retention lever, needed before most other social/premium
   features make sense.
3. Booking affiliate links (hotels/rentals) — revenue with the least engineering lift,
   since recommendation cards already exist.
4. Freemium paywall — once there's enough premium-worthy functionality (saved trips,
   sharing) to gate.
5. Mobile app — largest lift; sequence after the above prove out on web.
