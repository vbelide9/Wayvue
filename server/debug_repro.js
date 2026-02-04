const axios = require('axios');

async function testRoute() {
    try {
        const payload = {
            start: "1071 Olivia Dr, Oakdale, PA, 15071, USA",
            end: "Buffalo, NY",
            departureDate: "2026-02-04",
            departureTime: "11:29",
            roundTrip: false,
            preference: "fastest"
        };
        console.log("Sending payload:", payload);
        const res = await axios.post('http://localhost:3001/api/route', payload);
        console.log("Response:", JSON.stringify(res.data, null, 2));
    } catch (err) {
        if (err.response) {
            console.error("Error Status:", err.response.status);
            console.error("Error Data:", err.response.data);
        } else {
            console.error("Error:", err.message);
        }
    }
}

testRoute();
