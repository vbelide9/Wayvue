// Wayvue AI trip-planner chat client.
// Talks to POST /api/chat, which proxies to Claude with the update_trip_plan tool.
import { api } from './api';

export type ChatTextBlock = { type: 'text'; text: string };
export type ChatToolUseBlock = { type: 'tool_use'; id: string; name: string; input: any };
export type ChatToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string };
export type ContentBlock = ChatTextBlock | ChatToolUseBlock | ChatToolResultBlock | { type: string; [k: string]: any };

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
}

export interface ChatTurnResult {
    content: ContentBlock[];
    stopReason: string;
}

/** The trip fields the AI can change via update_trip_plan. */
export interface TripPlanUpdate {
    start?: string;
    destination?: string;
    departureDate?: string;
    departureTime?: string;
    returnDate?: string;
    returnTime?: string;
    roundTrip?: boolean;
    preference?: 'fastest' | 'scenic';
    waypoints?: string[];
}

/** Send the conversation + current trip snapshot; get Claude's next turn. */
export async function sendChatTurn(messages: ChatMessage[], tripContext: any): Promise<ChatTurnResult> {
    const res = await api.post('/chat', { messages, tripContext });
    return res.data as ChatTurnResult;
}

export function extractText(content: ContentBlock[]): string {
    return content
        .filter((b): b is ChatTextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
}

export function extractToolUses(content: ContentBlock[]): ChatToolUseBlock[] {
    return content.filter((b): b is ChatToolUseBlock => b.type === 'tool_use');
}
