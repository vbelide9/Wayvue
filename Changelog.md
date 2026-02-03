# Changelog

All notable changes to the **Wayvue** project will be documented in this file.

## [v1.2.2] - 2026-02-03
### Fixed
- **Tablet Layout**: Fixed an issue where the results panel on iPad/Tablet was constrained to a small width (`max-w-md`), leaving empty space. It now fills the full width in the stacked layout.

## [v1.2.1] - 2026-02-03
### Fixed
- **Mobile Logo Visibility**: Unhidden the "Wayvue" logo text on mobile screens (removed `hidden sm:block`).
- **Trip Header Overlap**: Refactored `TripHeader` to stack controls vertically on mobile screens preventing overlap of Price/Unit toggle and Route information.
- **AI Summary Layout**: Moved **Wayvue Intelligence** to the top of the Overview tab (immediately after Safety Score) ensuring critical insights are visible without scrolling.

## [v1.2.0] - 2026-02-03
### Added
- **Mobile Responsiveness**: Complete overhaul of the mobile experience.
    - **Responsive Layout**: `TripViewLayout` now stacks the map (45%) and results panel (55%) on small screens.
    - **Bottom Sheet Interaction**: Added a "drag handle" visual and rounded corners to the mobile results panel for a native app feel.
    - **Collapsible Inputs**: The home screen input ribbon is now collapsible and streamlined for mobile, prioritizing Start/End locations.
- **Enhanced Trip Header**: Added start/end scrolling masks and larger touch targets for unit toggles on mobile.
- **Cache Management**: Updated `.gitignore` to exclude `.firebase` cache files.

### Changed
- **Loading Experience**: Replaced the generic spinner with a custom **Travel-Themed Loading Animation** (cycling icons: Car, Tent, Mountain, etc.) and dynamic status messages (e.g., "Packing the car...", "Checking weather...").

## [v1.1.0] - 2026-02-02
### Added
- **Smart Schedule**: UI polish for the "Smart Schedule" card, including clearer "Safety" and "Traffic" labels and dynamic badges.
- **Suggested Stops**: Redesigned the "Suggested Stops" section with category-specific colors (Food, Gas, etc.) and a horizontal scrollable filter list.
- **ETA & Distance**: Added ETA and cumulative distance indicators to Weather Cards in the Forecast tab.
- **Quick Route Edit**: Implemented a popover for quickly editing the route (Start/End) directly from the Trip Header.

### Fixed
- **Weather N/A Bug**: Fixed an issue where map markers displayed "N/A" for temperature by implementing a gap-filling strategy (interpolating nearest valid weather data).
- **Date Handling**: Corrected date logic for overnight trips to ensuring weather queries match the actual arrival day.
- **Deployment**: Resolved 500 errors by synchronizing server-side logic with Firebase Cloud Functions.

## [v1.0.0] - 2026-02-01
### Added
- **Initial Release**: Core "Wayvue" trip intelligence features.
- **AI Analysis**: Implementation of `WayvueAI` for generating trip safety scores and insights.
- **Real-time Weather**: Integration with Open-Meteo for route-based weather forecasting.
- **Places Search**: Functionality to find stops (Gas, Food, EV Charging) along the route.
- **Map Visualization**: Interactive map with route polyline, weather markers, and traffic layers.
- **Project Structure**: Setup of Client (Vite/React), Server (Express), and Firebase configuration.
