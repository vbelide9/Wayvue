# Wayvue — API & Data Source Documentation

> **Last Updated:** April 2026  
> **Status:** All core APIs are live and integrated

---

## Table of Contents

1. [API Key Security](#api-key-security)
2. [Active APIs Overview](#active-apis-overview)
3. [Routing — OSRM](#1-routing--osrm)
4. [Geocoding — ArcGIS](#2-geocoding--arcgis)
5. [Weather — Open-Meteo](#3-weather--open-meteo)
6. [Gas Prices — U.S. EIA](#4-gas-prices--us-eia)
7. [Traffic — TomTom](#5-traffic--tomtom)
8. [Places & Stops — OpenStreetMap Overpass](#6-places--stops--openstreetmap-overpass)
9. [Traffic Cameras — 511NY DOT](#7-traffic-cameras--511ny-dot)
10. [TomTom Full Capabilities](#tomtom-full-capabilities)
11. [Fallback Strategy](#fallback-strategy)

---

## API Key Security

All API keys are stored in `server/.env` which is **gitignored** and never committed to version control.

| File | Purpose | Committed? |
|---|---|---|
| `server/.env` | **Live keys** — actual credentials | ❌ Never committed |
| `server/.env.example` | **Template** — shows required vars with empty values | ✅ Committed |
| `.gitignore` | Blocks `.env`, `.env.local`, `.env.*.local` | ✅ Committed |

### Required Environment Variables

```env
# server/.env
PORT=3001

# Gas Prices — U.S. Energy Information Administration
EIA_API_KEY=<your_key>

# Traffic — TomTom
TOMTOM_API_KEY=<your_key>

# Optional / Not currently active
MAPBOX_ACCESS_TOKEN=
OPENWEATHER_API_KEY=
NY_511_API_KEY=
```

---

## Active APIs Overview

| # | Data | API Provider | Auth | Cost | Rate Limit | File |
|---|---|---|---|---|---|---|
| 1 | Routing (distance, duration, geometry) | OSRM | None | Free | Unlimited* | `routeService.js` |
| 2 | Geocoding / Reverse Geocoding | ArcGIS | None | Free | Generous | `geocodingService.js` |
| 3 | Weather (temperature, wind, precip, forecasts) | Open-Meteo | None | Free | 10,000/day | `weatherService.js` |
| 4 | Gas Prices (by PADD region) | U.S. EIA API v2 | API Key | Free | Unlimited | `gasPriceService.js` |
| 5 | Traffic Flow (real-time speed, congestion) | TomTom Traffic Flow | API Key | Free tier | 2,500/day | `trafficService.js` |
| 6 | Places (restaurants, gas, viewpoints, etc.) | OpenStreetMap Overpass | None | Free | Fair use | `placesService.js` |
| 7 | Traffic Cameras | 511NY DOT | API Key | Free | N/A | `realCameraService.js` |

*\*OSRM public demo server — for production, self-host is recommended.*

---

## 1. Routing — OSRM

**Provider:** [Open Source Routing Machine](http://project-osrm.org/)  
**File:** `server/services/routeService.js`  
**Authentication:** None  

### What It Does
- Calculates driving routes between two points
- Returns full GeoJSON geometry, distance (meters), and duration (seconds)
- Supports alternative routes (used for "scenic" preference)

### Endpoint Used
```
GET http://router.project-osrm.org/route/v1/driving/{startLng},{startLat};{endLng},{endLat}
    ?overview=full
    &geometries=geojson
    &alternatives=true
```

### Data Returned
| Field | Description |
|---|---|
| `geometry` | Full GeoJSON LineString of the route |
| `distance` | Total distance in meters |
| `duration` | Total travel time in seconds |
| `routes[]` | Array of alternatives when `alternatives=true` |

### Fallback
If OSRM is unreachable, generates a straight-line route using Haversine distance at assumed 60 mph.

### Limitations
- Uses the public demo server (not intended for heavy production use)
- No real-time traffic consideration (traffic is handled by TomTom separately)
- Limited to driving mode

---

## 2. Geocoding — ArcGIS

**Provider:** [ArcGIS World Geocoding Service](https://geocode.arcgis.com/)  
**File:** `server/services/geocodingService.js`  
**Authentication:** None (anonymous access)

### What It Does
- **Forward Geocoding:** Converts place names/addresses → coordinates
- **Reverse Geocoding:** Converts coordinates → city, state names

### Endpoints Used

**Forward:**
```
GET https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates
    ?f=json
    &SingleLine={query}
    &maxLocations=1
```

**Reverse:**
```
GET https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode
    ?f=json
    &location={lon},{lat}
    &distance=10000
```

### Data Returned
| Field | Source | Description |
|---|---|---|
| `lat`, `lon` | Forward | Coordinates of the matched location |
| `display_name` | Forward | Formatted address string |
| `City`, `RegionAbbr` | Reverse | City and state abbreviation (e.g., "Dallas, TX") |

### Caching
- Reverse geocode results are cached in-memory (key: `lat.toFixed(4),lon.toFixed(4)`)
- Cache max size: 1,000 entries, FIFO eviction
- Includes retry logic with exponential backoff (up to 2 retries)

### Limitations
- Anonymous usage has rate limits (sufficient for moderate traffic)
- For heavy production use, register for an ArcGIS API key

---

## 3. Weather — Open-Meteo

**Provider:** [Open-Meteo](https://open-meteo.com/)  
**File:** `server/services/weatherService.js`  
**Authentication:** None  

### What It Does
- Fetches current and hourly forecast weather data for any coordinate
- Supports date-specific forecasts (up to 16 days ahead)
- Used for route weather timeline, road condition assessment, and departure optimization

### Endpoint Used
```
GET https://api.open-meteo.com/v1/forecast
    ?latitude={lat}
    &longitude={lng}
    &current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m
    &hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability,wind_direction_10m
    &timezone=auto
    &start_date={YYYY-MM-DD}
    &end_date={YYYY-MM-DD}
```

### Data Returned
| Field | Unit | Description |
|---|---|---|
| `temperature` | °C | Temperature at target hour |
| `weathercode` | WMO code | Weather condition (0=Clear, 61=Rain, 71=Snow, etc.) |
| `windSpeed` | km/h | Wind speed at 10m height |
| `humidity` | % | Relative humidity |
| `precipitationProbability` | % | Chance of precipitation |
| `windDirection` | degrees | Wind direction |

### Batch Processing
- Points are processed in chunks of 5 with 200ms delay between chunks
- Gap-filling algorithm: if a point fails, it uses the nearest neighbor's data
- Batch function limits to 50 points maximum per request

### Limitations
- Free tier: ~10,000 requests/day
- Forecast limited to 16 days ahead
- Historical data requires different API endpoint (not currently used)

---

## 4. Gas Prices — U.S. EIA

**Provider:** [U.S. Energy Information Administration API v2](https://www.eia.gov/opendata/)  
**File:** `server/services/gasPriceService.js`  
**Authentication:** API Key (`EIA_API_KEY`)  
**Cost:** Free — unlimited requests  

### What It Does
- Fetches real weekly retail gasoline prices by **state** and **PADD region**
- Cascading lookup: state-level → PADD region → national → hardcoded fallback
- Used to calculate fuel costs along the route

### Endpoint Used
```
GET https://api.eia.gov/v2/petroleum/pri/gnd/data/
    ?api_key={key}
    &frequency=weekly
    &data[0]=value
    &facets[product][]=EPM0
    &facets[duoarea][]={duoareaCode}
    &sort[0][column]=period
    &sort[0][direction]=desc
    &length=1
```

### Lookup Strategy (Cascading)
```
State-level (e.g., SNY) → PADD region (e.g., R1Y) → National (NUS) → Hardcoded fallback
```

### EIA duoarea Codes

**State-level** (EIA publishes data for select states):
| Code | State | Example Price |
|---|---|---|
| `SNY` | New York | $3.97/gal |
| `SCA` | California | $5.83/gal |
| `STX` | Texas | $3.67/gal |
| `SFL` | Florida | $3.99/gal |
| `SMA` | Massachusetts | $3.91/gal |
| `SOH` | Ohio | $3.93/gal |
| `SCO` | Colorado | $3.91/gal |
| `SMN` | Minnesota | $3.49/gal |
| `SWA` | Washington | $5.29/gal |

**PADD Region** (for all other states):
| Code | Region | States |
|---|---|---|
| `R1X` | PADD 1A — New England | CT, ME, MA, NH, RI, VT |
| `R1Y` | PADD 1B — Central Atlantic | DE, DC, MD, NJ, NY, PA |
| `R1Z` | PADD 1C — Lower Atlantic | FL, GA, NC, SC, VA, WV |
| `R20` | PADD 2 — Midwest | IL, IN, IA, KS, KY, MI, MN, MO, NE, ND, OH, OK, SD, TN, WI |
| `R30` | PADD 3 — Gulf Coast | AL, AR, LA, MS, NM, TX |
| `R40` | PADD 4 — Rocky Mountain | CO, ID, MT, UT, WY |
| `R50` | PADD 5 — West Coast | AK, AZ, CA, HI, NV, OR, WA |
| `NUS` | National Average | All U.S. |

### Caching
- Results cached for **6 hours** (EIA updates weekly)
- Cache key: duoarea code (e.g., `SNY`, `R1Y`)
- Cache max size: 100 entries, FIFO eviction

### Fuel Cost Calculation
| Parameter | Value | Source |
|---|---|---|
| Average MPG | 25 | U.S. EPA fleet average |
| EV efficiency | 3.5 mi/kWh | Industry average |
| Electricity rate | $0.16/kWh | U.S. residential average |

### Fallback
If EIA is unreachable or key is missing, uses published PADD-region averages:
- Gulf Coast (R30): $3.69 (cheapest)
- West Coast (R50): $5.47 (most expensive)
- National average (NUS): $4.13

---

## 5. Traffic — TomTom

**Provider:** [TomTom Traffic Flow API](https://developer.tomtom.com/)  
**File:** `server/services/trafficService.js`  
**Authentication:** API Key (`TOMTOM_API_KEY`)  
**Cost:** Free tier — 2,500 requests/day  

### What It Does
- Fetches real-time traffic speed data for road segments
- Compares `currentSpeed` vs `freeFlowSpeed` to calculate congestion ratio
- Aggregates 5 sample points along the route to estimate total trip delay

### Endpoint Used
```
GET https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
    ?key={key}
    &point={lat},{lng}
    &unit=mph
    &thickness=1
```

### Data Returned Per Segment
| Field | Description |
|---|---|
| `currentSpeed` | Real-time speed (mph) |
| `freeFlowSpeed` | Speed with no traffic (mph) |
| `currentTravelTime` | Current travel time for segment (seconds) |
| `freeFlowTravelTime` | Free-flow travel time (seconds) |
| `confidence` | Data confidence (0-1) |
| `roadClosure` | Boolean — road closed? |

### Congestion Calculation
```
congestionRatio = currentSpeed / freeFlowSpeed
delay = routeDuration × (1/congestionRatio - 1)
```

| Ratio | Level |
|---|---|
| > 0.9 | Clear |
| 0.7 – 0.9 | Light |
| 0.5 – 0.7 | Moderate |
| < 0.5 | Heavy |

### Caching
- Results cached for **10 minutes**
- Cache key: coordinates rounded to 4 decimal places (~11m precision)
- Cache max size: 500 entries

### Sampling Strategy
- 5 evenly-spaced points along the route
- 100ms delay between API calls to respect rate limits

### Fallback (Heuristic)
If TomTom is unavailable:
```
freeFlowDuration = distance / 55 mph
delay = actualDuration - freeFlowDuration
```

---

## 6. Places & Stops — OpenStreetMap Overpass

**Provider:** [OpenStreetMap Overpass API](https://overpass-api.de/)  
**File:** `server/services/placesService.js`  
**Authentication:** None  

### What It Does
- Queries real POI data from OpenStreetMap along the route
- Returns restaurants, gas stations, EV charging, rest areas, viewpoints, and historic sites
- Uses strategic sample points (10%, 30%, 50%, 70%, 90% of route)

### Query Strategy
| Category | Radius | Tags |
|---|---|---|
| Food | 5 km | `amenity=cafe\|fast_food\|restaurant\|diner` |
| Fuel | 5 km | `amenity=fuel` |
| EV Charging | 15 km | `amenity=charging_station` |
| Rest Areas | 15 km | `highway=rest_area`, `amenity=rest_area` |
| Viewpoints | 15 km | `tourism=viewpoint\|museum\|park\|theme_park` |
| Historic | 15 km | `historic=memorial\|monument\|castle\|ruins` |

### Load Balancing
- Alternates between two Overpass mirrors:
  - `overpass-api.de`
  - `overpass.kumi.systems`
- 600ms jitter delay between segment queries

### Fallback
If Overpass returns no results for a segment, generates an honest "estimated" placeholder with the reverse-geocoded town name (marked `isEstimated: true`).

---

## 7. Traffic Cameras — 511NY DOT

**Provider:** [511NY Open Data](https://511ny.org/)  
**File:** `server/services/realCameraService.js`  
**Authentication:** API Key (`NY_511_API_KEY`)  
**Status:** ⚠️ Optional — key not currently configured  

### What It Does
- Fetches real traffic camera feeds from NY State DOT
- Finds the closest camera within a configurable radius (default 5 miles)

### Endpoint
```
GET https://511ny.org/api/getcameras?key={key}&format=json
```

### Fallback
If no camera API key or no cameras found nearby, returns a simulated placeholder camera object.

### Expansion Opportunity
- PA DOT (`getCamerasPA`) is stubbed but requires manual data feed approval from PennDOT

---

## TomTom Full Capabilities

Your TomTom API key has access to the following services. Currently, **Traffic Flow API** is integrated. The others represent expansion opportunities:

| API | Currently Used? | Potential Use in Wayvue |
|---|---|---|
| **Traffic Flow API** | ✅ Yes | Real-time speed/congestion data |
| **Traffic API** | ❌ | General traffic data layer |
| **Traffic Incidents API** | ❌ | Road closures, accidents, construction alerts |
| **Routing API** | ❌ | Could replace OSRM for traffic-aware routing |
| **Extended Routing API** | ❌ | Advanced routing with waypoints, avoid areas |
| **Matrix Routing v2 API** | ❌ | Multi-point travel time/distance matrices |
| **Geocoding API** | ❌ | Could replace ArcGIS for forward geocoding |
| **Reverse Geocoding API** | ❌ | Could replace ArcGIS for reverse geocoding |
| **Search API** | ❌ | POI search — could supplement Overpass |
| **EV Charging Stations Availability API** | ❌ | Real-time EV charger availability (live status!) |
| **Waypoint Optimization API** | ❌ | Optimal stop ordering for multi-stop trips |
| **Snap to Roads API** | ❌ | GPS trace snapping for accurate positioning |
| **Map Display API** | ❌ | TomTom map tiles (currently using Mapbox/OSM) |
| **Maps Assets API** | ❌ | Static map images and assets |
| **Batch Search API** | ❌ | Bulk geocoding/search operations |
| **Geofencing API** | ❌ | Geo-triggers for location-based alerts |
| **Location History API** | ❌ | Track and query location history |
| **Notifications API** | ❌ | Push notifications for traffic events |
| **Assets API** | ❌ | Asset tracking and management |
| **MCP Server** | ❌ | Machine Control Platform for fleet management |

### High-Value Expansion Opportunities

1. **Traffic Incidents API** — Show accidents, road work, and closures on the route map
2. **EV Charging Stations Availability API** — Show real-time charger availability (not just location)
3. **Routing API** — Traffic-aware routing that factors in live congestion (OSRM doesn't do this)
4. **Waypoint Optimization** — Help users plan multi-stop trips efficiently

---

## Fallback Strategy

Every API has a graceful fallback to ensure the app never crashes:

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Real API     │───▶│  Cached Result   │───▶│  Hardcoded       │
│  (Live data)  │    │  (TTL-based)     │    │  (Fallback)      │
└──────────────┘    └──────────────────┘    └──────────────────┘
       │                     │                       │
   EIA/TomTom         6h / 10min cache        Published averages
   OSRM/Meteo            In-memory            Heuristic estimates
   Overpass              Map-based             Honest placeholders
```

| Service | Cache TTL | Fallback Data Source |
|---|---|---|
| Gas Prices (EIA) | 6 hours | Published PADD-region averages (AAA) |
| Traffic (TomTom) | 10 minutes | Heuristic: OSRM duration vs 55 mph baseline |
| Weather (Open-Meteo) | No cache | Neighbor interpolation → 20°C/Clear default |
| Routing (OSRM) | No cache | Haversine straight-line at 60 mph |
| Places (Overpass) | No cache | Honest "estimated" placeholder with town name |
| Geocoding (ArcGIS) | Indefinite (in-memory) | Returns null → HTTP 422 to client |
| Cameras (511NY) | No cache | Simulated placeholder image |
