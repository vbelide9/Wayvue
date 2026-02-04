const axios = require('axios');

const API_URL = 'http://localhost:3001/api/route';

const payload = {
    start: "15071, Oakdale, Pennsylvania",
    end: "Buffalo, NY",
    preference: "scenic",
    roundTrip: true
};

async function testRoute() {
    try {
        console.log("Sending request...", payload);
        const res = await axios.post(API_URL, payload);
        console.log("Success:", res.status);
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error("Error Status:", err.response ? err.response.status : "Unknown");
        console.error("Error Data:", err.response ? err.response.data : err.message);
    }
}

testRoute();
