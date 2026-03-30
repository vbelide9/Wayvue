import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { FlowHoverButton } from '@/components/ui/flow-hover-button';
import MapComponent from './components/MapComponent';
import { getRoute } from './services/api';

import { LoadingScreen } from './components/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import Lenis from 'lenis';

// UI Components
import { type RoadCondition } from '@/components/RoadConditionCard';

import { TripViewLayout } from './components/trip-view/TripViewLayout';
import { AnalyticsService } from './services/analytics';

import RoadTripCanvas from './components/RoadTripCanvas';
import { PlannerCard } from './components/PlannerCard';

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
  const [viewMode, setViewMode] = useState<'landing' | 'planning' | 'trip'>('landing');

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

  // 1. Landing View (Cinematic Intro)
  const renderLandingView = () => (
    <main ref={containerRef} className="relative w-full h-[350vh] bg-[#050505] text-white selection:bg-white/20">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-[800] flex justify-between items-center px-6 md:px-12 py-8 mix-blend-difference text-white">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-serif italic pr-4">Wayvue</motion.div>

        <motion.div style={{ opacity: useTransform(scrollYProgress, [0, 0.03], [1, 0]), pointerEvents: useTransform(scrollYProgress, [0, 0.03], ["auto", "none"] as any) }}>
          <FlowHoverButton onClick={() => setViewMode('planning')} className="rounded-full">Start Planning</FlowHoverButton>
        </motion.div>
      </nav>

      {/* Scrollytelling Canvas Animation */}
      <RoadTripCanvas />

      {/* Search Section - appears after cinematic scroll */}
      <section className="relative z-[50] flex items-center justify-center min-h-screen px-4 py-24"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 40%, rgba(180, 110, 40, 0.12) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 20% 60%, rgba(40, 80, 50, 0.10) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 30%, rgba(200, 120, 60, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 60% 80%, rgba(30, 60, 45, 0.10) 0%, transparent 60%),
            linear-gradient(180deg, #0a0a08 0%, #0f0e0a 30%, #12100c 60%, #0a0a08 100%)
          `
        }}
      >
        {/* Ambient glow orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Warm golden glow - top center */}
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-amber-600/[0.06] blur-[150px]" />
          {/* Forest green glow - bottom left */}
          <div className="absolute bottom-[15%] left-[5%] w-[500px] h-[400px] rounded-full bg-[#2d4a30]/[0.12] blur-[120px]" />
          {/* Warm rose glow - right */}
          <div className="absolute top-[40%] right-[5%] w-[400px] h-[350px] rounded-full bg-[#8B4513]/[0.06] blur-[100px]" />
          {/* Subtle top edge transition glow */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-amber-900/[0.04] to-transparent" />
        </div>

        {loading && <LoadingScreen />}

        <PlannerCard
          start={start}
          destination={destination}
          onStartChange={setStart}
          onDestinationChange={setDestination}
          onStartSelect={setStartCoords}
          onDestSelect={setDestCoords}
          departureDate={departureDate}
          departureTime={departureTime}
          onDepartureDateChange={setDepartureDate}
          onDepartureTimeChange={setDepartureTime}
          returnDate={returnDate}
          returnTime={returnTime}
          onReturnDateChange={setReturnDate}
          onReturnTimeChange={setReturnTime}
          isRoundTrip={isRoundTrip}
          onRoundTripToggle={() => {
            const newValue = !isRoundTrip;
            setIsRoundTrip(newValue);
            AnalyticsService.trackClick('toggle_trip_type', { value: newValue ? 'round_trip' : 'one_way' });
          }}
          routePreference={outboundPref}
          onPreferenceChange={(pref) => {
            setOutboundPref(pref);
            setReturnPref(pref);
            AnalyticsService.trackClick(`pref_${pref}`);
          }}
          loading={loading}
          onSubmit={() => handleRouteSubmit()}
          error={error}
        />
      </section>
    </main>
  );

  // 2. Planning View (Centered Glassmorphic Search Card)
  const renderPlanningView = () => (
    <main className="relative flex flex-col min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/30 selection:text-white overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[15%] w-[500px] h-[500px] rounded-full bg-[#E67E22]/[0.03] blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] rounded-full bg-emerald-500/[0.03] blur-[100px]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* Loading Screen Overlay */}
      {loading && <LoadingScreen />}

      {/* Top Nav Bar */}
      <nav className="relative z-50 flex justify-between items-center px-6 md:px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#40513B] rounded-full shadow-md border border-white/5 overflow-hidden w-10 h-10 flex items-center justify-center shrink-0">
            <img src="/logo.svg" alt="Wayvue Logo" className="w-[85%] h-[85%] object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none text-white">Wayvue</h1>
            <p className="text-[10px] text-white/40 font-medium">Trip Intelligence</p>
          </div>
        </div>
      </nav>

      {/* Centered Card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16 relative z-10">
        <PlannerCard
          start={start}
          destination={destination}
          onStartChange={setStart}
          onDestinationChange={setDestination}
          onStartSelect={setStartCoords}
          onDestSelect={setDestCoords}
          departureDate={departureDate}
          departureTime={departureTime}
          onDepartureDateChange={setDepartureDate}
          onDepartureTimeChange={setDepartureTime}
          returnDate={returnDate}
          returnTime={returnTime}
          onReturnDateChange={setReturnDate}
          onReturnTimeChange={setReturnTime}
          isRoundTrip={isRoundTrip}
          onRoundTripToggle={() => {
            const newValue = !isRoundTrip;
            setIsRoundTrip(newValue);
            AnalyticsService.trackClick('toggle_trip_type', { value: newValue ? 'round_trip' : 'one_way' });
          }}
          routePreference={outboundPref}
          onPreferenceChange={(pref) => {
            setOutboundPref(pref);
            setReturnPref(pref);
            AnalyticsService.trackClick(`pref_${pref}`);
          }}
          loading={loading}
          onSubmit={() => handleRouteSubmit()}
          error={error}
        />
      </div>
    </main>
  );

  return (
    <>
      <AnimatePresence mode="wait">
        {viewMode === 'landing' ? (
          <motion.div
            key="landing-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="h-screen w-full relative"
          >
            {renderLandingView()}
          </motion.div>
        ) : viewMode === 'planning' ? (
          <motion.div
            key="planning-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="min-h-screen w-full relative bg-[#050505]"
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
