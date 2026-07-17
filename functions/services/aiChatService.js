/**
 * Wayvue AI Trip Planner — Claude-powered chat with tool calling.
 *
 * The server is a thin, stateless proxy: the client sends the full message
 * history plus a snapshot of the current trip, and Claude replies with either
 * text or a `update_trip_plan` tool call. The client executes the tool (it owns
 * the trip state and the re-planning logic), then sends the tool_result back for
 * the next turn.
 */
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-opus-4-8';

// Single client-executed tool: lets Claude re-plan the trip.
const TOOLS = [
    {
        name: 'update_trip_plan',
        description:
            "Change the user's road trip and recalculate the route. Call this whenever the user asks to modify the trip — new origin or destination, different dates/times, switching between a one-way and round trip, choosing the fastest vs the most scenic route, or adding/removing stops along the way. Only include the fields you want to change; omitted fields keep their current value. After it runs you'll receive the updated route metrics to report back to the user.",
        input_schema: {
            type: 'object',
            properties: {
                start: { type: 'string', description: 'Origin location, e.g. "Denver, CO"' },
                destination: { type: 'string', description: 'Destination location, e.g. "Moab, UT"' },
                departureDate: { type: 'string', description: 'Departure date in YYYY-MM-DD format' },
                departureTime: { type: 'string', description: 'Departure time in 24h HH:MM format' },
                returnDate: { type: 'string', description: 'Return date in YYYY-MM-DD format (round trips only)' },
                returnTime: { type: 'string', description: 'Return time in 24h HH:MM format (round trips only)' },
                roundTrip: { type: 'boolean', description: 'true for a round trip, false for one-way' },
                preference: {
                    type: 'string',
                    enum: ['fastest', 'scenic'],
                    description: 'Route style: fastest = quickest arrival, scenic = prettier drive',
                },
                waypoints: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                        'Intermediate stop locations, in order. This REPLACES the current stop list — pass the full desired list, or an empty array to clear all stops.',
                },
            },
        },
    },
];

function buildSystemPrompt(tripContext) {
    const ctx = tripContext && Object.keys(tripContext).length
        ? JSON.stringify(tripContext, null, 2)
        : 'No trip has been planned yet.';

    return `You are Wayvue's AI trip planner — a sharp, friendly co-pilot for road trips. You help people plan, understand, and customize their drive.

Here is the current trip the user is looking at (live data from the app):
<trip_context>
${ctx}
</trip_context>

How to help:
- Answer questions about the trip using the data above (weather, drive time, costs, tolls, road alerts, stops, best departure time, trip score). Be specific and cite the numbers.
- When the user wants to change something about the trip — origin, destination, dates/times, one-way vs round trip, fastest vs scenic, or stops — call the update_trip_plan tool. Then tell them what changed using the new metrics you get back.
- Make proactive, concrete suggestions when useful (a better departure window, a worthwhile scenic detour, a good overnight stop), but keep them brief.
- If the trip context is empty, help them start one: ask for origin and destination (and dates if relevant), then call update_trip_plan to plan it.

Style: warm but concise. Lead with the answer. No preamble, no restating the question, no meta commentary about being an AI. Never invent data that isn't in the trip context — if you don't have it, say so. Prefer 1–3 short sentences unless the user asks for detail.`;
}

/**
 * @param {Array} messages  Anthropic-format message history from the client.
 * @param {Object} tripContext  Snapshot of the current trip for the system prompt.
 * @returns {Promise<{content: Array, stopReason: string}>}
 */
async function runChatTurn(messages, tripContext) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
        const err = new Error('AI assistant is not configured. Add ANTHROPIC_API_KEY to the server environment (server/.env).');
        err.status = 503;
        throw err;
    }

    // Zero-arg client resolves ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN.
    const client = new Anthropic();

    const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(tripContext),
        tools: TOOLS,
        messages,
    });

    return { content: response.content, stopReason: response.stop_reason };
}

module.exports = { runChatTurn };
