const axios = require('axios');

/**
 * Helper: Fetch with retry and exponential backoff
 */
const fetchWithRetry = async (url, retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.get(url, { timeout: 5000 });
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
    }
};

/**
 * Fetches current weather for a specific coordinate.
 */
const getWeather = async (lat, lng) => {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=precipitation_probability,wind_direction_10m&forecast_days=1`;
        const response = await fetchWithRetry(url);
        const current = response.data.current;
        const hourly = response.data.hourly;

        // simple: grab the first hour for now (closest to current time)
        // In a real app, we'd match the ETA time, but for now current hour is a good proxy for "departure time"
        const currentHourIndex = new Date().getHours();
        const precipProb = hourly.precipitation_probability ? hourly.precipitation_probability[currentHourIndex] : 0;
        const windDir = hourly.wind_direction_10m ? hourly.wind_direction_10m[currentHourIndex] : 0;

        return {
            temperature: current.temperature_2m,
            weathercode: current.weather_code,
            windSpeed: current.wind_speed_10m,
            humidity: current.relative_humidity_2m,
            precipitationProbability: precipProb,
            windDirection: windDir
        };
    } catch (error) {
        console.error(`Weather fetch failed for ${lat},${lng}:`, error.message);
        return null;
    }
};

/**
 * Batch fetches weather for multiple points.
 * Note: Open-Meteo is free but rate limited. Be careful with concurrency.
 */
const getWeatherForPoints = async (points) => {
    // Limit to reasonable number to avoid spamming
    const limitedPoints = points.slice(0, 50);
    const results = [];

    // Process in chunks to avoid rate limits
    const CHUNK_SIZE = 5;
    for (let i = 0; i < limitedPoints.length; i += CHUNK_SIZE) {
        const chunk = limitedPoints.slice(i, i + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (point) => {
            const [lat, lng] = point;
            const weather = await getWeather(lat, lng);
            return { lat, lng, weather };
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);

        // Small delay between chunks
        if (i + CHUNK_SIZE < limitedPoints.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return results;
};

module.exports = { getWeather, getWeatherForPoints };
