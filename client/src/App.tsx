import { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, Navigation, Clock, Fuel, Zap, AlertTriangle, ArrowRight, CloudRain, Brain } from 'lucide-react';
import MapComponent from './components/MapComponent';
import { getRoute } from './services/api';
import { CustomDatePicker, CustomTimePicker } from './components/CustomDateTimePicker';

// UI Components
import { Button } from '@/components/ui/button';
import { LocationInput } from '@/components/LocationInput';
import { WeatherCard } from '@/components/WeatherCard';
import { RoadConditionCard, type RoadCondition } from '@/components/RoadConditionCard';
import { WayvueAISummary } from "@/components/WayvueAISummary"
import { PlacesRecommendations } from "@/components/PlacesRecommendations"

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

  // Resizable Layout State (Bottom Panel)
  const [forecastWidth, setForecastWidth] = useState(45); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize logic for AI Panel (Right Sidebar)
  const [aiPanelHeight, setAiPanelHeight] = useState(320);
  const isSidebarResizing = useRef(false);
  const sidebarContainerRef = useRef<HTMLDivElement>(null);

  // Bottom Panel Resize Handlers
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = ((mouseMoveEvent.clientX - containerRect.left) / containerRect.width) * 100;

        if (newWidth >= 30 && newWidth <= 70) {
          setForecastWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);


  // Right Sidebar Resize Handlers
  const startSidebarResizing = useCallback(() => {
    isSidebarResizing.current = true;
    document.addEventListener('mousemove', handleSidebarResize);
    document.addEventListener('mouseup', stopSidebarResizing);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopSidebarResizing = useCallback(() => {
    isSidebarResizing.current = false;
    document.removeEventListener('mousemove', handleSidebarResize);
    document.removeEventListener('mouseup', stopSidebarResizing);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleSidebarResize = useCallback((e: MouseEvent) => {
    if (!isSidebarResizing.current || !sidebarContainerRef.current) return;
    const sidebarRect = sidebarContainerRef.current.getBoundingClientRect();
    const newHeight = e.clientY - sidebarRect.top;

    // Constraints
    if (newHeight >= 60 && newHeight <= sidebarRect.height - 100) {
      setAiPanelHeight(newHeight);
    }
  }, []);

  // Cleanup Sidebar listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleSidebarResize);
      document.removeEventListener('mouseup', stopSidebarResizing);
    };
  }, [handleSidebarResize, stopSidebarResizing]);

  const handleRouteSubmit = async (startLoc?: string, destLoc?: string, depDate?: string, depTime?: string) => {
    const s = startLoc || start;
    const d = destLoc || destination;
    const dateToUse = depDate || departureDate;
    const timeToUse = depTime || departureTime;
    if (!s || !d) return;

    setLoading(true);
    try {
      const response = await getRoute(s, d, startCoords, destCoords, dateToUse, timeToUse);

      if (response.route) {
        setRoute(response.route);
        if (response.metrics) setMetrics(response.metrics);
        setWeatherData(response.weather || []);
        setRoadConditions(response.roadConditions || []);
        setAiAnalysis(response.aiAnalysis);
        setRecommendations(response.recommendations || []);
      }
    } catch (error: any) {
      console.error(error);
      alert(`Failed to get route: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSegmentSelect = (condition: RoadCondition) => {
    if (condition.location) {
      setSelectedLocation({ lat: condition.location.lat, lng: condition.location.lon });
    }
  };

  return (
    <main className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans">

      {/* --- UPPER SECTION: MAP & SIDEBAR --- */}
      <div className="flex-1 flex overflow-hidden relative z-0">

        {/* LEFT COLUMN: MAP & OVERLAYS (65%) */}
        <div className="flex-1 lg:basis-[65%] flex flex-col relative min-w-0">

          {/* Top Summary Ribbon (Floating) */}
          <div className="absolute top-4 left-4 right-4 z-[400] flex flex-col gap-2 pointer-events-none">
            {/* 1. Dashboard Controls Row */}
            <div className="relative z-[410] flex items-center gap-2 pointer-events-auto">
              {/* Brand / Logo */}
              <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl p-2 shadow-lg flex items-center gap-3">
                <div className="bg-[#40513B] p-0 rounded-full shadow-md border border-white/5 backdrop-blur-sm overflow-hidden w-12 h-12 flex items-center justify-center">
                  <img src="/logo.svg" alt="Wayvue Logo" className="w-[85%] h-[85%] object-contain" />
                </div>
                <div className="hidden sm:block pr-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold tracking-tight leading-none text-foreground">Wayvue</h1>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium">Trip Intelligence</p>
                </div>
              </div>

              {/* Inputs Bar */}
              <div className="flex-1 bg-card/90 backdrop-blur-md border border-border rounded-xl p-1 shadow-lg flex items-center gap-2 h-14">
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
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
                <div className="w-px h-8 bg-border mx-1" />
                <CustomDatePicker
                  value={departureDate}
                  onChange={setDepartureDate}
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                />
                <CustomTimePicker
                  value={departureTime}
                  onChange={setDepartureTime}
                />
                <Button
                  onClick={() => handleRouteSubmit()}
                  disabled={loading}
                  className="h-10 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm ml-1"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  <span className="hidden xl:inline ml-2">Calculate</span>
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

            {/* 2. Route Metrics Ribbon (Only show if route exists) */}
            {route && (
              <div className="relative z-[405] flex items-center gap-2 pointer-events-auto animate-in slide-in-from-top-2 fade-in">
                <div className="flex-1 bg-card/90 backdrop-blur-md border border-border rounded-xl px-4 py-2 shadow-lg flex items-center justify-around gap-4 h-12">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{metrics.distance}</span>
                  </div>
                  <div className="h-4 w-px bg-border"></div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold">{metrics.time}</span>
                  </div>
                  <div className="h-4 w-px bg-border"></div>
                  <div className="flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-bold">{metrics.fuel}</span>
                  </div>
                  <div className="h-4 w-px bg-border"></div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-bold">{metrics.ev}</span>
                  </div>
                  <div className="h-4 w-px bg-border"></div>
                  <div className="flex items-center gap-2">
                    {roadConditions.some(c => c.status !== 'good') ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      </div>
                    )}
                    <span className="text-sm font-bold">
                      {roadConditions.filter(c => c.status !== 'good').length} Alerts
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="flex-1 relative z-0">
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

        {/* RIGHT COLUMN: PERSISTENT SIDEBAR (35%) */}
        {/* Note: This is now a sibling to the Map Column in the upper section */}
        <div className="hidden lg:flex lg:basis-[35%] w-full max-w-md border-l border-border bg-card shadow-2xl z-[500] flex-col h-full">
          {/* Right Panel - Route Details */}
          <div
            ref={sidebarContainerRef}
            className="w-full flex flex-col h-full bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl transition-all duration-300 z-20"
          >
            {/* Wayvue AI Summary */}
            {aiAnalysis ? (
              <div
                style={{ height: aiPanelHeight }}
                className="flex-none z-10 relative shrink-0 min-h-[60px]"
              >
                <WayvueAISummary analysis={aiAnalysis} />

                {/* Resize Handle */}
                <div
                  className="absolute bottom-0 left-0 w-full h-3 translate-y-1.5 cursor-row-resize flex justify-center items-center group z-50 hover:bg-primary/5 active:bg-primary/10 transition-colors"
                  onMouseDown={startSidebarResizing}
                >
                  <div className="w-12 h-1 rounded-full bg-white/20 group-hover:bg-primary/60 transition-colors shadow-sm" />
                </div>
              </div>
            ) : (
              <div className="flex-none z-10">
                <WayvueAISummary analysis={aiAnalysis} />
              </div>
            )}

            {/* Scrollable Road Conditions Panel */}
            {/* Scrollable Road Conditions Panel */}
            <div className="flex-1 overflow-hidden relative pt-2 min-h-0 flex flex-col">
              {/* Placeholder if no route */}
              {roadConditions.length === 0 && !loading && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-50 absolute inset-0 z-0">
                  <div className="bg-[#40513B] p-0 rounded-full shadow-md border border-white/5 backdrop-blur-sm overflow-hidden w-24 h-24 flex items-center justify-center mb-6">
                    <img src="/logo.svg" alt="Wayvue Logo" className="w-[85%] h-[85%] object-contain" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Wayvue</h2>
                  <p className="font-medium mb-8">Enter a route to view segment details</p>

                  {/* Feature Highlights */}
                  <div className="grid grid-cols-3 gap-4 w-full max-w-[90%]">
                    <div className="flex flex-col items-center gap-2 text-center p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <CloudRain className="w-5 h-5 text-sky-300" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Real-time Weather</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <AlertTriangle className="w-5 h-5 text-yellow-300" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Road Conditions</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <Brain className="w-5 h-5 text-fuchsia-300" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">AI Analysis</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative z-10 h-full">
                <RoadConditionCard
                  conditions={roadConditions}
                  onSegmentSelect={handleSegmentSelect}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* --- BOTTOM SECTION: FORECAST & SUGGESTED STOPS --- */}
      {/* Full Width Footer - Expands to end of browser window */}
      {
        weatherData.length > 0 && (
          <div className="bg-card/95 backdrop-blur-xl border-t border-border p-4 z-[600] shadow-[0_-4px_25px_rgba(0,0,0,0.3)] shrink-0">
            <div className="flex flex-col lg:flex-row h-full items-stretch relative" ref={containerRef}>
              {/* Forecast Timeline - Resizable */}
              <div
                className="flex flex-col gap-2 min-w-[300px] shrink-0 transition-[width] duration-0 ease-linear"
                style={{ width: `${forecastWidth}%` }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3 h-3 text-primary" /> Forecast Timeline
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mask-fade-right">
                  {weatherData.filter((_, i) => i % Math.max(1, Math.floor(weatherData.length / 8)) === 0).map((w, i) => (
                    <WeatherCard
                      key={i}
                      variant="chip"
                      unit={unit}
                      weather={w}
                    />
                  ))}
                </div>
              </div>

              {/* Resizable Handle */}
              <div
                className={`hidden lg:flex w-4 -ml-2 -mr-2 z-10 cursor-col-resize items-center justify-center opacity-0 hover:opacity-100 transition-opacitygroup group`}
                onMouseDown={startResizing}
              >
                <div className={`w-1 h-8 rounded-full bg-border group-hover:bg-primary transition-colors ${isResizing ? 'bg-primary' : ''}`}></div>
              </div>

              {/* Vertical Divider (Visual only, behind handle) */}
              <div className="hidden lg:block w-px bg-border/50 self-stretch my-1 mx-2" />

              {/* Suggested Stops - Flexible */}
              <div className="flex-1 min-w-[300px]">
                <PlacesRecommendations places={recommendations} />
              </div>
            </div>
          </div>
        )
      }
    </main>
  );
}
