// API Service
import axios from 'axios';

import { AnalyticsService } from './analytics';

const API_URL = '/api'; // Relative path matching Vite proxy

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getRoute = async (
    start: string,
    end: string,
    startCoords?: { lat: number; lng: number },
    endCoords?: { lat: number; lng: number },
    departureDate?: string,
    departureTime?: string,
    roundTrip?: boolean,
    preference?: 'fastest' | 'scenic',
    returnDate?: string,
    returnTime?: string
) => {
    console.log(`[API] Fetching route from ${start} to ${end}...`);
    const startTime = performance.now();
    try {
        const payload = { start, end, startCoords, endCoords, departureDate, departureTime, roundTrip, preference, returnDate, returnTime };
        const response = await api.post('/route', payload);
        const endTime = performance.now();
        AnalyticsService.trackPerformance('api_latency', endTime - startTime, { endpoint: '/route' });
        console.log('[API] Route data received:', response.data);
        return response.data;
    } catch (error: any) {
        const endTime = performance.now();
        AnalyticsService.trackPerformance('api_latency', endTime - startTime, { endpoint: '/route', error: true });
        AnalyticsService.trackError('search_error', error.message || 'Unknown API Error');
        console.error('[API] Error fetching route:', error);
        throw error;
    }
};

export const getPlaceDetails = async (lat: number, lon: number) => {
    const response = await api.post('/place-details', { lat, lon });
    return response.data;
};
// End of file
