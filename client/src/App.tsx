import { useState } from 'react';
import { Map as MapIcon, RefreshCw, Navigation, Clock, Fuel, AlertTriangle, ArrowRight } from 'lucide-react';
import MapComponent from './components/MapComponent';
import { getRoute } from './services/api';

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
  const [metrics, setMetrics] = useState({ distance: "0 mi", time: "0 min", fuel: "0 gal" });
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('F');

  // Selection State for Interaction
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);

  const handleRouteSubmit = async () => {
    if (!start || !destination) return;
    setLoading(true);
    try {
      const response = await getRoute(start, destination, startCoords, destCoords);

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
              <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl p-2 shadow-lg flex items-center gap-3 h-14">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                  <MapIcon className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block pr-2">
                  <h1 className="text-lg font-bold tracking-tight leading-none">Wayvue</h1>
                  <p className="text-[10px] text-muted-foreground font-medium">Weather Intel</p>
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
                <Button
                  onClick={handleRouteSubmit}
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
          {/* AI Summary Section */}
          <div className="p-4 border-b border-border bg-gradient-to-b from-card to-background">
            <WayvueAISummary analysis={aiAnalysis} />
          </div>

          {/* Scrollable Road Conditions Panel */}
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
              {/* Placeholder if no route */}
              {roadConditions.length === 0 && !loading && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-50">
                  <Navigation className="w-12 h-12 mb-4 opacity-50" />
                  <p className="font-medium">Enter a route to view segment details</p>
                </div>
              )}

              <RoadConditionCard
                conditions={roadConditions}
                onSegmentSelect={handleSegmentSelect}
              />
            </div>
          </div>
        </div>

      </div>

      {/* --- BOTTOM SECTION: FORECAST & SUGGESTED STOPS --- */}
      {/* Full Width Footer - Expands to end of browser window */}
      {weatherData.length > 0 && (
        <div className="bg-card/95 backdrop-blur-xl border-t border-border p-4 z-[600] shadow-[0_-4px_25px_rgba(0,0,0,0.3)] shrink-0">
          <div className="flex flex-col lg:flex-row gap-6 h-full items-stretch">
            {/* Forecast Timeline */}
            <div className="flex flex-col gap-2 min-w-0 lg:w-[45%]">
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

            {/* Vertical Divider for Large screens */}
            <div className="hidden lg:block w-px bg-border/50 self-stretch my-1" />

            {/* Suggested Stops */}
            <div className="flex-1 min-w-0">
              <PlacesRecommendations places={recommendations} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
