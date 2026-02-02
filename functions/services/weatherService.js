const axios = require('axios');

/**
 * Helper: Fetch with retry and exponential backoff
 */
const fetchWithRetry = async (url, retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.get(url, { timeout: 10000 }); // INCREASED TIMEOUT to 10s
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
    }
};

/**
 * Fetches weather for a specific coordinate and optional date.
 * If date is provided, fetches forecast for that day.
 */
const getWeather = async (lat, lng, dateStr, targetHour, timezone = 'auto') => {
    try {
        let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability,wind_direction_10m&timezone=${timezone}`;

        if (dateStr) {
            // Format YYYY-MM-DD
            const formattedDate = new Date(dateStr).toISOString().split('T')[0];
            url += `&start_date=${formattedDate}&end_date=${formattedDate}`;
        } else {
            url += `&forecast_days=1`;
        }

        const response = await fetchWithRetry(url);
        const hourly = response.data.hourly;

        // If we have a specific date, we look at the hourly data
        // Use provided targetHour or default to mid-day (12:00)
        let hourIndex = targetHour !== undefined ? parseInt(targetHour) : 12;
        if (isNaN(hourIndex) || hourIndex < 0 || hourIndex > 23) hourIndex = 12;

        const currentData = response.data.current || {};

        const useHourly = targetHour !== undefined || dateStr;

        // DEBUG LOG
        if (useHourly) {
            console.log(`[WeatherService] Fetching ${lat},${lng} for Hour: ${hourIndex} (useHourly: ${useHourly})`);
            console.log(`[WeatherService] Temp at index ${hourIndex}: ${hourly.temperature_2m[hourIndex]}`);
            console.log(`[WeatherService] URL: ${url}`);
        }

        return {
            temperature: useHourly ? hourly.temperature_2m[hourIndex] : currentData.temperature_2m,
            weathercode: useHourly ? hourly.weather_code[hourIndex] : currentData.weather_code,
            windSpeed: useHourly ? hourly.wind_speed_10m[hourIndex] : currentData.wind_speed_10m,
            humidity: useHourly ? hourly.relative_humidity_2m[hourIndex] : currentData.relative_humidity_2m,
            precipitationProbability: hourly.precipitation_probability ? hourly.precipitation_probability[hourIndex] : 0,
            windDirection: hourly.wind_direction_10m ? hourly.wind_direction_10m[hourIndex] : 0
        };
    } catch (error) {
        console.error(`Weather fetch failed for ${lat},${lng} on ${dateStr || 'today'}:`, error.message);
        return null;
    }
};

/**
 * Batch fetches weather for multiple points.
 */
const getWeatherForPoints = async (points, dateStr) => {
    // Limit to reasonable number to avoid spamming
    const limitedPoints = points.slice(0, 50);
    const results = [];

    // Process in chunks to avoid rate limits
    const CHUNK_SIZE = 5;
    for (let i = 0; i < limitedPoints.length; i += CHUNK_SIZE) {
        const chunk = limitedPoints.slice(i, i + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (pointObj, indexInChunk) => {
            // pointObj can be [lat, lng] or {lat, lng, dateStr, targetHour}
            const lat = pointObj.lat !== undefined ? pointObj.lat : pointObj[0];
            const lng = pointObj.lng !== undefined ? pointObj.lng : pointObj[1];
            const d = pointObj.dateStr || dateStr;
            const h = pointObj.targetHour !== undefined ? pointObj.targetHour : undefined;

            const weather = await getWeather(lat, lng, d, h);
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
