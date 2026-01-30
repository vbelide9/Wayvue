const axios = require('axios');

/**
 * Service to fetch REAL traffic camera feeds from State DOT APIs.
 * NOTE: This requires valid API keys from the respective state DOTs (511PA, 511NY, etc.)
 */
const RealCameraService = {
    /**
     * Fetch cameras near a location from 511NY (New York)
     * Requires VITE_511NY_API_KEY in .env
     */
    async getCamerasNY(lat, lon, radius = 5) { // radius in miles
        const apiKey = process.env.NY_511_API_KEY;
        if (!apiKey) return null;

        try {
            // 511NY returns ALL cameras. In a real app we would cache this or use a geospatial query if available.
            // For this demo, we fetch and filter (inefficient but functional for a prototype)
            const url = `https://511ny.org/api/getcameras?key=${apiKey}&format=json`;
            const response = await axios.get(url, { timeout: 3000 });

            const cameras = response.data;
            // Find closest camera
            const closest = cameras.find(cam => {
                const d = getDistanceInMiles(lat, lon, cam.Latitude, cam.Longitude);
                return d <= radius;
            });

            if (closest) {
                return {
                    id: closest.Id,
                    name: closest.Name,
                    url: closest.Url, // Image URL
                    videoUrl: closest.VideoUrl, // Live stream if available
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            console.error('Failed to fetch 511NY cameras:', error.message);
        }
        return null;
    },

    /**
     * Placeholder for 511PA (Pennsylvania)
     * PennDOT requires a manual "Data Feed Request" approval process.
     * Once approved, they provide a specific endpoint and credentials.
     */
    async getCamerasPA(lat, lon) {
        // const apiKey = process.env.PA_511_API_KEY;
        // if (!apiKey) return null;

        // Example logic for authorized PennDOT feed:
        // const url = `https://www.dot511.state.pa.us/api/cameras?lat=${lat}&lon=${lon}`;
        // ... implementation dependends on specific access grant details

        return null;
    }
};

// Helper: Haversine Distance
function getDistanceInMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius of Earth in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

module.exports = RealCameraService;
