import React from 'react';
import { MapContainer, TileLayer, Polyline, ZoomControl, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import type { FeatureCollection, LineString, Geometry } from 'geojson';

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

interface MapComponentProps {
    routeGeoJSON?: FeatureCollection | Geometry | null;
    weatherData?: WeatherPoint[];
    unit: 'C' | 'F';
    selectedLocation?: { lat: number; lng: number } | null;
}

const MapComponent: React.FC<MapComponentProps> = ({ routeGeoJSON, weatherData, unit, selectedLocation }) => {
    // Default: San Francisco
    const defaultCenter: LatLngExpression = [37.7749, -122.4194];

    // Extract coordinates from GeoJSON if available for polyline
    const routePositions: LatLngExpression[] | null = React.useMemo(() => {
        if (!routeGeoJSON) return null;

        // Handle GeoJSON Geometry direct (e.g. LineString from OSRM/Backend)
        if (routeGeoJSON.type === 'LineString' && (routeGeoJSON as LineString).coordinates) {
            const coords = (routeGeoJSON as LineString).coordinates;
            // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
            return coords.map((coord: any) => [coord[1], coord[0]] as LatLngExpression);
        }

        // Handle FeatureCollection (Standard GeoJSON)
        if (routeGeoJSON.type === 'FeatureCollection' && (routeGeoJSON as FeatureCollection).features) {
            const features = (routeGeoJSON as FeatureCollection).features;
            if (features.length > 0 && features[0].geometry.type === 'LineString') {
                const coords = (features[0].geometry as LineString).coordinates;
                return coords.map((coord: any) => [coord[1], coord[0]] as LatLngExpression);
            }
        }

        return null;
    }, [routeGeoJSON]);

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

    // Helper to create custom "Pill" icon
    const createWeatherIcon = (tempC: number) => {
        const hasTemp = tempC !== undefined && tempC !== null;
        const tempDisplay = unit === 'F' ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);

        // Inline colors to ensure no Tailwind issues
        // Earthy Palette
        let bgColor = '#628141'; // Mild
        if (tempC < 10) bgColor = '#40513B'; // Cold
        if (tempC > 25) bgColor = '#E67E22'; // Hot

        return L.divIcon({
            className: 'custom-weather-icon',
            html: `<div style="
                background-color: ${bgColor}; 
                color: #E5D9B6; 
                padding: 6px 14px; 
                border-radius: 12px; 
                font-weight: 800; 
                font-size: 15px; 
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
                border: 2px solid #E5D9B6;
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

    return (
        <div className="h-full w-full relative z-0">
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

                {routePositions && (
                    <>
                        <Polyline
                            positions={routePositions}
                            color="#3b82f6"
                            weight={5}
                            opacity={0.75}
                        />
                        <RecenterAutomatically latLngs={routePositions} />
                    </>
                )}

                {selectedLocation && <FlyToLocation location={selectedLocation} />}

                {weatherData && weatherData.map((point, idx) => {
                    const tempC = point.temperature;
                    const hasTemp = tempC !== undefined && tempC !== null;

                    // Earthy Palette Mapping
                    let bgColor = '#628141';
                    if (tempC < 10) bgColor = '#40513B';
                    if (tempC > 25) bgColor = '#E67E22';

                    const tempDisplay = unit === 'F' ? Math.round((tempC * 9 / 5) + 32) : Math.round(tempC);
                    const weatherDesc = getWeatherDescription(point.weathercode || 0);
                    const roadCond = getRoadCondition(point.weathercode || 0);

                    return point ? (
                        <Marker
                            key={idx}
                            position={[point.lat, point.lng]}
                            icon={createWeatherIcon(tempC as any)}
                        >
                            <Popup className="custom-popup-overrides">
                                <div className="flex flex-col min-w-[160px] font-sans">
                                    {/* Colored Header: CONDITION */}
                                    <div
                                        style={{ backgroundColor: bgColor }}
                                        className="text-[#E5D9B6] px-4 py-3 text-center relative overflow-hidden flex items-center justify-center min-h-[50px]"
                                    >
                                        <div className="relative z-10">
                                            <p className="font-bold text-lg uppercase tracking-wider leading-tight">
                                                {weatherDesc}
                                            </p>
                                        </div>
                                        {/* Subtle decorative circle */}
                                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-white opacity-10 rounded-full blur-xl"></div>
                                    </div>

                                    {/* Content Body: TEMP & ROAD */}
                                    <div
                                        style={{ backgroundColor: '#E5D9B6' }}
                                        className="p-4 text-center flex flex-col gap-2"
                                    >
                                        {/* Big Temp */}
                                        <div className="flex items-center justify-center gap-1 text-[#40513B]">
                                            <span className="font-extrabold text-5xl tracking-tighter">
                                                {hasTemp ? tempDisplay + '°' : 'N/A'}
                                            </span>
                                            <span className="text-xl font-bold uppercase opacity-60 mt-2">
                                                {unit}
                                            </span>
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px bg-[#40513B] opacity-10 w-full my-1"></div>

                                        {/* Road Condition */}
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] uppercase tracking-widest font-bold text-[#40513B] opacity-60">
                                                Road Conditions
                                            </span>
                                            <span className="font-bold text-[#40513B] text-sm mt-0.5">
                                                {roadCond}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ) : null;
                })}
            </MapContainer>
        </div>
    );
};

export default MapComponent;
