import { useState } from 'react';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import { getRoute } from './services/api';
import type { FeatureCollection, Geometry } from 'geojson';

function App() {
  const [routeGeoJSON, setRouteGeoJSON] = useState<FeatureCollection | Geometry | null>(null);
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('F'); // Default to F for US context

  const handleRouteSubmit = async (start: string, end: string) => {
    if (!start || !end) return;

    try {
      setLoading(true);
      console.log(`Fetching route from ${start} to ${end}...`);
      const data = await getRoute(start, end);
      console.log('Route data received:', data);

      if (data.route) {
        setRouteGeoJSON(data.route);
      }
      if (data.weather) {
        setWeatherData(data.weather);
      }
    } catch (error) {
      console.error('Failed to fetch route:', error);
      alert('Failed to find route. Please ensure the server is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App relative h-screen w-screen overflow-hidden">
      <Sidebar
        onRouteSubmit={handleRouteSubmit}
      />

      {/* Floating Unit Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-xl shadow-lg p-1.5 flex items-center gap-1 border border-gray-100">
        <button
          onClick={() => setUnit('C')}
          style={{
            backgroundColor: unit === 'C' ? '#40513B' : 'transparent',
            color: unit === 'C' ? '#E5D9B6' : '#6b7280'
          }}
          className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
        >
          °C
        </button>
        <button
          onClick={() => setUnit('F')}
          style={{
            backgroundColor: unit === 'F' ? '#40513B' : 'transparent',
            color: unit === 'F' ? '#E5D9B6' : '#6b7280'
          }}
          className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
        >
          °F
        </button>
      </div>

      {loading && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 z-50">
          <div className="h-full bg-blue-600 animate-pulse w-full"></div>
        </div>
      )}

      <MapComponent
        routeGeoJSON={routeGeoJSON}
        weatherData={weatherData}
        unit={unit}
      />
    </div>
  );
}

export default App;
