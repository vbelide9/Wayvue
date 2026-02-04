# Changelog

All notable changes to the **Wayvue** project will be documented in this file.








## [v1.2.11] - 2026-02-04
### Changed
- **Instant Route Switching**: Switching between "Fastest" and "Scenic" routes is now instant and no longer triggers a loading screen when the location hasn't changed.
- **Route Icons**: Updated the route preference icons to a **Camera** (Scenic) and **Zap** (Fastest), matching the Trip View design, and added tooltips.
- **Favicon**: Updated the browser tab icon to a custom SVG with a dark background for better visibility, replacing the standard transparent icon.

### Added
- **Route Update Feedback**: Added a contextual "Updating your journey" loading screen with animation for legitimate route changes (e.g., changing date or destination).

### Fixed
- **Toggle Button Layout**: Fixed CSS styling issues that caused misalignment and invalid spacing in the route preference toggle buttons.
## [v1.2.10] - 2026-02-03
### Fixed
- **Input Icon Overlap**: Added right padding to the start location input to prevent long text (e.g., "New York, NY") from overlapping with the "Current Location" icon.

## [v1.2.9] - 2026-02-03
### Changed
- **Empty State Copy**: Updated the main heading from "Where to today?" to "Plan your escape." to better align with the target audience.

## [v1.2.8] - 2026-02-03
### Added
- **Extended Trip Header Metrics**: Restored the display of Gas Price (Fuel), Electric Price (EV), and Alert counts in the trip view header.
- **Responsive Metrics Bar**: Implemented a scrollable container for header metrics on mobile, ensuring all data (Time, Dist, Fuel, EV, Alerts) fits without breaking layout.

### Fixed
- **Mobile Icon Visibility**: Addressed an issue where the central navigation icon was hidden on mobile due to the new taller header. Applied specific responsive spacing (`pt-[400px]` on mobile) to ensure the icon is visible below the search box, while strictly correctly maintaining the standard layout on laptop/desktop screens.

### Changed
- **Mobile Header Layout**: Refactored the top navigation bar for mobile devices. The "Search Locations" input bar is now placed on its own row below the logo and controls, ensuring it is always perfectly centered and has ample space for input. Desktop layout remains a single unified row.

### Fixed
- **Mobile Home Screen Layout**: Fixed an issue where the central "Navigation Compass" icon was hidden behind the input bar on mobile devices. Added responsive spacing to ensure the "Where to today?" section and its icon are fully visible and centered below the controls.

### Added
- **Current Location Button**: Added a "Locate Me" button (crosshair icon) to the Start Location input on mobile. This addresses user feedback about missing navigation functionality, allowing users to quickly fill their current location.

### Fixed
- **Calculation Error Handling**: Resolved an issue where invalid start/end locations or API failures would cause the app to silently reset to the home screen. Added clear error messages to the inputs bar to guide the user (e.g., "Please enter both a start and destination").

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
