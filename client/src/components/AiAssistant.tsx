import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowUp, Wand2, RotateCcw } from 'lucide-react';
import {
    sendChatTurn,
    extractText,
    extractToolUses,
    type ChatMessage,
    type ContentBlock,
    type TripPlanUpdate,
} from '@/services/aiChat';

interface AiAssistantProps {
    /** Live snapshot of the current trip, sent to Claude as context each turn. */
    tripContext: any;
    /** Applies an AI-requested change and returns a short summary for the tool result. */
    onApplyPlan: (update: TripPlanUpdate) => Promise<string>;
}

const SUGGESTIONS = [
    'When should I leave?',
    'Add a scenic detour',
    'How is the weather looking?',
    'Make it a round trip',
];

export function AiAssistant({ tripContext, onApplyPlan }: AiAssistantProps) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const tripContextRef = useRef(tripContext);
    tripContextRef.current = tripContext;

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading, open]);

    // Drives the multi-turn tool loop: send → maybe run a tool → send the result → repeat.
    const runConversation = async (initial: ChatMessage[]) => {
        setLoading(true);
        setError(null);
        let convo = initial;
        try {
            for (let i = 0; i < 5; i++) {
                const result = await sendChatTurn(convo, tripContextRef.current);
                convo = [...convo, { role: 'assistant', content: result.content }];
                setMessages(convo);

                const toolUses = extractToolUses(result.content);
                if (result.stopReason === 'tool_use' && toolUses.length) {
                    const toolResults: ContentBlock[] = [];
                    for (const tu of toolUses) {
                        let summary = 'Done.';
                        try {
                            summary = tu.name === 'update_trip_plan'
                                ? await onApplyPlan(tu.input as TripPlanUpdate)
                                : `Unknown tool: ${tu.name}`;
                        } catch (e: any) {
                            summary = `Couldn't apply that change: ${e?.message || 'error'}`;
                        }
                        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: summary });
                    }
                    convo = [...convo, { role: 'user', content: toolResults }];
                    setMessages(convo);
                    continue; // let the model report back on the change
                }
                break; // plain text answer — turn complete
            }
        } catch (e: any) {
            setError(e?.response?.data?.error || e?.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const send = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;
        setInput('');
        const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
        setMessages(next);
        runConversation(next);
    };

    const reset = () => {
        setMessages([]);
        setError(null);
    };

    // Build the visible transcript: user text bubbles, assistant text bubbles,
    // and a small "adjusting" chip whenever the assistant fired a tool call.
    const rendered: { key: string; role: 'user' | 'assistant' | 'action'; text: string }[] = [];
    messages.forEach((m, i) => {
        if (m.role === 'user' && typeof m.content === 'string') {
            rendered.push({ key: `u-${i}`, role: 'user', text: m.content });
        } else if (m.role === 'assistant' && Array.isArray(m.content)) {
            const text = extractText(m.content);
            if (text) rendered.push({ key: `a-${i}`, role: 'assistant', text });
            if (extractToolUses(m.content).length) {
                rendered.push({ key: `act-${i}`, role: 'action', text: 'Updating your route…' });
            }
        }
    });

    return (
        <>
            {/* Launcher */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => setOpen(true)}
                        aria-label="Open AI trip planner"
                        className="fixed bottom-6 right-6 z-[900] flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-primary text-primary-foreground shadow-orange-glow hover:-translate-y-0.5 transition-transform"
                    >
                        <Sparkles className="w-5 h-5" />
                        <span className="text-sm font-semibold">Ask Wayvue AI</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                        className="fixed bottom-6 right-6 z-[900] w-[calc(100vw-3rem)] sm:w-[400px] h-[600px] max-h-[calc(100vh-3rem)] flex flex-col bg-card border border-border rounded-3xl shadow-soft-lg overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-orange-glow">
                                    <Sparkles className="w-4 h-4 text-primary-foreground" />
                                </div>
                                <div className="leading-tight">
                                    <p className="text-sm font-display font-bold text-foreground">Wayvue AI</p>
                                    <p className="text-[10px] text-muted-foreground font-medium">Trip planner &amp; assistant</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {messages.length > 0 && (
                                    <button onClick={reset} aria-label="New chat" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} data-lenis-prevent className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center text-center gap-4 my-auto px-2">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <Wand2 className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-base font-display font-bold text-foreground">Plan smarter, together</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Ask about your route, or tell me how to change it. I can re-plan the whole trip.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 mt-1">
                                        {SUGGESTIONS.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => send(s)}
                                                className="text-xs font-medium px-3 py-1.5 rounded-full border border-border bg-secondary/50 text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {rendered.map(m => {
                                if (m.role === 'action') {
                                    return (
                                        <div key={m.key} className="self-center flex items-center gap-2 text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
                                            <Wand2 className="w-3 h-3" /> {m.text}
                                        </div>
                                    );
                                }
                                const isUser = m.role === 'user';
                                return (
                                    <div
                                        key={m.key}
                                        className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap rounded-2xl ${isUser
                                            ? 'self-end bg-primary text-primary-foreground rounded-br-md'
                                            : 'self-start bg-secondary text-foreground rounded-bl-md'
                                            }`}
                                    >
                                        {m.text}
                                    </div>
                                );
                            })}

                            {loading && (
                                <div className="self-start flex items-center gap-1.5 bg-secondary px-4 py-3 rounded-2xl rounded-bl-md">
                                    {[0, 1, 2].map(i => (
                                        <span
                                            key={i}
                                            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                                            style={{ animationDelay: `${i * 0.15}s` }}
                                        />
                                    ))}
                                </div>
                            )}

                            {error && (
                                <div className="self-stretch text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Composer */}
                        <div className="p-3 border-t border-border shrink-0">
                            <div className="flex items-end gap-2 bg-secondary/50 border border-border rounded-2xl px-3 py-2 focus-within:border-primary/40 transition-colors">
                                <textarea
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            send(input);
                                        }
                                    }}
                                    rows={1}
                                    placeholder="Ask or change anything…"
                                    className="flex-1 resize-none bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground max-h-28 py-1"
                                />
                                <button
                                    onClick={() => send(input)}
                                    disabled={!input.trim() || loading}
                                    aria-label="Send"
                                    className="w-8 h-8 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
