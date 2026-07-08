import React from 'react';
import { Thermometer, Sun, Cloud, CloudRain, Snowflake, Wind, Umbrella, AlertTriangle, CheckCircle, Fuel } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, ZoomControl, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import type { FeatureCollection, Geometry } from 'geojson';
import { AnalyticsService } from '../services/analytics';

// Fix for default Leaflet markers in Vite/Webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface WeatherPoint {
    lat: number;
    lng: number;
    temperature: number;
    weathercode: number;
    location: string;
    humidity?: number;
    windSpeed?: number;
    precipitationProbability?: number;
    gasPrice?: string;
}

// Map WMO codes to text
const getWeatherDescription = (code: number) => {
    const codes: { [key: number]: string } = {
        0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing Rime Fog',
        51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
        61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
        71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
        80: 'Slight Showers', 81: 'Moderate Showers', 82: 'Violent Showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Heavy Thunderstorm'
    };
    return codes[code] || 'Unknown';
};

interface TrafficIncident {
    id: string;
    type: 'accident' | 'closure' | 'construction' | 'jam' | 'hazard';
    severity?: number;
    description: string;
    location?: { lat: number; lng: number } | null;
    from?: string | null;
    to?: string | null;
}

interface MapComponentProps {
    routeGeoJSON?: FeatureCollection | Geometry | null;
    returnRouteGeoJSON?: FeatureCollection | Geometry | null; // New prop for return route
    weatherData?: WeatherPoint[];
    returnWeatherData?: WeatherPoint[]; // New prop
    incidents?: TrafficIncident[]; // Traffic incidents (accidents, closures, construction)
    waypoints?: { name: string; lat?: number; lng?: number }[]; // Multi-stop waypoint markers
    unit: 'C' | 'F';
    selectedLocation?: { lat: number; lng: number } | null;
    activeLeg?: 'outbound' | 'return'; // New prop
    alternativeRouteGeoJSON?: FeatureCollection | Geometry | null; // New prop for alternative route display
    routeColor?: string; // (Deprecating single routeColor in favor of fixed Blue/Orange, but keeping for now)
    activeTab?: string; // Results-page tab — emphasize the relevant marker layer
}

const MapComponent: React.FC<MapComponentProps> = ({ routeGeoJSON, returnRouteGeoJSON, weatherData, returnWeatherData, incidents, waypoints, unit, selectedLocation, activeLeg = 'outbound', alternativeRouteGeoJSON, activeTab }) => {
    // Map ↔ tab sync: weather is the default layer — visible on every tab EXCEPT Road,
    // where incident markers take over to avoid clutter. Incidents show on overview/road.
    const showWeatherLayer = activeTab !== 'road';
    const showIncidentLayer = !activeTab || activeTab === 'overview' || activeTab === 'road';
    // Default: San Francisco
    const defaultCenter: LatLngExpression = [37.7749, -122.4194];

    // Helper to extract coords
    const extractCoords = (geoJSON: any): LatLngExpression[] | null => {
        if (!geoJSON) return null;
        if (geoJSON.type === 'LineString' && geoJSON.coordinates) {
            return geoJSON.coordinates.map((coord: any) => [coord[1], coord[0]] as LatLngExpression);
        }
        if (geoJSON.type === 'FeatureCollection' && geoJSON.features) {
            if (geoJSON.features.length > 0 && geoJSON.features[0].geometry.type === 'LineString') {
                const coords = geoJSON.features[0].geometry.coordinates;
                return coords.map((coord: any) => [coord[1], coord[0]] as LatLngExpression);
            }
        }
        return null;
    };

    const routePositions = React.useMemo(() => extractCoords(routeGeoJSON), [routeGeoJSON]);
    const returnRoutePositions = React.useMemo(() => extractCoords(returnRouteGeoJSON), [returnRouteGeoJSON]);

    // Use passed color or default blue
    // const primaryColor = routeColor || "#3b82f6"; // Deprecated, using strict colors now

    // Helper component to auto-zoom to route
    const RecenterAutomatically = ({ latLngs }: { latLngs: LatLngExpression[] }) => {
        const map = useMap();
        React.useEffect(() => {
            if (latLngs.length > 0) {
                map.fitBounds(L.latLngBounds(latLngs as L.LatLngTuple[]), { padding: [50, 50] });
            }
        }, [latLngs, map]);
        return null;
    };

    // Helper to fly to selected location
    const FlyToLocation = ({ location }: { location: { lat: number; lng: number } }) => {
        const map = useMap();
        React.useEffect(() => {
            if (location) {
                map.flyTo([location.lat, location.lng], 13, {
                    animate: true,
                    duration: 1.5
                });
            }
        }, [location, map]);
        return null;
    };

    // Tracker for Map Interactions (Heatmap)
    const MapTracker = () => {
        const map = useMap();
        React.useEffect(() => {
            const handleMoveEnd = () => {
                const center = map.getCenter();
                const zoom = map.getZoom();
                // Simple debounce/throttle could be added here if needed, 
                // but for now we'll just log unique moves
                AnalyticsService.logEvent('map_interaction', {
                    lat: center.lat,
                    lng: center.lng,
                    zoom: zoom,
                    type: 'move_end'
                });
            };

            map.on('moveend', handleMoveEnd);
            return () => {
                map.off('moveend', handleMoveEnd);
            };
        }, [map]);
        return null;
    };

    // Helper to create custom "Pill" icon
    const createWeatherIcon = (tempC: number) => {
        const hasTemp = tempC !== undefined && tempC !== null;
        const tempDisplay = unit === 'F' ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);

        // Intuitive temperature scale on the cool palette: cold→blue, mild→cyan, hot→amber
        let bgColor = '#22D3EE'; // Mild (cyan)
        if (tempC < 10) bgColor = '#3B7BFF'; // Cold (blue)
        if (tempC > 25) bgColor = '#FBBF24'; // Hot (amber)

        return L.divIcon({
            className: 'custom-weather-icon',
            html: `<div style="
                background-color: ${bgColor}; 
                color: #ffffff; 
                padding: 6px 14px; 
                border-radius: 12px; 
                font-weight: 800; 
                font-size: 15px; 
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
                border: 2px solid #ffffff;
                display: flex; 
                align-items: center; 
                justify-content: center; 
                min-width: 52px;
                white-space: nowrap;
                transform: translate(-50%, -50%);
                font-family: ui-sans-serif, system-ui, sans-serif;
            ">
                ${hasTemp ? tempDisplay + '°' : 'N/A'}
            </div>`,
            iconSize: [52, 32],
            iconAnchor: [26, 16]
        });
    };

    // Incident marker styling per type
    const INCIDENT_STYLE: Record<string, { color: string; emoji: string; label: string }> = {
        accident: { color: '#ef4444', emoji: '🚨', label: 'Accident' },
        closure: { color: '#b91c1c', emoji: '⛔', label: 'Road Closure' },
        construction: { color: '#f59e0b', emoji: '🚧', label: 'Construction' },
        jam: { color: '#f97316', emoji: '🚗', label: 'Traffic Jam' },
        hazard: { color: '#eab308', emoji: '⚠️', label: 'Hazard' }
    };

    const createWaypointIcon = (label: string) => {
        return L.divIcon({
            className: 'custom-waypoint-icon',
            html: `<div style="
                background-color: #E86A2A;
                color: #E7ECF5;
                width: 24px;
                height: 24px;
                border-radius: 50% 50% 50% 0;
                transform: translate(-50%, -100%) rotate(-45deg);
                border: 2px solid #ffffff;
                box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 800;
                font-size: 11px;
            "><span style="transform: rotate(45deg);">${label}</span></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        });
    };

    const createIncidentIcon = (type: string) => {
        const style = INCIDENT_STYLE[type] || INCIDENT_STYLE.hazard;
        return L.divIcon({
            className: 'custom-incident-icon',
            html: `<div style="
                background-color: ${style.color};
                width: 26px;
                height: 26px;
                border-radius: 50%;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                transform: translate(-50%, -50%);
            ">${style.emoji}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });
    };

    // Infer road condition from weather code
    const getRoadCondition = (code: number) => {
        // Snow/Ice
        if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Icy / Snowy';
        // Rain/Thunder
        if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return 'Wet / Slippery';
        // Fog
        if ([45, 48].includes(code)) return 'Low Visibility';
        // Default
        return 'Dry';
    };

    // Legend Component
    const MapLegend = () => (
        <div className="absolute bottom-8 left-4 z-[400] bg-card/95 backdrop-blur-xl border border-border p-4 rounded-2xl shadow-2xl flex flex-col gap-3 pointer-events-auto min-w-[140px] animate-in slide-in-from-bottom-4 fade-in duration-700">
            <div className="flex items-center gap-2 mb-1 border-b border-border pb-2">
                <Thermometer className="w-3 h-3 text-primary" />
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-foreground">Temperature</h4>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-4 h-4 bg-[#3B7BFF]/20 rounded-full blur-[2px] z-0"></div>
                    <div className="w-2 h-2 rounded-full bg-[#3B7BFF] shadow-[0_0_8px_rgba(59,123,255,0.8)] z-10 relative"></div>
                </div>
                <span className="text-xs font-medium text-foreground">Cold</span>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">{unit === 'F' ? '< 50°' : '< 10°'}</span>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-4 h-4 bg-[#22D3EE]/20 rounded-full blur-[2px] z-0"></div>
                    <div className="w-2 h-2 rounded-full bg-[#22D3EE] shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10 relative"></div>
                </div>
                <span className="text-xs font-medium text-foreground">Mild</span>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">{unit === 'F' ? '50–77°' : '10–25°'}</span>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-4 h-4 bg-[#FBBF24]/20 rounded-full blur-[2px] z-0"></div>
                    <div className="w-2 h-2 rounded-full bg-[#FBBF24] shadow-[0_0_8px_rgba(251,191,36,0.8)] z-10 relative"></div>
                </div>
                <span className="text-xs font-medium text-foreground">Hot</span>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">{unit === 'F' ? '> 77°' : '> 25°'}</span>
            </div>
        </div>
    );

    // Layer Visibility State (Read-only for now, toggle function was unused)
    const [layers] = React.useState({
        weather: true,
        traffic: true,
        segments: true
    });


    // --- CAR ANIMATION HELPERS ---



    // --- CSS ANIMATION STYLES ---
    // Injected styles for the flowing dash animation
    const animationStyles = `
        @keyframes flow-animation {
            0% { stroke-dashoffset: 200; }
            100% { stroke-dashoffset: 0; }
        }
        .flowing-dash-blue {
            stroke-dasharray: 10 20;
            animation: flow-animation 3s linear infinite;
        }
        .flowing-dash-orange {
            stroke-dasharray: 10 20;
            animation: flow-animation 3s linear infinite;
        }
    `;

    return (
        <div className="h-full w-full relative z-0">
            <style>{animationStyles}</style>
            {/* Layer Control Overlay */}


            <MapContainer
                center={defaultCenter}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <ZoomControl position="bottomright" />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Route Layers */}
                {/* Alternative Route (Gray/Background) */}
                {alternativeRouteGeoJSON && (
                    <GeoJSON
                        key={`alt-${JSON.stringify(alternativeRouteGeoJSON)}`} // Force re-render on change
                        data={alternativeRouteGeoJSON as any}
                        style={{
                            color: '#64748b', // Slate-500 (Grayish)
                            weight: 4,
                            opacity: 0.5,
                            dashArray: '10, 10', // Dashed line to indicate alternative
                            lineCap: 'round',
                            lineJoin: 'round'
                        }}
                    />
                )}

                {/* Outbound Route (Blue) - Only if activeLeg is outbound */}
                {activeLeg === 'outbound' && routePositions && (
                    <>
                        <Polyline
                            key={`main-route-outbound-${routePositions.length}-${routePositions[0]}`}
                            positions={routePositions}
                            color="#E86A2A"
                            weight={6}
                            opacity={0.6}
                            lineCap="round"
                            lineJoin="round"
                        />
                        {/* Flowing Dash Overlay */}
                        <Polyline
                            positions={routePositions}
                            color="#ffffff"
                            weight={4}
                            opacity={0.7}
                            className="flowing-dash-blue"
                            lineCap="round"
                            lineJoin="round"
                        />
                    </>
                )}

                {/* Return Route (Orange) - Only if activeLeg is return */}
                {activeLeg === 'return' && returnRoutePositions && (
                    <>
                        <Polyline
                            key={`main-route-return-${returnRoutePositions.length}-${returnRoutePositions[0]}`}
                            positions={returnRoutePositions}
                            color="#0D9488"
                            weight={6}
                            opacity={0.6}
                            lineCap="round"
                            lineJoin="round"
                        />
                        {/* Flowing Dash Overlay */}
                        <Polyline
                            positions={returnRoutePositions}
                            color="#ffffff"
                            weight={4}
                            opacity={0.7}
                            className="flowing-dash-orange"
                            lineCap="round"
                            lineJoin="round"
                        />
                    </>
                )}

                {/* Auto Recenter on ACTIVE LEG only */}
                <RecenterAutomatically latLngs={activeLeg === 'outbound' ? (routePositions || []) : (returnRoutePositions || [])} />

                <MapTracker />

                {selectedLocation && <FlyToLocation location={selectedLocation} />}

                {/* Weather Markers (Outbound) - Only if activeLeg is outbound */}
                {
                    showWeatherLayer && layers.weather && activeLeg === 'outbound' && weatherData && weatherData.filter((_, idx) => {
                        // Always show first and last
                        if (idx === 0 || idx === weatherData.length - 1) return true;
                        // Calculate dynamic stride to keep total under 15
                        const stride = Math.ceil(weatherData.length / 15);
                        return idx % stride === 0;
                    }).map((point, idx) => {
                        const tempC = point.temperature;
                        const hasTemp = tempC !== undefined && tempC !== null;

                        // Earthy Palette Mapping
                        const tempDisplay = unit === 'F' ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);
                        const weatherDesc = getWeatherDescription(point.weathercode || 0);
                        const roadCond = getRoadCondition(point.weathercode || 0);

                        return point ? (
                            <Marker
                                key={`weather-${idx}`}
                                position={[point.lat, point.lng]}
                                icon={createWeatherIcon(tempC as any)}
                                eventHandlers={{
                                    click: () => AnalyticsService.trackClick('weather_marker_click', {
                                        location: point.location,
                                        condition: weatherDesc,
                                        temp: tempC,
                                        leg: 'outbound'
                                    })
                                }}
                            >
                                <Popup className="custom-popup-overrides">
                                    <div className="flex flex-col min-w-[180px] font-sans bg-card/95 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-soft-lg p-0 transition-all">
                                        {/* Glass Header */}
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/60">
                                            <div className="flex items-center gap-1.5">
                                                {/* Dynamic Icon based on code */}
                                                {point.weathercode <= 2 ? <Sun className="w-3.5 h-3.5 text-amber-400" /> :
                                                    point.weathercode <= 48 ? <Cloud className="w-3.5 h-3.5 text-gray-400" /> :
                                                        point.weathercode <= 67 ? <CloudRain className="w-3.5 h-3.5 text-blue-400" /> :
                                                            point.weathercode <= 77 ? <Snowflake className="w-3.5 h-3.5 text-cyan-200" /> :
                                                                <Cloud className="w-3.5 h-3.5 text-gray-400" />}
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground leading-none mt-0.5">
                                                    {weatherDesc}
                                                </span>
                                            </div>
                                            {/* Status Dot */}
                                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor] ${(tempC || 0) < 10 ? 'bg-[#3B7BFF] text-[#3B7BFF]' :
                                                (tempC || 0) > 25 ? 'bg-[#FBBF24] text-[#FBBF24]' :
                                                    'bg-[#22D3EE] text-[#22D3EE]'
                                                }`} />
                                        </div>

                                        {/* Content Body */}
                                        <div className="p-3 flex flex-col gap-3">
                                            {/* Temperature Display */}
                                            <div className="flex items-center justify-center gap-0.5 mt-1">
                                                <span className="font-thin text-[3.5rem] tracking-tighter text-foreground leading-none">
                                                    {hasTemp ? tempDisplay : '--'}
                                                </span>
                                                <span className="text-lg font-light text-muted-foreground mb-4 self-end">
                                                    °{unit}
                                                </span>
                                            </div>

                                            {/* Wind & Rain Grid */}
                                            <div className="grid grid-cols-2 gap-2 w-full">
                                                <div className="flex flex-col items-center p-1.5 rounded-lg bg-secondary/70 border border-border">
                                                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                                        <Wind className="w-2.5 h-2.5" />
                                                        <span className="text-[9px] uppercase font-bold tracking-wider">Wind</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-foreground">
                                                        {Math.round(point.windSpeed || 0)} <span className="text-[9px] font-normal opacity-70">km/h</span>
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-center p-1.5 rounded-lg bg-secondary/70 border border-border">
                                                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                                        <Umbrella className="w-2.5 h-2.5" />
                                                        <span className="text-[9px] uppercase font-bold tracking-wider">Rain</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-foreground">
                                                        {point.precipitationProbability || 0}<span className="text-[9px] font-normal opacity-70">%</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Prices Grid (Gas Only) */}
                                            <div className="w-full mt-2 pt-2 border-t border-border flex justify-center">
                                                <div className="flex items-center gap-1.5 p-1 px-3 rounded-lg bg-secondary/70 border border-border">
                                                    <Fuel className="w-3 h-3 text-orange-400" />
                                                    <span className="text-[10px] font-bold text-foreground">${point.gasPrice || '--'}</span>
                                                </div>
                                            </div>

                                            {/* Road Condition Tag */}
                                            <div className="flex justify-center">
                                                <div className={`
                                                flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest shadow-lg
                                                ${roadCond === 'Dry' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200 shadow-emerald-900/20' :
                                                        roadCond === 'Icy / Snowy' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-200 shadow-cyan-900/20' :
                                                            'bg-amber-500/20 border-amber-500/30 text-amber-200 shadow-amber-900/20'}
                                            `}>
                                                    {roadCond === 'Dry' ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                                                    {roadCond}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ) : null;
                    })
                }

                {/* Return Weather Markers (Only if activeLeg is return) */}
                {
                    showWeatherLayer && layers.weather && activeLeg === 'return' && returnWeatherData && returnWeatherData.filter((_, idx) => {
                        if (idx === 0 || idx === returnWeatherData.length - 1) return true;
                        const stride = Math.ceil(returnWeatherData.length / 15);
                        return idx % stride === 0;
                    }).map((point, idx) => {
                        const tempC = point.temperature;
                        const hasTemp = tempC !== undefined && tempC !== null;
                        const tempDisplay = unit === 'F' ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);
                        const weatherDesc = getWeatherDescription(point.weathercode || 0);
                        const roadCond = getRoadCondition(point.weathercode || 0);

                        return point ? (
                            <Marker
                                key={`return-weather-${idx}`}
                                position={[point.lat, point.lng]}
                                icon={createWeatherIcon(tempC as any)}
                                eventHandlers={{
                                    click: () => AnalyticsService.trackClick('weather_marker_click', {
                                        location: point.location,
                                        condition: weatherDesc,
                                        temp: tempC,
                                        leg: 'return'
                                    })
                                }}
                            >
                                <Popup className="custom-popup-overrides">
                                    <div className="flex flex-col min-w-[180px] font-sans bg-card/95 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-soft-lg p-0 transition-all">
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/60">
                                            <div className="flex items-center gap-1.5">
                                                {point.weathercode <= 2 ? <Sun className="w-3.5 h-3.5 text-amber-400" /> :
                                                    point.weathercode <= 48 ? <Cloud className="w-3.5 h-3.5 text-gray-400" /> :
                                                        point.weathercode <= 67 ? <CloudRain className="w-3.5 h-3.5 text-blue-400" /> :
                                                            point.weathercode <= 77 ? <Snowflake className="w-3.5 h-3.5 text-cyan-200" /> :
                                                                <Cloud className="w-3.5 h-3.5 text-gray-400" />}
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground leading-none mt-0.5">
                                                    {weatherDesc}
                                                </span>
                                            </div>
                                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor] ${(tempC || 0) < 10 ? 'bg-[#3B7BFF] text-[#3B7BFF]' :
                                                (tempC || 0) > 25 ? 'bg-[#FBBF24] text-[#FBBF24]' :
                                                    'bg-[#22D3EE] text-[#22D3EE]'
                                                }`} />
                                        </div>
                                        <div className="p-3 flex flex-col gap-3">
                                            <div className="flex items-center justify-center gap-0.5 mt-1">
                                                <span className="font-thin text-[3.5rem] tracking-tighter text-foreground leading-none">
                                                    {hasTemp ? tempDisplay : '--'}
                                                </span>
                                                <span className="text-lg font-light text-muted-foreground mb-4 self-end">
                                                    °{unit}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 w-full">
                                                <div className="flex flex-col items-center p-1.5 rounded-lg bg-secondary/70 border border-border">
                                                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                                        <Wind className="w-2.5 h-2.5" />
                                                        <span className="text-[9px] uppercase font-bold tracking-wider">Wind</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-foreground">
                                                        {Math.round(point.windSpeed || 0)} <span className="text-[9px] font-normal opacity-70">km/h</span>
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-center p-1.5 rounded-lg bg-secondary/70 border border-border">
                                                    <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                                        <Umbrella className="w-2.5 h-2.5" />
                                                        <span className="text-[9px] uppercase font-bold tracking-wider">Rain</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-foreground">
                                                        {point.precipitationProbability || 0}<span className="text-[9px] font-normal opacity-70">%</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-center">
                                                <div className={`
                                                flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest shadow-lg
                                                ${roadCond === 'Dry' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200 shadow-emerald-900/20' :
                                                        roadCond === 'Icy / Snowy' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-200 shadow-cyan-900/20' :
                                                            'bg-amber-500/20 border-amber-500/30 text-amber-200 shadow-amber-900/20'}
                                            `}>
                                                    {roadCond === 'Dry' ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                                                    {roadCond}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ) : null;
                    })
                }

                {/* Waypoint Markers (multi-stop) */}
                {
                    waypoints && waypoints.filter(w => w.lat && w.lng).map((wp, idx) => (
                        <Marker
                            key={`waypoint-${idx}`}
                            position={[wp.lat as number, wp.lng as number]}
                            icon={createWaypointIcon(String(idx + 1))}
                        >
                            <Popup className="custom-popup-overrides">
                                <div className="px-3 py-2 font-sans bg-card/95 backdrop-blur-xl border border-border rounded-2xl text-foreground text-xs">
                                    <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Stop {idx + 1}</span>
                                    <p className="text-foreground/80 mt-1 max-w-[200px]">{wp.name}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))
                }

                {/* Traffic Incident Markers (accidents, closures, construction, jams) */}
                {
                    showIncidentLayer && layers.traffic && incidents && incidents.map((inc, idx) => {
                        if (!inc.location) return null;
                        const style = INCIDENT_STYLE[inc.type] || INCIDENT_STYLE.hazard;
                        return (
                            <Marker
                                key={`incident-${inc.id || idx}`}
                                position={[inc.location.lat, inc.location.lng]}
                                icon={createIncidentIcon(inc.type)}
                                eventHandlers={{
                                    click: () => AnalyticsService.trackClick('incident_marker_click', {
                                        type: inc.type,
                                        leg: activeLeg
                                    })
                                }}
                            >
                                <Popup className="custom-popup-overrides">
                                    <div className="flex flex-col min-w-[180px] max-w-[240px] font-sans bg-card/95 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-soft-lg">
                                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border" style={{ background: `${style.color}22` }}>
                                            <span style={{ fontSize: '14px' }}>{style.emoji}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
                                                {style.label}
                                            </span>
                                        </div>
                                        <div className="p-3">
                                            <p className="text-xs text-foreground/80 leading-snug">{inc.description}</p>
                                            {(inc.from || inc.to) && (
                                                <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                                                    {inc.from}{inc.to ? ` → ${inc.to}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })
                }
            </MapContainer>

            {/* Add Legend Overlay */}
            <MapLegend />
        </div>
    );
};

export default MapComponent;
