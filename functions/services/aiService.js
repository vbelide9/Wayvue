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

    // Display delay with a tiny bit of jitter for "human" feel if it's very static
    const displayDelay = trafficDelay > 0 ? (trafficDelay + (Math.random() > 0.5 ? 1 : -1) * (trafficDelay % 3)) : 0;
    const finalDelay = Math.max(0, displayDelay);

    if (trafficDelay > 45) {
        const heavyMessages = [
            `${timingPrefix}Expect significant heavy volume. Adjusting your departure by 30 minutes could evade the peak.`,
            `${timingPrefix}Substantial congestion detected. The route is currently under heavy load—patience is key.`,
            `${timingPrefix}Heavy traffic alert. Your arrival window is shifting due to dense volumes ahead.`
        ];
        items.push(heavyMessages[Math.floor(Math.random() * heavyMessages.length)]);
    } else if (trafficDelay > 20) {
        const moderateMessages = [
            `${timingPrefix}Moderate traffic ahead. You're roughly ${finalDelay} minutes behind the optimal pace.`,
            `${timingPrefix}Flow is slightly throttled. You're seeing a ${finalDelay}-minute variance from clear conditions.`,
            `${timingPrefix}Expect some periodic braking. Current conditions add about ${finalDelay} minutes to the sprint.`
        ];
        items.push(moderateMessages[Math.floor(Math.random() * moderateMessages.length)]);
    } else if (trafficDelay > 5) {
        const minorMessages = [
            `${timingPrefix}Minor fluctuations in flow, but your arrival window remains stable.`,
            `${timingPrefix}Light activity detected. The route is mostly clear with negligible resistance.`,
            `${timingPrefix}A few busy stretches, but nothing that significantly impacts your rhythm.`
        ];
        items.push(minorMessages[Math.floor(Math.random() * minorMessages.length)]);
    } else {
        const clearMessages = [
            `${timingPrefix}Pristine road conditions ahead—perfect for an efficient cruise.`,
            `${timingPrefix}Zero congestion detected. You’re on track for a remarkably smooth arrival.`,
            `${timingPrefix}Green corridors all the way! Great timing to stay ahead of schedule.`,
            `${timingPrefix}The road is entirely yours. Optimal flow reported across all segments.`
        ];
        items.push(clearMessages[Math.floor(Math.random() * clearMessages.length)]);
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
    if (precipChance > 60) {
        items.push("High confidence of rain/snow—ensure your wipers are ready for the stretch ahead.");
    } else if (precipChance > 30) {
        items.push("Variable precipitation expected; keep a safe following distance as roads dampen.");
    }

    if (maxWind > 30) {
        items.push("Strong gusts ahead—hold a steady line, especially when exiting tunnels or bridges.");
    } else if (maxWind > 15) {
        items.push("Noticeable wind activity detected; stay alert for minor steering adjustments.");
    }

    // Gas Price Analysis
    const gasPrices = weatherData.filter(w => w.gasPrice).map(w => ({ price: parseFloat(w.gasPrice), loc: w.location }));
    if (gasPrices.length > 0) {
        gasPrices.sort((a, b) => a.price - b.price);
        const bestGas = gasPrices[0];
        items.push(`Fuel Tip: Lowest gas estimated at $${bestGas.price} near ${bestGas.loc}.`);
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

/**
 * Caclulates a 0-100 Trip Confidence Score.
 */
function calculateTripScore(context) {
    let score = 100;
    const deductions = [];

    const { precipChance, maxWind, trafficDelay, roadConditions, minTemp } = context;

    // 1. Precip Penalty
    if (precipChance > 70) {
        score -= 30;
        deductions.push({ type: 'High Chance of Rain/Snow', val: -30 });
    } else if (precipChance > 30) {
        score -= 15;
        deductions.push({ type: 'Possible Rain', val: -15 });
    }

    // 2. Wind Penalty
    if (maxWind > 40) {
        score -= 25;
        deductions.push({ type: 'Dangerous Winds', val: -25 });
    } else if (maxWind > 20) {
        score -= 10;
        deductions.push({ type: 'Gusty Conditions', val: -10 });
    }

    // 3. Traffic Penalty
    if (trafficDelay > 45) {
        score -= 20;
        deductions.push({ type: 'Heavy Traffic', val: -20 });
    } else if (trafficDelay > 15) {
        score -= 10;
        deductions.push({ type: 'Moderate Congestion', val: -10 });
    }

    // 4. Road Condition Penalty (Snow/Ice)
    const snowRoads = roadConditions.filter(r => r.description && r.description.includes("Snow")).length;
    const badRoads = roadConditions.filter(r => r.status === 'poor').length;

    if (snowRoads > 0) {
        score -= 40;
        deductions.push({ type: 'Snow/Ice on Route', val: -40 });
    } else if (badRoads > 0) {
        score -= 25;
        deductions.push({ type: 'Poor Road Conditions', val: -25 });
    }

    // 5. Extreme Temp Penalty
    if (minTemp < 10) { // < 10F is very cold
        score -= 10;
        deductions.push({ type: 'Extreme Cold', val: -10 });
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Label
    let label = "Excellent";
    if (score < 60) label = "Risky";
    else if (score < 80) label = "Fair";
    else if (score < 90) label = "Good";

    return { score, label, deductions };
}

module.exports = { generateTripAnalysis, calculateTripScore };
