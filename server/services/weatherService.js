const axios = require('axios');

/**
 * Fetches current weather for a specific coordinate.
 */
const getWeather = async (lat, lng) => {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
        const response = await axios.get(url);
        return response.data.current_weather;
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
    // Limit to reasonable number to avoid spamming (Open-Meteo allows lots, but let's be safe)
    // If dynamic sampling in index.js works, this shouldn't be massive.
    const limitedPoints = points.slice(0, 50); // Increased cap just in case

    const promises = limitedPoints.map(async (point) => {
        const [lat, lng] = point;
        const weather = await getWeather(lat, lng);
        return {
            lat,
            lng,
            weather
        };
    });

    return Promise.all(promises);
};

module.exports = { getWeather, getWeatherForPoints };
