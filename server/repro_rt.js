const axios = require('axios');

const API_URL = 'http://localhost:3001/api/route';

async function testRoundTrip() {
    const payload = {
        start: "New York, NY",
        end: "Philadelphia, PA",
        departureDate: "2026-02-05", // Future date
        departureTime: "10:00",
        returnDate: "2026-02-06",
        returnTime: "10:00",
        roundTrip: true, // Key flag
        preference: "fastest"
    };

    try {
        console.log('Sending Round Trip Request...');
        const response = await axios.post(API_URL, payload);
        const data = response.data;

        console.log('Response Status:', response.status);
        console.log('Is Round Trip Response:', data.isRoundTrip);
        console.log('Has Outbound:', !!data.outbound);
        console.log('Has Return:', !!data.return);

        if (data.return) {
            console.log('Return Leg Summary:', {
                date: data.return.date,
                routeFound: !!data.return.route
            });
        } else {
            console.error('FAIL: Missing return object in response');
        }

    } catch (error) {
        console.error('Request Failed:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    }
}

testRoundTrip();
