/**
 * Generates a natural language summary of the trip based on weather and road conditions.
 * Acts as a simulated "AI" analyst.
 */
function generateTripAnalysis(start, dest, weatherData, distance) {
    const conditions = [];
    let severeCount = 0;
    let rainCount = 0;

    // Analyze weather codes
    weatherData.forEach(p => {
        const code = p.weather?.weather_code || 0;
        if ([71, 73, 75, 85, 86].includes(code)) severeCount++; // Snow
        if ([51, 61, 63, 80, 81, 95, 96, 99].includes(code)) rainCount++; // Rain
    });

    // Generate Narrative
    let tone = "positive";
    let summary = `Your trip from ${start.split(',')[0]} to ${dest.split(',')[0]} covers ${distance}. `;

    if (severeCount > 0) {
        tone = "caution";
        summary += "⚠️ CAUTION: Heavy snow or ice detected along the route. Recommend delaying travel or using winter tires. Visibility will be low.";
    } else if (rainCount > 2) {
        tone = "moderate";
        summary += "Expect wet road conditions and possible hydroplaning risks. Drive carefully, especially in the mid-section of the route.";
    } else {
        summary += "✅ Conditions look great! Clear skies and dry roads expected for most of the journey. Enjoy the drive.";
    }

    // Add "AI" specific advice
    const funFact = [
        "Did you know? This route is 15% more scenic than the highway alternative.",
        "Pro tip: Stop every 2 hours to stretch and stay alert.",
        "Fuel check: Ensure you have a full tank before leaving the city limits."
    ];

    summary += " " + funFact[Math.floor(Math.random() * funFact.length)];

    return {
        text: summary,
        tone: tone
    };
}

module.exports = { generateTripAnalysis };
