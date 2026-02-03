import { useState } from 'react';
import { RefreshCw, Navigation, ArrowRight } from 'lucide-react';
import MapComponent from './components/MapComponent';
import { getRoute } from './services/api';
import { CustomDatePicker, CustomTimePicker } from './components/CustomDateTimePicker';
import { LoadingScreen } from './components/LoadingScreen';

// UI Components
import { Button } from '@/components/ui/button';
import { LocationInput } from '@/components/LocationInput';
import { WeatherCard } from '@/components/WeatherCard';
// Only import Type for RoadCondition, component is unused in App.tsx
import { type RoadCondition } from '@/components/RoadConditionCard';
import { EmptyState } from '@/components/EmptyState';
import { TripViewLayout } from './components/trip-view/TripViewLayout';

export default function App() {


  // State
  const [start, setStart] = useState("New York, NY");
  const [destination, setDestination] = useState("Buffalo, NY");
  const [startCoords, setStartCoords] = useState<{ lat: number, lng: number } | undefined>(undefined);
  const [destCoords, setDestCoords] = useState<{ lat: number, lng: number } | undefined>(undefined);
  const [route, setRoute] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const [roadConditions, setRoadConditions] = useState<RoadCondition[]>([]);
  const [metrics, setMetrics] = useState({ distance: "0 mi", time: "0 min", fuel: "0 gal", ev: "$0" });
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [departureTime, setDepartureTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));

  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('F');

  // Selection State for Interaction
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);






  // View Mode State
  const [viewMode, setViewMode] = useState<'planning' | 'trip'>('planning');

  const handleRouteSubmit = async (startLoc?: string, destLoc?: string, depDate?: string, depTime?: string, startCoordsOverride?: any, destCoordsOverride?: any) => {
    const s = startLoc || start;
    const d = destLoc || destination;
    const dateToUse = depDate || departureDate;
    const timeToUse = depTime || departureTime;
    const sCoords = startCoordsOverride || startCoords;
    const dCoords = destCoordsOverride || destCoords;

    if (!s || !d) return;

    setLoading(true);
    try {
      const response = await getRoute(s, d, sCoords, dCoords, dateToUse, timeToUse);

      if (response.route) {
        setRoute(response.route);
        if (response.metrics) setMetrics(response.metrics);
        setWeatherData(response.weather || []);
        setRoadConditions(response.roadConditions || []);
        // Create a merged object for aiAnalysis state that includes the new fields from the root response
        const fullAiAnalysis = {
          ...response.aiAnalysis,
          tripScore: response.tripScore,
          departureInsights: response.departureInsights
        };
        setAiAnalysis(fullAiAnalysis);
        setRecommendations(response.recommendations || []);

        // Switch to Trip View
        setViewMode('trip');
      }
    } catch (error: any) {
      console.error(error);
      alert(`Failed to get route: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };



  const handleBackToPlanning = () => {
    setViewMode('planning');
    // Optional: Clear route or keep it? Keeping it facilitates toggle behavior, but let's stick to simple "Back" for now.
    // setRoute(null); 
  };

  // --- RENDER HELPERS ---

  // 1. Planning View (Home)
  const renderPlanningView = () => (
    <main className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans relative">
      {/* Background Map (or similar visual if needed, currently reusing logic but simpler) */}
      {/* For Planning Mode, we want the "Home Page" feel. The original code had Map + Sidebar + Bottom.
           The user said "The home page is finalized... do NOT change the home page."
           So I must preserve the EXACT structure for the 'planning' state.
        */}

      {/* --- ORIGINAL LAYOUT STRUCTURE (Preserved) --- */}
      <div className="flex-1 flex overflow-hidden relative z-0">
        {/* LEFT COLUMN: MAP & OVERLAYS */}
        <div className="flex-1 lg:basis-[65%] flex flex-col relative min-w-0">

          {/* Loading Screen Overlay */}
          {loading && <LoadingScreen />}

          {/* Top Summary Ribbon (This contains the Inputs) */}
          <div className="absolute top-4 left-4 right-4 z-[400] flex flex-col gap-2 pointer-events-none">
            {/* 1. Dashboard Controls Row */}
            <div className="relative z-[410] flex items-center gap-2 pointer-events-auto">
              {/* Brand / Logo */}
              <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl p-2 shadow-lg flex items-center gap-3">
                <div className="bg-[#40513B] p-0 rounded-full shadow-md border border-white/5 backdrop-blur-sm overflow-hidden w-12 h-12 flex items-center justify-center">
                  <img src="/logo.svg" alt="Wayvue Logo" className="w-[85%] h-[85%] object-contain" />
                </div>
                <div className="block pr-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold tracking-tight leading-none text-foreground">Wayvue</h1>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium">Trip Intelligence</p>
                </div>
              </div>

              {/* Inputs Bar */}
              <div className="flex-1 bg-card/90 backdrop-blur-md border border-border rounded-xl p-2 sm:p-1 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2 h-auto sm:h-14 transition-all duration-300 ease-in-out">
                {/* Primary Row: Start -> End */}
                <div className="flex flex-col sm:flex-row gap-2 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <LocationInput
                      value={start}
                      onChange={setStart}
                      onSelect={setStartCoords}
                      label="Start Location"
                      variant="minimal"
                      placeholder="Start"
                      icon="start"
                    />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 hidden sm:block self-center" />
                  <div className="flex-1 min-w-0">
                    <LocationInput
                      value={destination}
                      onChange={setDestination}
                      onSelect={setDestCoords}
                      label="Destination Location"
                      variant="minimal"
                      placeholder="End"
                      icon="destination"
                    />
                  </div>
                </div>

                <div className="w-px h-8 bg-border mx-1 hidden sm:block" />

                {/* Secondary Row: Date/Time (Collapsible on Mobile could be nice, or just compact side-by-side) */}
                {/* For now, keeping them visible but compact side-by-side on mobile to avoid extra clicks, but styled cleaner */}
                <div className="flex items-center gap-2 border-t sm:border-t-0 border-border/50 pt-2 sm:pt-0">
                  <div className="flex-1 sm:flex-none">
                    <CustomDatePicker
                      value={departureDate}
                      onChange={setDepartureDate}
                      min={new Date().toISOString().split('T')[0]}
                      max={new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="flex-1 sm:flex-none">
                    <CustomTimePicker
                      value={departureTime}
                      onChange={setDepartureTime}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => handleRouteSubmit()}
                  disabled={loading}
                  className="h-10 sm:h-10 px-6 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm sm:ml-1 w-full sm:w-auto mt-1 sm:mt-0 font-bold tracking-wide"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  <span className="inline ml-2">{loading ? 'Planning...' : 'Go'}</span>
                </Button>
              </div>

              {/* Units Toggle */}
              <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl p-1 shadow-lg h-14 flex items-center">
                <div className="flex bg-secondary/50 rounded-lg p-1">
                  <button onClick={() => setUnit('C')} className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold transition-colors ${unit === 'C' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>°C</button>
                  <button onClick={() => setUnit('F')} className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold transition-colors ${unit === 'F' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>°F</button>
                </div>
              </div>
            </div>
          </div>

          {/* Map Component (Planning Mode - usually just start/end markers if set, or empty) */}
          <div className="flex-1 relative z-0">
            {/* Empty State Overlay */}
            {!route && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-md">
                <EmptyState />
              </div>
            )}

            <MapComponent
              routeGeoJSON={route}
              weatherData={weatherData}
              unit={unit}
              selectedLocation={selectedLocation}
            />

            {/* Map Corner Overlays (Weather) - Stacked on Right */}
            {weatherData.length > 0 && (
              <div className="absolute top-36 right-4 z-[400] pointer-events-none flex flex-col gap-4">
                <WeatherCard
                  variant="overlay"
                  unit={unit}
                  weather={{
                    location: start,
                    condition: "clear", // TODO: Real data
                    temperature: weatherData[0]?.temperature,
                    humidity: weatherData[0]?.humidity,
                    windSpeed: weatherData[0]?.windSpeed
                  }}
                />
                <WeatherCard
                  variant="overlay"
                  unit={unit}
                  weather={{
                    location: destination,
                    condition: "cloudy",
                    temperature: weatherData[weatherData.length - 1]?.temperature,
                    humidity: weatherData[weatherData.length - 1]?.humidity,
                    windSpeed: weatherData[weatherData.length - 1]?.windSpeed
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR (Original Placeholder) */}
        <div className="hidden lg:flex lg:basis-[35%] w-full max-w-md border-l border-border bg-card shadow-2xl z-[500] flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-hidden relative pt-2 min-h-0 flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-50">
            <div className="bg-[#40513B] p-0 rounded-full shadow-md border border-white/5 backdrop-blur-sm overflow-hidden w-24 h-24 flex items-center justify-center mb-6">
              <img src="/logo.svg" alt="Wayvue Logo" className="w-[85%] h-[85%] object-contain" />
            </div>
            <h2 className="text-xl font-bold mb-2">Wayvue</h2>
            <p className="font-medium mb-8">Enter a route to view intelligence</p>
          </div>
        </div>
      </div>
    </main>
  );

  return viewMode === 'planning' ? renderPlanningView() : (
    <TripViewLayout
      start={start}
      destination={destination}
      metrics={metrics}
      tripScore={aiAnalysis?.tripScore}
      roadConditions={roadConditions}
      weatherData={weatherData}
      aiAnalysis={aiAnalysis}
      recommendations={recommendations}
      unit={unit}
      onUnitChange={setUnit}
      onBack={handleBackToPlanning}
      onSearch={async (newStart, newEnd, newStartCoords, newEndCoords) => {
        // Update state first
        setStart(newStart);
        setDestination(newEnd);
        if (newStartCoords) setStartCoords(newStartCoords);
        if (newEndCoords) setDestCoords(newEndCoords);

        // Trigger route calc with new values directly to ensure latest data is used
        // handleRouteSubmit accepts optional overrides
        await handleRouteSubmit(newStart, newEnd, undefined, undefined, newStartCoords, newEndCoords);
      }}
      onSegmentSelect={(lat, lng) => setSelectedLocation({ lat, lng })}
      map={
        <MapComponent
          routeGeoJSON={route}
          weatherData={weatherData}
          unit={unit}
          selectedLocation={selectedLocation}
        />
      }
    />
  );
}
