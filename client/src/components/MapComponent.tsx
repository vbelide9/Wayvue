import React from 'react';
import { Thermometer, Sun, Cloud, CloudRain, Snowflake, Wind, Umbrella, AlertTriangle, CheckCircle, Fuel } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import {
    Map,
    MapMarker,
    MarkerContent,
    MarkerPopup,
    MapControls,
    MapRoute,
    useMap,
} from '@/components/ui/map';
import type { FeatureCollection, Geometry } from 'geojson';
import { AnalyticsService } from '../services/analytics';

// OpenFreeMap for the light basemap: free, no key, no usage caps.
// CARTO dark-matter kept as the dark fallback (app currently renders light-only).
const MAP_STYLES = {
    light: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

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

// Infer road condition from weather code
const getRoadCondition = (code: number) => {
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Icy / Snowy';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return 'Wet / Slippery';
    if ([45, 48].includes(code)) return 'Low Visibility';
    return 'Dry';
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

// Incident marker styling per type
const INCIDENT_STYLE: Record<string, { color: string; emoji: string; label: string }> = {
    accident: { color: '#ef4444', emoji: '🚨', label: 'Accident' },
    closure: { color: '#b91c1c', emoji: '⛔', label: 'Road Closure' },
    construction: { color: '#f59e0b', emoji: '🚧', label: 'Construction' },
    jam: { color: '#f97316', emoji: '🚗', label: 'Traffic Jam' },
    hazard: { color: '#eab308', emoji: '⚠️', label: 'Hazard' }
};

interface MapComponentProps {
    routeGeoJSON?: FeatureCollection | Geometry | null;
    returnRouteGeoJSON?: FeatureCollection | Geometry | null;
    weatherData?: WeatherPoint[];
    returnWeatherData?: WeatherPoint[];
    incidents?: TrafficIncident[];
    waypoints?: { name: string; lat?: number; lng?: number }[];
    unit: 'C' | 'F';
    selectedLocation?: { lat: number; lng: number } | null;
    activeLeg?: 'outbound' | 'return';
    alternativeRouteGeoJSON?: FeatureCollection | Geometry | null;
    routeColor?: string;
    activeTab?: string; // Results-page tab — emphasize the relevant marker layer
    rightInset?: number; // Extra right padding for fitBounds so the route clears an overlay panel
}

type LngLat = [number, number];

// Extract a [lng, lat] coordinate list from a LineString-bearing GeoJSON.
// (MapLibre uses lng-first order — the reverse of Leaflet.)
const extractCoords = (geoJSON: any): LngLat[] | null => {
    if (!geoJSON) return null;
    if (geoJSON.type === 'LineString' && geoJSON.coordinates) {
        return geoJSON.coordinates.map((c: any) => [c[0], c[1]] as LngLat);
    }
    if (geoJSON.type === 'FeatureCollection' && geoJSON.features?.length > 0
        && geoJSON.features[0].geometry.type === 'LineString') {
        return geoJSON.features[0].geometry.coordinates.map((c: any) => [c[0], c[1]] as LngLat);
    }
    return null;
};

// ── In-map helper components (need the map instance via useMap) ──

// Auto-zoom to the active route. `rightInset` reserves space on the right so the
// route isn't hidden behind the overlay insights panel.
function FitBounds({ coordinates, rightInset = 0 }: { coordinates: LngLat[]; rightInset?: number }) {
    const { map, isLoaded } = useMap();
    React.useEffect(() => {
        if (!map || !isLoaded || coordinates.length === 0) return;
        const bounds = coordinates.reduce(
            (b, c) => b.extend(c),
            new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
        );
        map.fitBounds(bounds, {
            padding: { top: 60, bottom: 60, left: 60, right: 60 + rightInset },
            duration: 800,
        });
    }, [map, isLoaded, coordinates, rightInset]);
    return null;
}

// Fly to a location selected from the road-conditions list
function FlyToLocation({ location }: { location: { lat: number; lng: number } }) {
    const { map } = useMap();
    React.useEffect(() => {
        if (!map || !location) return;
        map.flyTo({ center: [location.lng, location.lat], zoom: 13, duration: 1500 });
    }, [map, location]);
    return null;
}

// Analytics for map interactions (heatmap)
function MoveTracker() {
    const { map } = useMap();
    React.useEffect(() => {
        if (!map) return;
        const handleMoveEnd = () => {
            const center = map.getCenter();
            AnalyticsService.logEvent('map_interaction', {
                lat: center.lat,
                lng: center.lng,
                zoom: map.getZoom(),
                type: 'move_end'
            });
        };
        map.on('moveend', handleMoveEnd);
        return () => { map.off('moveend', handleMoveEnd); };
    }, [map]);
    return null;
}

// "Ant path" dash animation over the active route — MapLibre has no dash-offset,
// so we cycle through phase-shifted dasharray patterns (the documented technique).
const DASH_SEQUENCE: number[][] = [
    [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5],
    [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2],
    [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

function FlowingDash({ id, coordinates }: { id: string; coordinates: LngLat[] }) {
    const { map, isLoaded } = useMap();
    React.useEffect(() => {
        if (!map || !isLoaded || coordinates.length === 0) return;
        const sourceId = `flow-source-${id}`;
        const layerId = `flow-layer-${id}`;

        map.addSource(sourceId, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
        });
        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': '#ffffff',
                'line-width': 3,
                'line-opacity': 0.85,
                'line-dasharray': DASH_SEQUENCE[0],
            },
        });

        let frame = 0;
        let raf = 0;
        let last = 0;
        let stopped = false;
        const reduced = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const tick = (t: number) => {
            if (stopped) return;
            if (t - last > 80) {
                last = t;
                frame = (frame + 1) % DASH_SEQUENCE.length;
                try {
                    if (map.getLayer(layerId)) {
                        map.setPaintProperty(layerId, 'line-dasharray', DASH_SEQUENCE[frame]);
                    }
                } catch {
                    // Map instance was torn down mid-animation-frame (e.g. navigating
                    // away) — stop quietly instead of throwing past React's control.
                    stopped = true;
                    return;
                }
            }
            raf = requestAnimationFrame(tick);
        };
        if (!reduced) raf = requestAnimationFrame(tick);

        return () => {
            stopped = true;
            cancelAnimationFrame(raf);
            try {
                if (map.getLayer(layerId)) map.removeLayer(layerId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
            } catch {
                // Already removed along with the map instance — nothing to clean up.
            }
        };
    }, [map, isLoaded, id, coordinates]);
    return null;
}

// ── Marker + popup content ──

// Temperature pill — cold→blue, mild→cyan, hot→amber (semantic weather colors)
const tempColor = (tempC: number) => {
    if (tempC < 10) return '#3B7BFF';
    if (tempC > 25) return '#FBBF24';
    return '#22D3EE';
};

function WeatherPill({ tempC, unit }: { tempC: number; unit: 'C' | 'F' }) {
    const hasTemp = tempC !== undefined && tempC !== null;
    const tempDisplay = unit === 'F' ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);
    return (
        <div
            className="flex items-center justify-center min-w-[44px] px-2.5 py-1 rounded-lg font-extrabold text-[13px] text-white border-2 border-white shadow-[0_3px_10px_rgba(0,0,0,0.15)] whitespace-nowrap"
            style={{ backgroundColor: tempColor(tempC) }}
        >
            {hasTemp ? `${tempDisplay}°` : 'N/A'}
        </div>
    );
}

function WeatherPopupContent({ point, unit }: { point: WeatherPoint; unit: 'C' | 'F' }) {
    const tempC = point.temperature;
    const hasTemp = tempC !== undefined && tempC !== null;
    const tempDisplay = unit === 'F' ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);
    const weatherDesc = getWeatherDescription(point.weathercode || 0);
    const roadCond = getRoadCondition(point.weathercode || 0);

    return (
        <div className="flex flex-col min-w-[180px] font-sans bg-card/95 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-soft-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/60">
                <div className="flex items-center gap-1.5">
                    {point.weathercode <= 2 ? <Sun className="w-3.5 h-3.5 text-amber-500" /> :
                        point.weathercode <= 48 ? <Cloud className="w-3.5 h-3.5 text-gray-400" /> :
                            point.weathercode <= 67 ? <CloudRain className="w-3.5 h-3.5 text-blue-500" /> :
                                point.weathercode <= 77 ? <Snowflake className="w-3.5 h-3.5 text-cyan-500" /> :
                                    <Cloud className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground leading-none mt-0.5">
                        {weatherDesc}
                    </span>
                </div>
                <div
                    className="w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor]"
                    style={{ backgroundColor: tempColor(tempC || 0), color: tempColor(tempC || 0) }}
                />
            </div>

            {/* Body */}
            <div className="p-3 flex flex-col gap-3">
                <div className="flex items-center justify-center gap-0.5 mt-1">
                    <span className="font-thin text-[3.5rem] tracking-tighter text-foreground leading-none">
                        {hasTemp ? tempDisplay : '--'}
                    </span>
                    <span className="text-lg font-light text-muted-foreground mb-4 self-end">°{unit}</span>
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

                {point.gasPrice && (
                    <div className="w-full mt-2 pt-2 border-t border-border flex justify-center">
                        <div className="flex items-center gap-1.5 p-1 px-3 rounded-lg bg-secondary/70 border border-border">
                            <Fuel className="w-3 h-3 text-orange-500" />
                            <span className="text-[10px] font-bold text-foreground">${point.gasPrice}</span>
                        </div>
                    </div>
                )}

                <div className="flex justify-center">
                    <div className={`
                        flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest
                        ${roadCond === 'Dry' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700' :
                            roadCond === 'Icy / Snowy' ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-700' :
                                'bg-amber-500/15 border-amber-500/30 text-amber-700'}
                    `}>
                        {roadCond === 'Dry' ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        {roadCond}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Down-sample dense weather point lists, always keeping first + last
const sampleWeatherPoints = (points: WeatherPoint[]) =>
    points.filter((_, idx) => {
        if (idx === 0 || idx === points.length - 1) return true;
        const stride = Math.ceil(points.length / 15);
        return idx % stride === 0;
    });

const MapComponent: React.FC<MapComponentProps> = ({ routeGeoJSON, returnRouteGeoJSON, weatherData, returnWeatherData, incidents, waypoints, unit, selectedLocation, activeLeg = 'outbound', alternativeRouteGeoJSON, activeTab, rightInset = 0 }) => {
    // Map ↔ tab sync: weather is the default layer — visible on every tab EXCEPT Road,
    // where incident markers take over to avoid clutter. Incidents show on overview/road.
    const showWeatherLayer = activeTab !== 'road';
    const showIncidentLayer = !activeTab || activeTab === 'overview' || activeTab === 'road';

    const routePositions = React.useMemo(() => extractCoords(routeGeoJSON), [routeGeoJSON]);
    const returnRoutePositions = React.useMemo(() => extractCoords(returnRouteGeoJSON), [returnRouteGeoJSON]);
    const altRoutePositions = React.useMemo(() => extractCoords(alternativeRouteGeoJSON), [alternativeRouteGeoJSON]);

    const activePositions = React.useMemo(
        () => (activeLeg === 'outbound' ? routePositions : returnRoutePositions) || [],
        [activeLeg, routePositions, returnRoutePositions]
    );

    const activeWeather = React.useMemo(() => {
        const data = activeLeg === 'outbound' ? weatherData : returnWeatherData;
        return data && data.length > 0 ? sampleWeatherPoints(data) : [];
    }, [activeLeg, weatherData, returnWeatherData]);

    // Legend overlay
    const MapLegend = () => (
        <div className="absolute bottom-8 left-4 z-[400] bg-card/95 backdrop-blur-xl border border-border p-4 rounded-2xl shadow-2xl flex flex-col gap-3 pointer-events-auto min-w-[140px] animate-in slide-in-from-bottom-4 fade-in duration-700">
            <div className="flex items-center gap-2 mb-1 border-b border-border pb-2">
                <Thermometer className="w-3 h-3 text-primary" />
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-foreground">Temperature</h4>
            </div>
            {[
                { color: '#3B7BFF', label: 'Cold', range: unit === 'F' ? '< 50°' : '< 10°' },
                { color: '#22D3EE', label: 'Mild', range: unit === 'F' ? '50–77°' : '10–25°' },
                { color: '#FBBF24', label: 'Hot', range: unit === 'F' ? '> 77°' : '> 25°' },
            ].map(({ color, label, range }) => (
                <div key={label} className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-4 h-4 rounded-full blur-[2px] z-0 opacity-20" style={{ backgroundColor: color }} />
                        <div className="w-2 h-2 rounded-full z-10 relative" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                    </div>
                    <span className="text-xs font-medium text-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto font-mono">{range}</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className="h-full w-full relative z-0">
            <Map
                className="h-full w-full"
                theme="light"
                styles={MAP_STYLES}
                center={[-122.4194, 37.7749]}
                zoom={10}
            >
                <MapControls position="bottom-right" showZoom />

                {/* Alternative route (light dashed line, behind the active route) */}
                {altRoutePositions && (
                    <MapRoute
                        id="alt-route"
                        coordinates={altRoutePositions}
                        color="#64748b"
                        width={5}
                        opacity={0.65}
                        dashArray={[2, 2]}
                        interactive={false}
                    />
                )}

                {/* Active leg route + flowing dash overlay */}
                {activeLeg === 'outbound' && routePositions && (
                    <>
                        <MapRoute id="route-outbound" coordinates={routePositions} color="#E86A2A" width={6} opacity={0.75} interactive={false} />
                        <FlowingDash id="outbound" coordinates={routePositions} />
                    </>
                )}
                {activeLeg === 'return' && returnRoutePositions && (
                    <>
                        <MapRoute id="route-return" coordinates={returnRoutePositions} color="#0D9488" width={6} opacity={0.75} interactive={false} />
                        <FlowingDash id="return" coordinates={returnRoutePositions} />
                    </>
                )}

                <FitBounds coordinates={activePositions} rightInset={rightInset} />
                <MoveTracker />
                {selectedLocation && <FlyToLocation location={selectedLocation} />}

                {/* Weather markers for the active leg */}
                {showWeatherLayer && activeWeather.map((point, idx) => (
                    <MapMarker
                        key={`weather-${activeLeg}-${idx}`}
                        longitude={point.lng}
                        latitude={point.lat}
                        onClick={() => AnalyticsService.trackClick('weather_marker_click', {
                            location: point.location,
                            condition: getWeatherDescription(point.weathercode || 0),
                            temp: point.temperature,
                            leg: activeLeg
                        })}
                    >
                        <MarkerContent>
                            <WeatherPill tempC={point.temperature} unit={unit} />
                        </MarkerContent>
                        <MarkerPopup className="p-0 bg-transparent border-none shadow-none">
                            <WeatherPopupContent point={point} unit={unit} />
                        </MarkerPopup>
                    </MapMarker>
                ))}

                {/* Waypoint markers (multi-stop) */}
                {waypoints && waypoints.filter(w => w.lat && w.lng).map((wp, idx) => (
                    <MapMarker
                        key={`waypoint-${idx}`}
                        longitude={wp.lng as number}
                        latitude={wp.lat as number}
                        anchor="bottom"
                    >
                        <MarkerContent>
                            <div
                                className="w-6 h-6 flex items-center justify-center text-white font-extrabold text-[11px] border-2 border-white shadow-[0_3px_8px_rgba(0,0,0,0.4)]"
                                style={{ backgroundColor: '#E86A2A', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }}
                            >
                                <span style={{ transform: 'rotate(45deg)' }}>{idx + 1}</span>
                            </div>
                        </MarkerContent>
                        <MarkerPopup className="p-0 bg-transparent border-none shadow-none">
                            <div className="px-3 py-2 font-sans bg-card/95 backdrop-blur-xl border border-border rounded-2xl text-foreground text-xs">
                                <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Stop {idx + 1}</span>
                                <p className="text-foreground/80 mt-1 max-w-[200px]">{wp.name}</p>
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                ))}

                {/* Traffic incident markers (accidents, closures, construction, jams) */}
                {showIncidentLayer && incidents && incidents.map((inc, idx) => {
                    if (!inc.location) return null;
                    const style = INCIDENT_STYLE[inc.type] || INCIDENT_STYLE.hazard;
                    return (
                        <MapMarker
                            key={`incident-${inc.id || idx}`}
                            longitude={inc.location.lng}
                            latitude={inc.location.lat}
                            onClick={() => AnalyticsService.trackClick('incident_marker_click', {
                                type: inc.type,
                                leg: activeLeg
                            })}
                        >
                            <MarkerContent>
                                <div
                                    className="w-[26px] h-[26px] rounded-full border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center text-[13px]"
                                    style={{ backgroundColor: style.color }}
                                >
                                    {style.emoji}
                                </div>
                            </MarkerContent>
                            <MarkerPopup className="p-0 bg-transparent border-none shadow-none">
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
                            </MarkerPopup>
                        </MapMarker>
                    );
                })}
            </Map>

            <MapLegend />
        </div>
    );
};

export default MapComponent;
