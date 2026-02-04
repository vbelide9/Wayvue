import { useState } from 'react';
import { RefreshCw, Navigation, ArrowRight, Camera, Zap } from 'lucide-react';
import MapComponent from './components/MapComponent';
import { getRoute } from './services/api';
import { CombinedDateTimePicker } from './components/CustomDateTimePicker';
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

  // Trip Data State
  const [route, setRoute] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const [returnWeatherData, setReturnWeatherData] = useState<any[]>([]); // New state for return leg weather
  const [roadConditions, setRoadConditions] = useState<RoadCondition[]>([]);
  const [metrics, setMetrics] = useState({ distance: "0 mi", time: "0 min", fuel: "0 gal", ev: "$0" });
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [departureTime, setDepartureTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));

  // Return Date/Time State
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Default return next day
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [returnTime, setReturnTime] = useState('10:00');

  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('F');

  // Round Trip State
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [tripData, setTripData] = useState<any>(null);
  const [activeLeg, setActiveLeg] = useState<'outbound' | 'return'>('outbound');

  // Split preferences for independent selection
  const [outboundPref, setOutboundPref] = useState<'fastest' | 'scenic'>('fastest');
  const [returnPref, setReturnPref] = useState<'fastest' | 'scenic'>('fastest');
  // Helper to get current relevant preference
  const routePreference = activeLeg === 'return' ? returnPref : outboundPref;

  // Selection State for Interaction
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);

  // Error State
  const [error, setError] = useState<string | null>(null);

  // View Mode State
  const [viewMode, setViewMode] = useState<'planning' | 'trip'>('planning');

  const switchLeg = (leg: 'outbound' | 'return') => {
    if (!tripData) return;
    const data = leg === 'outbound' ? tripData.outbound : tripData.return;
    if (!data) return;

    setActiveLeg(leg);
    setRoute(data.route);
    setMetrics(data.metrics);
    setWeatherData(data.weather || []);
    setRoadConditions(data.roadConditions || []);

    // Merge AI Analysis with top-level insight fields if they exist there (likely structured differently in new backend)
    // In our new backend structure, 'aiAnalysis', 'tripScore', 'departureInsights' are inside the 'data' object.
    const fullAiAnalysis = {
      ...data.aiAnalysis,
      tripScore: data.tripScore,
      departureInsights: data.departureInsights
    };
    setAiAnalysis(fullAiAnalysis);
    setRecommendations(data.recommendations || []);
  };

  const handleRouteSubmit = async (
    startLoc?: string,
    destLoc?: string,
    depDate?: string,
    depTime?: string,
    startCoordsOverride?: any,
    destCoordsOverride?: any,
    overrideRoundTrip?: boolean,
    overridePreference?: 'fastest' | 'scenic',
    returnDateOverride?: string,
    returnTimeOverride?: string
  ) => {
    setError(null); // Clear previous errors

    // Use overrides if provided, or fallback to current state
    const s = startLoc || start;
    const d = destLoc || destination;
    const dateToUse = depDate || departureDate;
    const timeToUse = depTime || departureTime;
    const sCoords = startCoordsOverride || startCoords;
    const dCoords = destCoordsOverride || destCoords;

    // Return overrides
    const returnDateToUse = returnDateOverride || returnDate;
    const returnTimeToUse = returnTimeOverride || returnTime;

    // Determine Round Trip / Preference (Override > State)
    const rtToUse = overrideRoundTrip !== undefined ? overrideRoundTrip : isRoundTrip;
    const prefToUse = overridePreference || routePreference;

    // Update state if overrides are provided (to sync UI)
    if (overrideRoundTrip !== undefined) setIsRoundTrip(overrideRoundTrip);

    // Update Return Date/Time State if overridden
    if (returnDateOverride) setReturnDate(returnDateOverride);
    if (returnTimeOverride) setReturnTime(returnTimeOverride);

    // Update proper preference state if overridden
    if (overridePreference) {
      if (activeLeg === 'outbound') setOutboundPref(overridePreference);
      else setReturnPref(overridePreference);
    }

    if (!s || !d) {
      setError("Please enter both a start and destination.");
      return;
    }

    // Optimization: Instant Switch if we have cached variants
    // Triggers if: 
    // 1. We have tripData with variants
    // 2. Locations and Dates match (basic check: actually we assume if user is just clicking toggle on trip view, these are same)
    // 3. We are just changing preference
    console.log('[DEBUG-SWITCH] Checking cache:', {
      hasVariants: !!(tripData && tripData.variants),
      overridePreference,
      s, start, matchStart: s === start,
      d, destination, matchDest: d === destination
    });

    // Check if we can instant switch
    // We strictly check if variants exist and we are toggling preference.
    // We also check string equality, but trim() just in case.
    const isSameLocations = s.trim() === start.trim() && d.trim() === destination.trim();

    // Note: If returnDate changed, we CANNOT use cache, must fetch new route
    const isSameReturnDate = returnDateToUse === returnDate;

    if (tripData && tripData.variants && overridePreference && isSameLocations && isSameReturnDate) {
      console.log("Instant switch using cached variant:", overridePreference);
      // Logic:
      // We need to know WHICH leg to update if overridePreference is passed.
      // Access 'activeLeg' state here (closure).
      const currentActiveLeg = activeLeg; // Use closure value

      let newOutboundPref = outboundPref;
      let newReturnPref = returnPref;

      if (overridePreference) {
        if (currentActiveLeg === 'outbound') {
          newOutboundPref = overridePreference;
          setOutboundPref(overridePreference);
        } else {
          newReturnPref = overridePreference;
          setReturnPref(overridePreference);
        }
      }



      // Construct response from mixed variants
      // Outbound comes from variants[newOutboundPref]
      // Return comes from variants[newReturnPref]
      const outboundVariant = tripData.variants ? tripData.variants[newOutboundPref] : undefined;
      const returnVariant = tripData.variants ? tripData.variants[newReturnPref] : undefined;

      if (outboundVariant && (!rtToUse || (returnVariant && returnVariant.return))) {
        const cachedResponse = {
          ...tripData,
          isRoundTrip: !!rtToUse,
          outbound: outboundVariant.outbound,
          return: returnVariant ? returnVariant.return : null
        };
        // ... proceed to setTripData(cachedResponse)
        setTripData(cachedResponse);
        const isRTResponse = cachedResponse.isRoundTrip;
        const initialData = (currentActiveLeg === 'return' && isRTResponse) ? cachedResponse.return : cachedResponse.outbound;


        if (isRTResponse && cachedResponse.return) {
          setReturnWeatherData(cachedResponse.return.weather || []);
        } else {
          setReturnWeatherData([]);
        }

        if (initialData && initialData.route) {
          setRoute(initialData.route);
          if (initialData.metrics) setMetrics(initialData.metrics);
          setWeatherData(initialData.weather || []);
          setRoadConditions(initialData.roadConditions || []);
          const fullAiAnalysis = {
            ...initialData.aiAnalysis,
            tripScore: initialData.tripScore,
            departureInsights: initialData.departureInsights
          };
          setAiAnalysis(fullAiAnalysis);
          setRecommendations(initialData.recommendations || []);

          // Keep active leg if possible? Or reset?
          // Usually keeping active leg is better for UX when toggling
        }
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      console.log('[App] handleRouteSubmit params:', { s, d, dateToUse, timeToUse, rtToUse, returnDateToUse, returnTimeToUse });

      // Pass isRoundTrip to API (assuming getRoute is updated or accepts extra params)
      // Pass isRoundTrip to API (assuming getRoute is updated or accepts extra params)
      const response = await getRoute(s, d, sCoords, dCoords, dateToUse, timeToUse, rtToUse, prefToUse as 'fastest' | 'scenic', returnDateToUse, returnTimeToUse);
      if (response) {
        setTripData(response);

        // Check if it's strictly a round trip response or fallback
        const isRTResponse = response.isRoundTrip;

        // FIX: Respect current active leg when reloading data
        // If we are currently on 'return' leg and we have return data, show that.
        // Otherwise default to outbound.
        const useReturnData = activeLeg === 'return' && isRTResponse && response.return;
        const initialData = useReturnData ? response.return : response.outbound;

        // If Round Trip, extract return Data too
        if (isRTResponse && response.return) {
          setReturnWeatherData(response.return.weather || []);
        } else {
          setReturnWeatherData([]);
        }

        // Validate we have route data
        if (initialData && initialData.route) {
          setRoute(initialData.route);
          if (initialData.metrics) setMetrics(initialData.metrics);
          setWeatherData(initialData.weather || []);
          setRoadConditions(initialData.roadConditions || []);

          const fullAiAnalysis = {
            ...initialData.aiAnalysis,
            tripScore: initialData.tripScore,
            departureInsights: initialData.departureInsights
          };
          setAiAnalysis(fullAiAnalysis);
          setRecommendations(initialData.recommendations || []);

          // Only reset to outbound if we are changing locations or switching to One-Way
          // This preserves the 'return' view when just toggling preferences/dates on a Round Trip
          if (!isRTResponse || s !== start || d !== destination) {
            setActiveLeg('outbound');
          }
          // If we decided to use return data above, ensure active leg is set to return (it should already be, but safe to enforce)
          if (useReturnData) {
            setActiveLeg('return');
          }

          setViewMode('trip');
        } else {
          console.error("Route API returned success but no route data found.");
          setError("Could not calculate a route. Please try different locations.");
        }
      } else {
        console.error("Route API returned success but no route data found.");
        setError("Could not calculate a route. Please try different locations.");
      }
    } catch (error: any) {
      console.error("Route calculation error:", error);
      if (error.response && error.response.status === 422) {
        setError("Could not find one of those locations. Please check for typos.");
      } else {
        setError(`Failed to calculate route: ${error.message || 'Unknown error'} `);
      }
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
            <div className="relative z-[410] grid grid-cols-2 md:flex md:items-center gap-2 pointer-events-auto w-full px-2 sm:px-0">
              {/* Brand / Logo */}
              <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl p-2 shadow-lg flex items-center gap-3 order-1 md:order-1 col-span-1 mr-auto md:mr-0">
                <div className="bg-[#40513B] p-0 rounded-full shadow-md border border-white/5 backdrop-blur-sm overflow-hidden w-12 h-12 flex items-center justify-center shrink-0">
                  <img src="/logo.svg" alt="Wayvue Logo" className="w-[85%] h-[85%] object-contain" />
                </div>
                <div className="block pr-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold tracking-tight leading-none text-foreground hidden sm:block">Wayvue</h1>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium hidden sm:block">Trip Intelligence</p>
                </div>
              </div>

              {/* Inputs Bar */}
              <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl p-2 sm:p-2 shadow-lg flex flex-col items-stretch gap-3 h-auto transition-all duration-300 ease-in-out relative order-3 md:order-2 col-span-2 w-full md:flex-1 md:max-w-5xl md:mx-auto">
                {/* Error Message Toast/Banner */}
                {error && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-[500]">
                    <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 text-center border border-destructive/50">
                      {error}
                    </div>
                  </div>
                )}

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



                {/* Secondary Row: Date/Time (Collapsible on Mobile could be nice, or just compact side-by-side) */}
                {/* For now, keeping them visible but compact side-by-side on mobile to avoid extra clicks, but styled cleaner */}
                {/* Secondary Row: Dates & Actions Consolidated */}
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 border-t border-border/50 pt-2 xl:pt-0">

                  {/* Left: Date Pickers */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CombinedDateTimePicker
                      dateValue={departureDate}
                      onDateChange={setDepartureDate}
                      timeValue={departureTime}
                      onTimeChange={setDepartureTime}
                      minDate={new Date().toISOString().split('T')[0]}
                      maxDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    />

                    {/* Return Date/Time (Always Visible) */}
                    <div
                      className={`transition-all duration-300 relative ${!isRoundTrip ? 'opacity-60 grayscale hover:opacity-80' : 'opacity-100'} `}
                      onClick={() => {
                        if (!isRoundTrip) setIsRoundTrip(true);
                      }}
                    >
                      {!isRoundTrip && (
                        <div className="absolute inset-0 z-20 cursor-pointer" title="Click to Add Return" />
                      )}

                      <CombinedDateTimePicker
                        dateValue={returnDate}
                        onDateChange={(val) => {
                          setReturnDate(val);
                          if (!isRoundTrip) setIsRoundTrip(true);
                        }}
                        timeValue={returnTime}
                        onTimeChange={(val) => {
                          setReturnTime(val);
                          if (!isRoundTrip) setIsRoundTrip(true);
                        }}
                        minDate={departureDate}
                        maxDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                        label={isRoundTrip ? "Return" : "Add Return"}
                      />
                    </div>
                  </div>

                  {/* Divider (Desktop) */}
                  <div className="w-px h-8 bg-border hidden xl:block mx-1" />

                  {/* Right: Actions (Trip Type, Prefs, Go) */}
                  <div className="flex items-center gap-2 justify-end">

                    {/* Trip Type Toggle (Compact) */}
                    <div
                      onClick={() => setIsRoundTrip(!isRoundTrip)}
                      className={`
                            cursor-pointer flex items-center justify-center h-9 px-3 rounded-lg border transition-all select-none
                            ${isRoundTrip
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
                          : 'bg-card border-border text-muted-foreground hover:bg-secondary/50'}
                        `}
                      title="Toggle Round Trip"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 transition-transform ${isRoundTrip ? 'rotate-180' : ''}`} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        {isRoundTrip ? 'Round Trip' : 'One Way'}
                      </span>
                    </div>

                    {/* Route Preference (Icons) */}
                    <div className="flex bg-card border border-border rounded-lg p-0.5 h-9">
                      <button
                        onClick={() => { setOutboundPref('fastest'); setReturnPref('fastest'); }}
                        title="Fastest Route"
                        className={`px-3 rounded-md flex items-center justify-center transition-all ${outboundPref === 'fastest' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setOutboundPref('scenic'); setReturnPref('scenic'); }}
                        title="Scenic Route"
                        className={`px-3 rounded-md flex items-center justify-center transition-all ${outboundPref === 'scenic' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <Button
                      onClick={() => handleRouteSubmit()}
                      disabled={loading}
                      className="h-9 px-6 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-bold tracking-wide transition-all hover:scale-105 active:scale-95"
                    >
                      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : <Navigation className="w-3.5 h-3.5 mr-2" />}
                      <span>{loading ? 'Planning...' : 'Go'}</span>
                    </Button>
                  </div>
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
      isLoading={loading}
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
      onSearch={async (newStart, newEnd, newDepDate, newDepTime, newStartCoords, newEndCoords, newRT, newPref, newReturnDate, newReturnTime) => {
        // Update state first ONLY if values are provided
        if (newStart) setStart(newStart);
        if (newEnd) setDestination(newEnd);
        if (newStartCoords) setStartCoords(newStartCoords);
        if (newEndCoords) setDestCoords(newEndCoords);
        if (newDepDate) setDepartureDate(newDepDate);
        if (newDepTime) setDepartureTime(newDepTime);

        // Trigger route calc with new values directly to ensure latest data is used
        await handleRouteSubmit(
          newStart,
          newEnd,
          newDepDate,
          newDepTime,
          newStartCoords,
          newEndCoords,
          newRT,
          newPref,
          newReturnDate,
          newReturnTime
        );
      }}
      onSegmentSelect={(lat, lng) => setSelectedLocation({ lat, lng })}

      activeLeg={activeLeg}
      hasReturn={!!(tripData && (tripData.return || tripData.isRoundTrip))}
      routePreference={routePreference}
      onLegChange={switchLeg}
      returnDate={
        (() => {
          if (!tripData?.isRoundTrip || !returnDate) return undefined;
          const ret = new Date(returnDate);
          // Adjust for timezone offset to prevent date shifting if string is UTC-like
          const userTimezoneOffset = ret.getTimezoneOffset() * 60000;
          const adjustedDate = new Date(ret.getTime() + userTimezoneOffset);
          return adjustedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        })()
      }

      map={
        <MapComponent
          routeGeoJSON={tripData?.outbound?.route || route}
          returnRouteGeoJSON={tripData?.return?.route} // Pass return route
          weatherData={weatherData}
          returnWeatherData={returnWeatherData} // Pass return weather
          unit={unit}
          selectedLocation={selectedLocation}
          activeLeg={activeLeg}
          alternativeRouteGeoJSON={(() => {
            // Calculate alternative route for display (Gray line)
            if (tripData?.variants) {
              const currentPref = activeLeg === 'return' ? returnPref : outboundPref;
              const altPref = currentPref === 'fastest' ? 'scenic' : 'fastest';
              const altVariant = tripData.variants[altPref];
              const isReturn = activeLeg === 'return';
              // If return leg, get return route, else outbound
              return isReturn ? altVariant?.return?.route : altVariant?.outbound?.route;
            }
            return null;
          })()}
        />
      }
    />
  );
}
