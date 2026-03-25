import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { RefreshCw, Navigation, ArrowRight, Camera, Zap, Users, Luggage, MapPin, Shield } from 'lucide-react';
import MapComponent from './components/MapComponent';
import { getRoute } from './services/api';
import { CombinedDateTimePicker } from './components/CustomDateTimePicker';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import Lenis from 'lenis';

// UI Components
import { Button } from '@/components/ui/button';
import { LocationInput } from '@/components/LocationInput';
import { WeatherCard } from '@/components/WeatherCard';
import { type RoadCondition } from '@/components/RoadConditionCard';
import { EmptyState } from '@/components/EmptyState';
import { TripViewLayout } from './components/trip-view/TripViewLayout';
import { AnalyticsService } from './services/analytics';
import { CommunityIntel } from './components/CommunityIntel';
import { CustomCursor } from './components/CustomCursor';
import RoadTripCanvas from './components/RoadTripCanvas';

export default function App() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef as any,
    offset: ["start start", "end end"]
  });

  useEffect(() => {
    // Lenis Smooth Scroll Initialization - Godly Feel
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  // State

  const [start, setStart] = useState("New York, NY");
  const [destination, setDestination] = useState("Buffalo, NY");
  const [startCoords, setStartCoords] = useState<{ lat: number, lng: number } | undefined>(undefined);
  const [destCoords, setDestCoords] = useState<{ lat: number, lng: number } | undefined>(undefined);

  // Trip Data State
  const [route, setRoute] = useState<any>(null);
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);
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

  // Track Page View, Performance, Location, and Session
  useEffect(() => {
    AnalyticsService.logEvent('page_view', { path: '/' });
    AnalyticsService.trackUserLocation();
    AnalyticsService.trackSessionStart();
    AnalyticsService.trackDevice();
    AnalyticsService.trackRetention();

    // Measure Load Time
    const handleLoad = () => {
      // Use a recursive check or a slightly longer timeout to ensure loadEventEnd is populated
      let attempts = 0;
      const checkPerf = () => {
        const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const perfData = window.performance.timing;

        let loadTime = 0;
        if (navEntry && navEntry.loadEventEnd > 0) {
          loadTime = navEntry.loadEventEnd;
        } else if (perfData && perfData.loadEventEnd > 0) {
          loadTime = perfData.loadEventEnd - perfData.navigationStart;
        }

        if (loadTime > 0) {
          AnalyticsService.trackPerformance('page_load_time', loadTime);
        } else if (attempts < 5) {
          attempts++;
          setTimeout(checkPerf, 500);
        }
      };

      setTimeout(checkPerf, 500);
    };

    const handleUnload = () => {
      AnalyticsService.trackSessionEnd();
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
    }

    // Handle session end
    window.addEventListener('beforeunload', handleUnload);
    // Also handle visibility change for mobile/background tabs
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        AnalyticsService.trackSessionEnd();
      } else {
        // Optional: You might want to start a new session or just resume
        // For simplicity, we'll just track end on hide. 
        // A more complex app might handle resume vs new session logic.
      }
    });

    return () => {
      window.removeEventListener('load', handleLoad);
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleUnload); // Reuse handleUnload for cleanup
    };
  }, []);

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

    // Track Feature Toggle
    AnalyticsService.trackInteraction('leg_switch', { leg });
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
    const searchStart = Date.now();
    setSearchStartTime(searchStart);

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
    const isSameReturnDate = (returnDateToUse || '') === (returnDate || '');

    const hasTripData = !!tripData;
    const hasVariants = !!(tripData && tripData.variants);
    const canSwitch = hasTripData && hasVariants && overridePreference && isSameLocations && isSameReturnDate;

    console.log('[DEBUG-SWITCH] Cache Check:', {
      canSwitch,
      hasTripData,
      hasVariants,
      overridePreference,
      isSameLocations,
      isSameReturnDate,
      s, start, d, destination,
      returnDateToUse, currentReturnDate: returnDate
    });

    if (canSwitch) {
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
      // FIX: Return variant logic was flawed. 
      // variants.fastest.return contains the return leg for fastest preference.
      const returnVariant = tripData.variants ? tripData.variants[newReturnPref] : undefined;

      const hasReturnVariant = returnVariant && returnVariant.return;
      const isRT = !!rtToUse;

      // Check if we have necessary data
      // For Round Trip: Need outbound AND return variant
      // For One Way: Need outbound
      if (outboundVariant && (!isRT || hasReturnVariant)) {
        console.log('[DEBUG-SWITCH] Constructing cached response', { isRT, newOutboundPref, newReturnPref });

        const cachedResponse = {
          ...tripData,
          isRoundTrip: isRT,
          outbound: outboundVariant.outbound,
          return: hasReturnVariant ? returnVariant.return : null
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

        // Track TTFI for cached switch
        const ttfi = Date.now() - searchStart;
        AnalyticsService.trackPerformance('time_to_first_insight', ttfi, { source: 'cache', preference: overridePreference });
        return;
      }
    }

    // Log Search Event
    console.log('[DEBUG] Logging search_route event:', { start: s, end: d, preference: prefToUse });
    AnalyticsService.logEvent('search_route', {
      start: String(s),
      end: String(d),
      tripType: rtToUse ? 'round_trip' : 'one_way',
      preference: rtToUse ? `out:${outboundPref}, ret:${returnPref}` : outboundPref
    });

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

          // Track TTFI
          if (searchStartTime) {
            const ttfi = Date.now() - searchStartTime;
            AnalyticsService.trackPerformance('time_to_first_insight', ttfi, { source: 'api', preference: prefToUse });
          }

          // [NEW] Track Trip Generation for Community Stats
          // We extract distance from the metrics (e.g. "450 mi") to log accumulated miles
          const distStr = initialData.metrics?.distance || "0";
          const distVal = parseFloat(distStr.replace(/,/g, '').split(' ')[0]);

          if (!isNaN(distVal) && distVal > 0) {
            AnalyticsService.logEvent('trip_generated', {
              start: s,
              end: d,
              distance: distVal,
              preference: prefToUse
            });
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
    <main ref={containerRef} className="relative min-h-screen selection:bg-white selection:text-black bg-void text-white font-sans overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-[800] flex justify-between items-center px-6 md:px-12 py-8 mix-blend-difference text-white">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-serif italic pr-4">Wayvue</motion.div>
        <div className="hidden md:flex gap-12 text-micro opacity-60">
          {["Intelligence", "Fleet", "Concierge"].map(item => <a key={item} href={`#${item.toLowerCase()}`} className="hover:opacity-100 transition-opacity">{item}</a>)}
        </div>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-micro border border-white/20 px-6 py-2 rounded-full hover:bg-white hover:text-black transition-colors shrink-0">Start Planning</button>
      </nav>

      {/* Scrollytelling Canvas Animation */}
      <RoadTripCanvas />

      {/* Search/Trip Intelligence Section */}
      <section id="search" className="relative min-h-screen flex flex-col items-center justify-center bg-[#050505] overflow-hidden py-16">
        
        {/* Loading Overlay */}
        {loading && <div className="absolute inset-0 z-[600]"><LoadingScreen /></div>}

        <div className="relative z-20 text-center px-4 w-full max-w-[1400px]">
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-serif italic mb-6 leading-[0.9] tracking-tight text-shadow-xl drop-shadow-2xl">Trip Intelligence <br/><span className="text-white/40">for the Modern Explorer.</span></h1>
          
          <div className="mt-12 sm:mt-16 w-full max-w-4xl mx-auto backdrop-blur-2xl bg-black/40 border border-white/10 rounded-3xl p-6 shadow-2xl relative group">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            {/* Error Message Toast/Banner */}
            {error && (
              <div className="absolute top-0 left-0 right-0 z-[500] pointer-events-none">
                <div className="bg-destructive/90 backdrop-blur text-white px-4 py-2 text-sm font-medium animate-in fade-in slide-in-from-top-2 text-center rounded-t-3xl border-b border-destructive/50">
                  {error}
                </div>
              </div>
            )}

            {/* Integrating the Existing Search Logic Here */}
            <div className="flex flex-col gap-4 relative z-10 text-left">
              {/* Primary Row: Start -> End */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <LocationInput
                    value={start}
                    onChange={setStart}
                    onSelect={setStartCoords}
                    label="Departure"
                    variant="minimal"
                    placeholder="Where from?"
                    icon="start"
                  />
                </div>
                <div className="hidden sm:flex items-center justify-center text-white/30 shrink-0">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <LocationInput
                    value={destination}
                    onChange={setDestination}
                    onSelect={setDestCoords}
                    label="Destination"
                    variant="minimal"
                    placeholder="Where to?"
                    icon="destination"
                  />
                </div>
              </div>

              {/* Secondary Row: Date/Time & Actions */}
              <div className="flex flex-col lg:flex-row items-center gap-4 border-t border-white/10 pt-4 mt-2">
                <div className="flex items-center gap-4 flex-1 w-full overflow-x-auto no-scrollbar pb-2 lg:pb-0">
                  <CombinedDateTimePicker
                    dateValue={departureDate}
                    onDateChange={setDepartureDate}
                    timeValue={departureTime}
                    onTimeChange={setDepartureTime}
                    minDate={new Date().toISOString().split('T')[0]}
                    maxDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  />

                  <div
                    className={`transition-all duration-300 relative shrink-0 ${!isRoundTrip ? 'opacity-40 hover:opacity-100 cursor-pointer' : 'opacity-100'}`}
                    onClick={() => {
                      if (!isRoundTrip) {
                         setIsRoundTrip(true);
                         AnalyticsService.trackClick('add_return_date');
                      }
                    }}
                  >
                    {!isRoundTrip && <div className="absolute inset-0 z-20" title="Click to Add Return" />}
                    <CombinedDateTimePicker
                      dateValue={returnDate}
                      onDateChange={(val) => { setReturnDate(val); if (!isRoundTrip) setIsRoundTrip(true); }}
                      timeValue={returnTime}
                      onTimeChange={(val) => { setReturnTime(val); if (!isRoundTrip) setIsRoundTrip(true); }}
                      minDate={departureDate}
                      maxDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                      label={isRoundTrip ? "Return" : "Add Return"}
                    />
                  </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0 justify-between lg:justify-end shrink-0">
                  {/* Trip Type Toggle */}
                  <div
                    onClick={() => {
                      const newValue = !isRoundTrip;
                      setIsRoundTrip(newValue);
                      AnalyticsService.trackClick('toggle_trip_type', { value: newValue ? 'round_trip' : 'one_way' });
                    }}
                    className={`cursor-pointer flex items-center justify-center h-12 px-4 rounded-xl border transition-all select-none
                      ${isRoundTrip ? 'bg-white/10 border-white/30 text-white' : 'bg-black/20 border-white/10 text-white/50 hover:bg-white/5'}`}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 transition-transform ${isRoundTrip ? 'rotate-180' : ''}`} />
                    <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                      {isRoundTrip ? 'Round Trip' : 'One Way'}
                    </span>
                  </div>

                  {/* Route Preference */}
                  <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 h-12 shrink-0">
                    <button
                      onClick={() => { setOutboundPref('fastest'); setReturnPref('fastest'); }}
                      className={`px-4 rounded-lg flex items-center justify-center transition-all ${outboundPref === 'fastest' ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white'}`}
                      title="Fastest Route"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setOutboundPref('scenic'); setReturnPref('scenic'); }}
                      className={`px-4 rounded-lg flex items-center justify-center transition-all ${outboundPref === 'scenic' ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white'}`}
                      title="Scenic Route"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  {/* GO Button */}
                  <button
                    onClick={() => handleRouteSubmit()}
                    disabled={loading}
                    className="h-12 px-8 rounded-xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] shrink-0"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Begin Expedition'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values/Features Section */}
      <section id="intelligence" className="py-24 sm:py-32 px-6 md:px-12 lg:px-24 bg-void relative z-20">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-16 lg:gap-24 max-w-[1400px] mx-auto">
          <div className="xl:sticky xl:top-32 h-fit">
            <span className="text-micro opacity-40 mb-6 block">01 — The Engine</span>
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-serif italic mb-8 leading-tight">Radically simplified <br/>concierge.</h2>
            <div className="space-y-6 sm:space-y-8 opacity-60 text-base sm:text-lg font-light">
              <div className="flex items-center gap-6"><Users className="w-6 h-6 shrink-0" /><p>Passenger Dynamics Optimization</p></div>
              <div className="flex items-center gap-6"><Luggage className="w-6 h-6 shrink-0" /><p>Capacity Intelligence Mapping</p></div>
              <div className="flex items-center gap-6"><MapPin className="w-6 h-6 shrink-0" /><p>Terrain-Aware Routing Logic</p></div>
            </div>
          </div>
          
          <div className="flex flex-col gap-8 md:gap-12">
            <motion.div 
               initial={{ opacity: 0, y: 50 }} 
               whileInView={{ opacity: 1, y: 0 }} 
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.8, ease: "easeOut" }}
               className="rounded-3xl overflow-hidden border border-white/10 bg-white/5 p-6 sm:p-8 shadow-2xl backdrop-blur-sm group cursor-default"
            >
               <div className="aspect-[16/9] sm:aspect-[4/3] w-full overflow-hidden rounded-2xl mb-8 relative">
                 <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70" className="w-full h-full object-cover grayscale opacity-80 mix-blend-luminosity group-hover:grayscale-0 group-hover:mix-blend-normal transition-all duration-1000 ease-out group-hover:scale-105" alt="Obsidian SUV" />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
               </div>
               <div className="flex justify-between items-end">
                 <div>
                   <p className="text-micro opacity-50 mb-2">Recommended Fleet</p>
                   <h3 className="text-2xl sm:text-3xl font-serif italic text-white/90">The Obsidian SUV</h3>
                 </div>
                 <div className="text-right">
                   <p className="text-micro opacity-50 mb-2">Match Score</p>
                   <span className="text-3xl sm:text-4xl font-mono font-light tracking-tighter text-white">98%</span>
                 </div>
               </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 50 }} 
               whileInView={{ opacity: 1, y: 0 }} 
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
               className="rounded-3xl overflow-hidden border border-white/10 bg-white/5 p-6 sm:p-8 shadow-2xl backdrop-blur-sm"
            >
               <div className="flex justify-between items-start mb-8 sm:mb-12">
                 <Shield className="w-8 h-8 opacity-40 text-white" />
                 <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center bg-white/5">
                   <span className="text-xs font-mono">AWD</span>
                 </div>
               </div>
               <h3 className="text-2xl font-serif mb-4 text-white/90">Mountain Pass Validated</h3>
               <p className="opacity-50 font-light leading-relaxed text-sm sm:text-base">
                 Our system recognizes your high-elevation waypoints and automatically filters the fleet for All-Wheel Drive vehicles with verified all-weather capabilities, ensuring your absolute safety.
               </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 sm:py-24 px-8 border-t border-white/10 text-center relative z-20 bg-void overflow-hidden flex flex-col items-center">
        <h2 className="text-[15vw] font-serif italic leading-[0.8] opacity-10 hover:opacity-100 transition-opacity duration-1000 select-none cursor-default mix-blend-plus-lighter">Wayvue</h2>
        <p className="mt-8 text-micro opacity-40">© {new Date().getFullYear()} Wayvue Trip Intelligence. All rights reserved.</p>
      </footer>
    </main>
  );

  return (
    <>
      <CustomCursor />
      <AnimatePresence mode="wait">
        {viewMode === 'planning' ? (
          <motion.div
            key="planning-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="h-screen w-full relative"
          >
            {renderPlanningView()}
          </motion.div>
        ) : (
          <motion.div
            key="trip-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="min-h-screen w-full relative bg-[#05050A]"
          >
            <ErrorBoundary>
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
                isRoundTrip={isRoundTrip}
                onSetRoundTrip={(isRT) => {
                  setIsRoundTrip(isRT);
                  if (isRT) {
                    setActiveLeg('return');
                  }
                }}
                routePreference={routePreference}
                onLegChange={switchLeg}
                // Pass Departure Context
                depDate={departureDate}
                depTime={departureTime}
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
                // Pass raw return date string for editing
                rawReturnDate={returnDate}
                rawReturnTime={returnTime}

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
            </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
