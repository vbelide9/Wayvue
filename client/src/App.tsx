import { useState, useEffect } from 'react';
import { Map as MapIcon, RefreshCw } from 'lucide-react';
import MapComponent from './components/MapComponent';
import { getRoute } from './services/api';
import type { FeatureCollection, Geometry } from 'geojson';

// UI Components
import { Button } from '@/components/ui/button';
import { LocationInput } from '@/components/LocationInput';
import { RouteSummary } from '@/components/RouteSummary';
import { WeatherCard } from '@/components/WeatherCard';
import { RoadConditionCard, type RoadCondition } from '@/components/RoadConditionCard';

function App() {
  // State
  const [start, setStart] = useState("");
  const [destination, setDestination] = useState("");
  const [routeGeoJSON, setRouteGeoJSON] = useState<FeatureCollection | Geometry | null>(null);
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('F');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Derived State for UI
  const [roadConditions, setRoadConditions] = useState<RoadCondition[]>([]);
  const [metrics, setMetrics] = useState({ distance: "0 mi", time: "0 min", fuel: "0 gal" });

  const handleRouteSubmit = async () => {
    if (!start || !destination) return;
    setLoading(true);
    try {
      const data = await getRoute(start, destination);

      if (data.route) {
        setRouteGeoJSON(data.route);
        // Calculate metrics
        const miles = (data.distance * 0.000621371);
        const hours = Math.floor(data.duration / 3600);
        const mins = Math.floor((data.duration % 3600) / 60);
        setMetrics({
          distance: `${miles.toFixed(1)} mi`,
          time: `${hours > 0 ? hours + 'h ' : ''}${mins}min`,
          fuel: `${(miles / 25).toFixed(1)} gal` // approx 25mpg
        });
      }

      if (data.weather) {
        setWeatherData(data.weather);
        // Generate road conditions based on real weather data
        // Segmenting the route into chunks
        const conditions: RoadCondition[] = [];
        const segments = Math.min(4, data.weather.length); // Max 4 segments

        // Simple mock generator using real weather to influence status
        for (let i = 0; i < segments; i++) {
          const w = data.weather[Math.floor(i * (data.weather.length / segments))];
          let status: "good" | "moderate" | "poor" = "good";
          let desc = "Clear roads, normal traffic flow";

          // Infer status from weather code
          const code = w.weather?.weathercode || 0;
          if ([71, 73, 75, 85, 86].includes(code)) { status = "poor"; desc = "Heavy snow/ice detected."; }
          else if ([51, 61, 63, 80, 81].includes(code)) { status = "moderate"; desc = "Rainy conditions, possible slowing."; }

          conditions.push({
            segment: i === 0 ? "Start Area" : (i === segments - 1 ? "Destination Area" : `Segment ${i + 1}`),
            status,
            description: desc,
            distance: `${(matchMiles(metrics.distance) / segments).toFixed(0)} mi`,
            estimatedTime: "..."
          });
        }
        setRoadConditions(conditions);
      }
      setLastUpdated(new Date());

    } catch (error) {
      console.error(error);
      alert('Failed to get route');
    } finally {
      setLoading(false);
    }
  };

  const matchMiles = (str: string) => parseFloat(str.replace(' mi', '')) || 0;

  return (
    <main className="min-h-screen bg-background text-foreground font-sans flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 flex-none">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-lg">
              <MapIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Wayvue</h1>
              <p className="text-xs text-muted-foreground font-medium">Weather & Road Conditions</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block font-mono">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRouteSubmit}
              disabled={!start || !destination || loading}
              className="gap-2 bg-transparent border-primary/30 text-primary hover:bg-primary/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh Route</span>
            </Button>

            {/* Unit Toggle */}
            <div className="flex bg-card border border-border rounded-md p-1">
              <button onClick={() => setUnit('C')} className={`px-2 py-0.5 text-xs font-bold rounded ${unit === 'C' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>°C</button>
              <button onClick={() => setUnit('F')} className={`px-2 py-0.5 text-xs font-bold rounded ${unit === 'F' ? 'bg-primary text-white' : 'text-muted-foreground'}`}>°F</button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto h-full flex flex-col">

          {/* Inputs & Search */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 flex-none items-end">
            <div className="md:col-span-5">
              <LocationInput
                label="Starting Point"
                placeholder="Enter city (e.g. New York)"
                value={start}
                onChange={setStart}
                icon="start"
              />
            </div>
            <div className="md:col-span-5">
              <LocationInput
                label="Destination"
                placeholder="Enter city (e.g. Boston)"
                value={destination}
                onChange={setDestination}
                icon="destination"
              />
            </div>
            <div className="md:col-span-2">
              <Button
                onClick={handleRouteSubmit}
                disabled={!start || !destination || loading}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
              >
                {loading ? '...' : 'Calculate'}
              </Button>
            </div>
          </div>

          {/* Stats */}
          {routeGeoJSON && (
            <div className="mb-6 flex-none">
              <RouteSummary
                totalDistance={metrics.distance}
                totalTime={metrics.time}
                fuelEstimate={metrics.fuel}
                alerts={roadConditions.filter(c => c.status !== 'good').length}
                loading={loading}
              />
            </div>
          )}

          {/* Main Content: Map + Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">

            {/* Map Area */}
            <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden flex flex-col relative shadow-2xl">
              <div className="p-3 border-b border-border bg-card/80 backdrop-blur flex justify-between items-center absolute top-0 w-full z-10 pointer-events-none">
                <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm ml-2">
                  <MapIcon className="w-4 h-4 text-primary" />
                  Route Overview
                </h2>
                {/* Legend Overlay */}
                <div className="flex gap-3 text-[10px] bg-black/40 backdrop-blur rounded-full px-3 py-1 mr-2">
                  <span className="flex items-center gap-1 text-white"><div className="w-2 h-2 rounded-full bg-[#628141]"></div>Clear</span>
                  <span className="flex items-center gap-1 text-white"><div className="w-2 h-2 rounded-full bg-[#E67E22]"></div>Hot/Warn</span>
                  <span className="flex items-center gap-1 text-white"><div className="w-2 h-2 rounded-full bg-[#40513B]"></div>Cold</span>
                </div>
              </div>

              <div className="flex-1 relative z-0">
                {/* Actual Leaflet Map */}
                <MapComponent
                  routeGeoJSON={routeGeoJSON}
                  weatherData={weatherData}
                  unit={unit}
                />
              </div>
            </div>

            {/* Info Sidebar */}
            <div className="space-y-4 overflow-y-auto pr-1">
              {!routeGeoJSON && (
                <div className="text-center p-10 border-2 border-dashed border-border rounded-xl opacity-50">
                  <p>Enter a route to view details</p>
                </div>
              )}

              {weatherData.length > 0 && (
                <>
                  <WeatherCard
                    unit={unit}
                    weather={{
                      location: start,
                      condition: "clear", // TODO: Map real condition text
                      temperature: weatherData[0]?.weather?.temperature || 0,
                      humidity: weatherData[0]?.weather?.humidity || 0,
                      windSpeed: weatherData[0]?.weather?.windspeed || 0
                    }}
                    type="start"
                  />

                  <RoadConditionCard conditions={roadConditions} />

                  <WeatherCard
                    unit={unit}
                    weather={{
                      location: destination,
                      condition: "cloudy", // TODO: Map real
                      temperature: weatherData[weatherData.length - 1]?.weather?.temperature || 0,
                      humidity: weatherData[weatherData.length - 1]?.weather?.humidity || 0,
                      windSpeed: weatherData[weatherData.length - 1]?.weather?.windspeed || 0
                    }}
                    type="destination"
                  />
                </>
              )}
            </div>
          </div>

          {/* Horizontal Weather Strip */}
          {weatherData.length > 5 && (
            <div className="mt-6 flex-none">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                Forecast Along Route
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-primary/20">
                {weatherData.filter((_, i) => i % Math.ceil(weatherData.length / 6) === 0).slice(1, -1).map((w, i) => (
                  <div key={i} className="min-w-[140px]">
                    <WeatherCard
                      unit={unit}
                      size="compact"
                      weather={{
                        location: `Mile ${(i + 1) * 50}`,
                        condition: "clear",
                        temperature: w.weather?.temperature || 0,
                        windSpeed: w.weather?.windspeed || 0,
                        humidity: w.weather?.humidity || 0
                      }}
                      type="waypoint"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}

export default App;
