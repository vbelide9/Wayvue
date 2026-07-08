/**
 * Generates a concise, premium Wayvue AI Analysis.
 * Persona: Wayvue Trip Intelligence Assistant.
 * Strict adherence to data. No fluff.
 */
function generateTripAnalysis(start, dest, weatherData, distance, duration, roadConditions = [], context = {}) {
    const {
        fuelCost, evCost, minTemp, maxTemp,
        trafficDelay, maxWind, precipChance, recommendations,
        departureDate, departureTime,
        tollCost, tollDisplay, tollEstimated,
        incidents, incidentCounts,
        durationMinutes, distanceMiles
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
        ev: evCost || null,
        toll: (tollCost && tollCost > 0) ? tollDisplay : null,
        tollEstimated: !!tollEstimated
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

    // 6. Natural-language insights — ranked by how noteworthy/trip-specific each fact is,
    //    then the top few are shown. Every line is data-driven so trips read differently.
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const candidates = []; // { p: priority, text }

    // Use the real numeric duration/distance from context — never parse the display
    // strings ("28 min" would be read as 28 *hours*, breaking short trips).
    const distNum = Math.round(distanceMiles != null ? distanceMiles : (parseFloat(String(distance)) || 0));
    const durHrs = (durationMinutes != null ? durationMinutes : 0) / 60;
    const c = incidentCounts || {};

    // A) Critical — closures / accidents on the route
    if (c.closure > 0) {
        candidates.push({ p: 100, text: pick([
            `Heads up: ${c.closure} road closure${c.closure > 1 ? 's' : ''} reported on your route — check the map for reroutes before you leave.`,
            `${c.closure} closure${c.closure > 1 ? 's' : ''} flagged along the way. Build in a little buffer just in case.`
        ]) });
    }
    if (c.accident > 0) {
        candidates.push({ p: 92, text: pick([
            `${c.accident} accident${c.accident > 1 ? 's' : ''} currently reported on your path — ease off and leave extra following distance.`,
            `Live traffic shows ${c.accident} accident${c.accident > 1 ? 's' : ''} ahead. Stay sharp through those stretches.`
        ]) });
    }

    // B) Snow / ice on a road segment
    const snowSeg = roadConditions.find(r => r.description && r.description.includes('Snow'));
    if (snowSeg) {
        candidates.push({ p: 96, text: `Winter conditions near ${cleanCity(snowSeg.segment)} — snow or ice on the road, so keep the speed down.` });
    }

    // C) Traffic
    if (trafficDelay > 45) {
        candidates.push({ p: 80, text: pick([
            `Traffic's heavy right now — about ${trafficDelay} extra minutes. Shifting your start by 30 could dodge the worst of it.`,
            `Dense volume ahead is adding roughly ${trafficDelay} min. A slightly later departure pays off.`
        ]) });
    } else if (trafficDelay > 15) {
        candidates.push({ p: 55, text: pick([
            `Moderate traffic — around ${trafficDelay} min slower than a clear run.`,
            `Some stop-and-go expected; figure ~${trafficDelay} min of added time.`
        ]) });
    }

    // D) Tolls (real number)
    if (tollCost && tollCost >= 3) {
        const estNote = tollEstimated ? ' (est.)' : '';
        candidates.push({ p: 70, text: pick([
            `Budget about ${tollDisplay}${estNote} for tolls — a transponder keeps you moving through the booths.`,
            `Tolls run roughly ${tollDisplay}${estNote} on this route. Keep a card within reach.`
        ]) });
    }

    // E) Gas — cheapest stop + how much you save vs the priciest
    const gasPrices = weatherData.filter(w => w.gasPrice).map(w => ({ price: parseFloat(w.gasPrice), loc: w.location }));
    if (gasPrices.length > 0) {
        gasPrices.sort((a, b) => a.price - b.price);
        const cheapest = gasPrices[0];
        const priciest = gasPrices[gasPrices.length - 1];
        const spread = priciest.price - cheapest.price;
        if (spread >= 0.15) {
            candidates.push({ p: 66, text: `Fuel's cheapest near ${cheapest.loc} at $${cheapest.price.toFixed(2)}/gal — about $${spread.toFixed(2)}/gal less than the priciest stretch. Worth timing your fill-up there.` });
        } else {
            candidates.push({ p: 52, text: `Gas is averaging about $${cheapest.price.toFixed(2)}/gal along your route this week (live regional average).` });
        }
    }

    // F) Weather — precip, wind, temperature swing
    if (precipChance > 60) {
        candidates.push({ p: 68, text: pick([
            `High chance of rain or snow (${precipChance}%) — wipers ready and give yourself extra room.`,
            `Wet weather likely (${precipChance}%); expect slick patches along the way.`
        ]) });
    } else if (precipChance > 30) {
        candidates.push({ p: 46, text: `Passing showers possible (${precipChance}%) — nothing dramatic, just keep it steady.` });
    }
    if (maxWind > 30) {
        candidates.push({ p: 62, text: `Gusts up to ${maxWind} mph — hold a firm line on bridges and open stretches.` });
    }
    const tempSwing = maxTemp - minTemp;
    if (tempSwing >= 20) {
        candidates.push({ p: 44, text: `Temps swing from ${minTemp}° to ${maxTemp}° across the drive — layers are your friend.` });
    }

    // G) Time of day
    if (departureTime) {
        const hour = parseInt(departureTime.split(':')[0]);
        if (hour >= 20 || hour <= 5) {
            candidates.push({ p: 48, text: `Night drive — keep your lights clean and watch for wildlife on the rural stretches.` });
        } else if (hour >= 6 && hour <= 9) {
            candidates.push({ p: 42, text: `Morning start — you'll brush against commuter traffic near the bigger cities.` });
        }
    }

    // H) Long-haul fatigue (framed with the real distance/time)
    if (durHrs >= 6) {
        candidates.push({ p: 50, text: `This is a ${distNum}-mile haul (~${durHrs} hrs) — plan a couple of real breaks to stay fresh.` });
    } else if (durHrs >= 4) {
        candidates.push({ p: 40, text: `A solid ${distNum}-mile run — a 15-minute stretch every couple of hours keeps you sharp.` });
    }

    // I) Positive filler (only surfaces if the route is genuinely quiet)
    candidates.push({ p: 8, text: pick([
        `Clean conditions across the board — this one's set up for an easy cruise.`,
        `Nothing major flagged on the route. Good day to just enjoy the drive.`,
        `Green corridors most of the way — smooth sailing ahead.`
    ]) });

    // Rank and keep the most noteworthy handful
    candidates.sort((a, b) => b.p - a.p);
    const items = candidates.slice(0, 4).map(x => x.text);

    // Fun Moment — varied, occasionally route-specific
    const funMoments = [
        `Headed to ${cleanCity(dest)}? Half the fun is the getting-there.`,
        `${distNum} miles of open road — cue the playlist.`,
        `Keep an eye out for a local diner along this stretch; the coffee's usually worth the stop.`,
        `If a scenic overlook catches your eye out there, take the exit — that's what road trips are for.`,
        `Somewhere between ${cleanCity(start)} and ${cleanCity(dest)} is a roadside gem you haven't found yet.`
    ];
    const funMoment = funMoments[Math.floor(Math.random() * funMoments.length)];

    // Determine Tone
    const tone = (c.closure > 0 || c.accident > 0 || snowSeg || trafficDelay > 30 || precipChance > 60) ? "caution" : "positive";

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

    const { precipChance, maxWind, trafficDelay, roadConditions, minTemp, maxTemp, departureTime, durationMinutes, incidentCounts } = context;

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

    // 5. Extreme Temperature Penalty (cold or heat)
    if (minTemp < 10) { // < 10°F — dangerous cold / ice risk
        score -= 10;
        deductions.push({ type: 'Extreme Cold', val: -10 });
    }
    if (maxTemp > 100) { // > 100°F — heat stress / overheating risk (e.g. deep-south summer)
        score -= 10;
        deductions.push({ type: 'Extreme Heat', val: -10 });
    } else if (maxTemp > 95) {
        score -= 5;
        deductions.push({ type: 'High Heat', val: -5 });
    }

    // 6. Long-Haul Fatigue Penalty (driving hours — the biggest factor on long trips)
    const durH = (durationMinutes || 0) / 60;
    if (durH >= 12) {
        score -= 15;
        deductions.push({ type: 'Long-Haul Fatigue Risk', val: -15 });
    } else if (durH >= 8) {
        score -= 8;
        deductions.push({ type: 'Extended Drive Time', val: -8 });
    } else if (durH >= 5) {
        score -= 3;
        deductions.push({ type: 'Long Drive', val: -3 });
    }

    // 7. Night Driving Penalty (reduced visibility, fatigue)
    if (departureTime) {
        const depHour = parseInt(departureTime.split(':')[0]);
        if (depHour >= 22 || depHour <= 4) {
            score -= 5;
            deductions.push({ type: 'Night Driving', val: -5 });
        }
    }

    // 8. Traffic Incident Penalty (accidents / closures on route)
    if (incidentCounts) {
        const closures = incidentCounts.closure || 0;
        const accidents = incidentCounts.accident || 0;
        if (closures > 0) {
            score -= 15;
            deductions.push({ type: 'Road Closure on Route', val: -15 });
        }
        if (accidents > 0) {
            score -= 10;
            deductions.push({ type: `${accidents} Accident${accidents > 1 ? 's' : ''} Reported`, val: -10 });
        }
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
