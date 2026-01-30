import axios from 'axios';

const API_URL = '/api'; // Relative path matching Vite proxy

export const api = axios.create({
    baseURL: API_URL,
    timeout: 90000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getRoute = async (
    start: string,
    end: string,
    startCoords?: { lat: number, lng: number },
    endCoords?: { lat: number, lng: number }
) => {
    const response = await api.post('/route', { start, end, startCoords, endCoords });
    return response.data;
};

export const getHealth = async () => {
    const response = await api.get('/health');
    return response.data;
};

export const getPlaceDetails = async (lat: number, lon: number) => {
    const response = await api.post('/place-details', { lat, lon });
    return response.data;
};
