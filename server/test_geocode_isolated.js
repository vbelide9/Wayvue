const { geocode } = require('./services/geocodingService');

async function run() {
    console.log("Testing geocode('New York')...");
    try {
        const result = await geocode("New York");
        console.log("Result:", result);
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
