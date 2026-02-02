const { getWeather } = require('./server/services/weatherService');

async function test() {
    console.log("--- Testing Default ---");
    try {
        const res1 = await getWeather(40.7128, -74.0060);
        console.log("Result 1:", res1 ? "OK" : "NULL");
    } catch (e) { console.log("Error 1:", e.message); }

    console.log("\n--- Testing Date/Hour ---");
    try {
        const res2 = await getWeather(40.7128, -74.0060, '2026-02-02', 15);
        console.log("Result 2:", res2 ? "OK" : "NULL");
    } catch (e) { console.log("Error 2:", e.message); }

    console.log("\n--- Testing UTC ---");
    try {
        const res3 = await getWeather(40.7128, -74.0060, '2026-02-02', 15, 'UTC');
        console.log("Result 3:", res3 ? "OK" : "NULL");
    } catch (e) { console.log("Error 3:", e.message); }
}

test();
