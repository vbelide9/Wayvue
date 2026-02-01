/**
 * Generates a concise, premium Wayvue AI Analysis.
 * Persona: Wayvue Trip Intelligence Assistant.
 * Strict adherence to data. No fluff.
 */
function generateTripAnalysis(start, dest, weatherData, distance, duration, roadConditions = [], context = {}) {
    const {
        fuelCost, evCost, minTemp, maxTemp,
        trafficDelay, maxWind, precipChance, recommendations,
        departureDate, departureTime
    } = context;

    const cleanCity = (c) => c.split(',')[0].trim();

    // 1. Overview Stats
    const overview = {
        distance: distance,
        duration: duration,
        delay: trafficDelay > 10 ? `${trafficDelay} min` : null,
        eta: "Calculated" // Client can calc or just rely on duration
    };

    // 2. Fuel
    const fuel = {
        gas: fuelCost || "N/A",
        ev: evCost || null
    };

    // 3. Weather
    const weather = {
        tempRange: `${minTemp}° - ${maxTemp}°`,
        wind: maxWind > 15 ? `${maxWind} mph` : null,
        precipChance: precipChance > 0 ? `${precipChance}%` : null,
        condition: precipChance > 50 ? "Rain/Snow" : "Clear"
    };

    // 4. Roads
    const roadStatus = {
        condition: trafficDelay > 15 ? "Congested" : "Clear",
        delay: trafficDelay > 0 ? `${trafficDelay} min` : null,
        details: roadConditions.filter(r => r.status !== 'good').length > 0
            ? `Slowdowns near ${cleanCity(roadConditions.find(r => r.status !== 'good').segment)}`
            : "Traffic flowing normally"
    };

    // 5. Stops
    const stops = (recommendations || []).map(r => ({
        city: cleanCity(r.city),
        reason: r.reason.replace(/_/g, ' ')
    }));

    // 6. Natural Language Insights
    const items = [];

    // Timing advice
    const datePart = departureDate ? `on ${departureDate}` : "today";
    const timePart = departureTime ? `at ${departureTime}` : "";
    const timingPrefix = `Departing ${datePart} ${timePart}: `;

    if (trafficDelay > 30) {
        items.push(`${timingPrefix}Expect significant delays. Departing slightly later might help you skip the worst of it.`);
    } else if (trafficDelay > 10) {
        items.push(`${timingPrefix}Minor slowdowns ahead, but nothing that should derail your arrival window.`);
    } else {
        items.push(`${timingPrefix}Clear roads expected—great timing to get ahead of schedule.`);
    }

    // Time of day awareness
    if (departureTime) {
        const hour = parseInt(departureTime.split(':')[0]);
        if (hour >= 20 || hour <= 5) {
            items.push("Night driving ahead—ensure your lighting is optimal and watch for reduced visibility.");
        } else if (hour >= 6 && hour <= 9) {
            items.push("Morning departure: Watch for commuter traffic peaks as you bypass major hubs.");
        }
    }

    // Weather/Comfort trends
    if (maxTemp - minTemp > 20) {
        items.push("Significant temperature swing ahead—keep a light layer within reach.");
    }
    if (precipChance > 40) {
        items.push("Expect visibility to drop as you hit the rainier stretches.");
    }
    if (maxWind > 25) {
        items.push("Noticeable crosswinds ahead; stay focused while passing larger vehicles.");
    }

    // Practical/Fatigue
    const hours = parseInt(duration);
    if (hours >= 4) {
        items.push("This is a long haul—aim for a 15-minute stretch break every two hours to stay sharp.");
    }

    // Fun Moment
    const funMoments = [
        `Headed to ${cleanCity(dest)}? Great choice. The drive is half the fun.`,
        "Windows down, volume up—this stretch is made for a solid road-trip playlist.",
        "Keep an eye out for local diners along this route; they usually have the best coffee.",
        "Road trips are about the detours. If a scenic overlook catches your eye, take it."
    ];
    const funMoment = funMoments[Math.floor(Math.random() * funMoments.length)];

    // Determine Tone
    const tone = trafficDelay > 30 || precipChance > 60 ? "caution" : "positive";

    return {
        structured: {
            overview,
            fuel,
            weather,
            roads: roadStatus,
            stops
        },
        insights: {
            bullets: items.slice(0, 4),
            funMoment: funMoment
        },
        tone: tone
    };
}

module.exports = { generateTripAnalysis };
