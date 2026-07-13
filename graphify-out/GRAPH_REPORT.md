# Graph Report - .  (2026-07-07)

## Corpus Check
- Large corpus: 233 files · ~1,223,143 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 577 nodes · 702 edges · 54 communities (33 shown, 21 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.58)
- Token cost: 418,014 input · 0 output

## Community Hubs (Navigation)
- Backend Intelligence Services
- Result Cards & 3D Backgrounds
- Firebase Functions Entrypoint
- App Shell & Backgrounds
- External Data Sources & Services
- Client Runtime Dependencies
- Server Logging & Bootstrap
- Client Build Tooling
- Trip Planner Inputs
- TS App Compiler Config
- Fuel & Toll Cost Services
- TS Node Compiler Config
- Functions Package Manifest
- Server Package Manifest
- Hotel Stay Recommendations
- Booking Deep Links
- Landing Feature Mockups
- Select UI Primitive
- Admin Dashboard
- Wayvue Brand & Landing Visuals
- Community Intel Section
- Camera Service (server)
- Camera Service (functions)
- Places Recommendations
- Road Condition Card
- Trip Confidence Card
- Weather Card
- Collapsible Section
- Community Intel Widget
- Performance Chart
- Route Summary
- Button Primitive
- Calendar Primitive
- Wayvue AI Summary
- Root TS Config
- Route Debug Script
- Round-Trip Debug Script
- NY Traffic Cameras
- Palette Review Tools
- Input Primitive
- API Documentation
- Vite Logo
- React Logo

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 22 edges
2. `compilerOptions` - 18 edges
3. `processLeg()` - 15 edges
4. `AnalyticsService` - 10 edges
5. `processLeg()` - 10 edges
6. `getIncidentsAlongRoute()` - 9 edges
7. `reverseGeocode()` - 7 edges
8. `getLiveHotelOffers()` - 7 edges
9. `Route Controller` - 6 edges
10. `Wayvue Changelog` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Wayvue System Architecture` --references--> `Wayvue Trip Intelligence App`  [INFERRED]
  ARCHITECTURE.md → README.md
- `Wayvue Changelog` --references--> `Wayvue Trip Intelligence App`  [INFERRED]
  Changelog.md → README.md
- `TrafficService` --shares_data_with--> `Trip Confidence Score`  [INFERRED]
  API_DOCUMENTATION.md → README.md
- `AIService (WayvueAI Insights Engine)` --conceptually_related_to--> `Trip Confidence Score`  [INFERRED]
  ARCHITECTURE.md → README.md
- `WeatherService` --shares_data_with--> `Smart Departure Planner`  [INFERRED]
  API_DOCUMENTATION.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Wayvue Backend Intelligence Service Layer** — api_documentation_route_service, api_documentation_weather_service, api_documentation_places_service, api_documentation_geocoding_service, architecture_ai_service [EXTRACTED 1.00]
- **Wayvue Free-Tier External Data Providers** — api_documentation_osrm, api_documentation_open_meteo, api_documentation_arcgis, api_documentation_overpass [EXTRACTED 1.00]

## Communities (54 total, 21 thin omitted)

### Community 0 - "Backend Intelligence Services"
Cohesion: 0.06
Nodes (43): calculateTripScore(), generateTripAnalysis(), reverseGeocode(), axios, bboxAreaKm2(), bboxToString(), buildTiles(), downsampleRoute() (+35 more)

### Community 1 - "Result Cards & 3D Backgrounds"
Cohesion: 0.07
Nodes (31): RentalOption, RentalRecommendationCard(), RentalRecommendationProps, ThreeGlobeBackground(), CATEGORIES, TopCategoryNav(), ForecastTab(), ForecastTabProps (+23 more)

### Community 2 - "Firebase Functions Entrypoint"
Cohesion: 0.07
Nodes (35): admin, app, cors, db, express, functions, { geocode }, memoryAnalytics (+27 more)

### Community 3 - "App Shell & Backgrounds"
Cohesion: 0.08
Nodes (24): App(), ErrorBoundary, Props, State, hexToRgb(), IntelligenceBackground(), palettes, rgbToHsl() (+16 more)

### Community 4 - "External Data Sources & Services"
Cohesion: 0.07
Nodes (33): ArcGIS World Geocoding Service, U.S. EIA Gas Prices API v2, Graceful Fallback Strategy, GasPriceService, GeocodingService, Open-Meteo Weather API, OSRM (Open Source Routing Machine), OpenStreetMap Overpass API (+25 more)

### Community 5 - "Client Runtime Dependencies"
Cohesion: 0.06
Nodes (30): dependencies, axios, class-variance-authority, clsx, date-fns, framer-motion, leaflet, lenis (+22 more)

### Community 6 - "Server Logging & Bootstrap"
Cohesion: 0.10
Nodes (21): fs, logPath, path, app, cors, express, { geocode }, logDebug (+13 more)

### Community 7 - "Client Build Tooling"
Cohesion: 0.07
Nodes (26): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+18 more)

### Community 8 - "Trip Planner Inputs"
Cohesion: 0.10
Nodes (15): CombinedDateTimePicker(), CombinedDateTimePickerProps, CustomDatePickerProps, CustomTimePickerProps, LocationInput(), LocationInputProps, Suggestion, PlannerCard() (+7 more)

### Community 9 - "TS App Compiler Config"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+16 more)

### Community 10 - "Fuel & Toll Cost Services"
Cohesion: 0.12
Nodes (22): axios, calculateFuelCosts(), EIA_STATE_CODES, extractState(), FALLBACK_PRICES, fetchFromEIA(), getEIACode(), getGasPrice() (+14 more)

### Community 11 - "TS Node Compiler Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 12 - "Functions Package Manifest"
Cohesion: 0.10
Nodes (19): author, dependencies, axios, cors, dotenv, express, firebase-admin, firebase-functions (+11 more)

### Community 13 - "Server Package Manifest"
Cohesion: 0.12
Nodes (15): author, dependencies, axios, cors, dotenv, express, @mapbox/polyline, description (+7 more)

### Community 14 - "Hotel Stay Recommendations"
Cohesion: 0.29
Nodes (8): HotelOption, HotelRecommendationCard(), HotelRecommendationProps, addDays(), extractCity(), formatDate(), StayTab(), StayTabProps

### Community 15 - "Booking Deep Links"
Cohesion: 0.31
Nodes (9): DeepLinkParams, generateHotelLinks(), generateRentalLinks(), getBookingLink(), getExpediaLink(), getKayakHotelLink(), getKayakLink(), HotelLinkParams (+1 more)

### Community 16 - "Landing Feature Mockups"
Cohesion: 0.22
Nodes (3): fadeUp, FEATURES, stagger

### Community 17 - "Select UI Primitive"
Cohesion: 0.25
Nodes (7): SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger

### Community 19 - "Wayvue Brand & Landing Visuals"
Cohesion: 0.29
Nodes (7): Wayvue Adventure Road-Trip Brand Message - outdoor exploration mood: SUV loaded with kayak and gear heading into forested mountains, evoking journey planning and the open road, Wayvue Adventure Road-Trip Theme - kayak-topped overland SUV on a scenic mountain highway evoking freedom, exploration, and the wanderlust marketing message of the Wayvue travel brand, Wayvue Favicon, Wayvue Hero Sequence, Wayvue Landing Page Animation, Wayvue Landing Page Video - cinematic sequence of a dark green off-road SUV driving away down a curving mountain highway at golden hour, carrying an orange kayak and rear-mounted spare tire, surrounded by pine forest and misty mountain ranges, Wayvue Logo

### Community 20 - "Community Intel Section"
Cohesion: 0.33
Nodes (3): POPULAR_ROUTES, StatItem, STATS

### Community 21 - "Camera Service (server)"
Cohesion: 0.40
Nodes (5): axios, deg2rad(), getDistanceInMiles(), NOTE: This requires valid API keys from the respective state DOTs (511PA, 511NY,, RealCameraService

### Community 22 - "Camera Service (functions)"
Cohesion: 0.40
Nodes (5): axios, deg2rad(), getDistanceInMiles(), NOTE: This requires valid API keys from the respective state DOTs (511PA, 511NY,, RealCameraService

## Knowledge Gaps
- **287 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+282 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Client Runtime Dependencies` to `Client Build Tooling`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `App()` connect `App Shell & Backgrounds` to `Client Runtime Dependencies`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `lenis` connect `Client Runtime Dependencies` to `App Shell & Backgrounds`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _290 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Intelligence Services` be split into smaller, more focused modules?**
  _Cohesion score 0.0641025641025641 - nodes in this community are weakly interconnected._
- **Should `Result Cards & 3D Backgrounds` be split into smaller, more focused modules?**
  _Cohesion score 0.06567992599444958 - nodes in this community are weakly interconnected._
- **Should `Firebase Functions Entrypoint` be split into smaller, more focused modules?**
  _Cohesion score 0.06763285024154589 - nodes in this community are weakly interconnected._