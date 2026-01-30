import axios from 'axios';

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
