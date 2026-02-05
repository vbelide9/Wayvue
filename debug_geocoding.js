const { reverseGeocode } = require('./server/services/geocodingService');

async function test() {
    console.log("Testing Reverse Geocoding...");
    // Test with a known coordinate (e.g., somewhere in PA/NY)
    // 41.408969, -75.662412 (Scranton, PA)
    const lat = 41.408969;
    const lng = -75.662412;

    try {
        const result = await reverseGeocode(lat, lng);
        console.log(`Result for ${lat}, ${lng}:`, result);
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
