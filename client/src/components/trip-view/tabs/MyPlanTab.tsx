// "My Plan" — the current saved trip's editable itinerary. Add items from the other
// sections (stops/hotels/activities); here you reorder, annotate, and remove them.
import { useState } from 'react';
import {
    MapPin, BedDouble, Ticket, Utensils, StickyNote, Trash2,
    ExternalLink, Bookmark, Plus, Loader2,
    Users, ThumbsUp, ThumbsDown, Zap, Camera, Bell, X,
} from 'lucide-react';
import type { TripMember } from '@/lib/groupTrips';
import { useTripPlan } from '@/lib/TripPlanContext';
import { useGroupTrip } from '@/lib/GroupTripContext';
import { GroupMembersBar } from '@/components/GroupMembersBar';
import { type TripItem, type TripItemKind } from '@/lib/tripItems';
import { type Waypoint } from '@/components/WaypointsEditor';
import { shortPlace } from '@/lib/placeFormat';

// Distance along the route (mi) for ordering; parsed from "City • 34 mi". Items without
// a mile (hotels/activities at the destination, notes) sort to the end.
const routeMile = (it: TripItem): number => {
    const m = it.location?.match(/(\d+)\s*mi\b/);
    return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
};

const KIND_META: Record<TripItemKind, { icon: any; label: string; plural: string; color: string }> = {
    stop: { icon: MapPin, label: 'Stop', plural: 'stops', color: 'text-primary' },
    hotel: { icon: BedDouble, label: 'Hotel', plural: 'hotels', color: 'text-blue-500' },
    attraction: { icon: Ticket, label: 'Attraction', plural: 'attractions', color: 'text-purple-500' },
    restaurant: { icon: Utensils, label: 'Food', plural: 'places to eat', color: 'text-orange-500' },
    note: { icon: StickyNote, label: 'Note', plural: 'notes', color: 'text-muted-foreground' },
};

const KIND_ORDER: TripItemKind[] = ['stop', 'restaurant', 'attraction', 'hotel', 'note'];

// Compact "2m ago" style relative time for the activity feed.
function ago(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

// Small circular avatar for a trip member (contributor / voter). `size` in px.
function MemberDot({ member, size = 20, title }: { member?: TripMember; size?: number; title?: string }) {
    const name = member?.name || 'Traveler';
    const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'T';
    return (
        <div
            title={title || name}
            className="rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center border border-card ring-1 ring-border/60 shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.42 }}
        >
            {member?.avatar ? <img src={member.avatar} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </div>
    );
}

export function MyPlanTab({ start, destination, waypoints = [] }: { start?: string; destination?: string; waypoints?: Waypoint[] }) {
    const { enabled, signedIn, tripId, items, busy, removeItem, updateNotes, addToPlan } = useTripPlan();
    const { isGroup, routeVotes, itemVotes, voteRoute, voteItem, memberById, notifications, markNotificationsRead, markNotificationRead } = useGroupTrip();
    const [showVoteResults, setShowVoteResults] = useState(false);

    // FB-style: the feed shows only UNREAD activity; reading (dismissing) removes it.
    const unread = notifications.filter(n => !n.read);
    // Always show the plan in travel order (by distance from the start).
    const ordered = [...items].sort((a, b) => routeMile(a) - routeMile(b) || a.created_at.localeCompare(b.created_at));
    const counts = items.reduce<Record<string, number>>((acc, it) => { acc[it.kind] = (acc[it.kind] || 0) + 1; return acc; }, {});
    const [noteText, setNoteText] = useState('');
    const [editingNotes, setEditingNotes] = useState<string | null>(null);

    if (!enabled) {
        return <div className="p-6 text-center text-sm text-muted-foreground">Community features aren't configured.</div>;
    }
    if (!signedIn || !tripId) {
        return (
            <div className="p-8 text-center">
                <Bookmark className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-bold text-foreground">Build a plan for this trip</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Tap <span className="font-semibold">Save</span> in the top bar to save this trip, then add stops,
                    hotels, and activities to your plan from the sections below.
                </p>
            </div>
        );
    }

    const addNote = async () => {
        const text = noteText.trim();
        if (!text) return;
        setNoteText('');
        await addToPlan({ kind: 'note', title: text });
    };

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">My Plan</h2>
                <p className="text-xs text-muted-foreground">
                    {items.length === 0
                        ? 'Your itinerary is empty — add items from the sections below.'
                        : 'Ordered by where they fall on your route.'}
                </p>
                {items.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {KIND_ORDER.filter(k => counts[k]).map(k => {
                            const meta = KIND_META[k];
                            const Icon = meta.icon;
                            const n = counts[k];
                            return (
                                <span key={k} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary/60 border border-border ${meta.color}`}>
                                    <Icon className="w-3.5 h-3.5" />
                                    {n} {n === 1 ? meta.label.toLowerCase() : meta.plural}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Group planning: members + invite (moved here from the top bar) */}
            <GroupMembersBar />

            {/* Collaborator activity feed — unread only; dismissing removes it (FB style). */}
            {isGroup && unread.length > 0 && (
                <div className="border border-border rounded-2xl overflow-hidden bg-card">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                        <Bell className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">New activity</span>
                        <span className="text-[10px] font-bold text-white bg-red-500 rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{unread.length}</span>
                        <button onClick={markNotificationsRead} className="ml-auto text-[11px] font-bold text-primary hover:underline shrink-0">Mark all read</button>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-border/60">
                        {unread.map(n => (
                            <div key={n.id} className="flex items-start gap-2.5 px-4 py-2.5 bg-primary/5 group/notif">
                                <div className="w-[22px] h-[22px] rounded-full overflow-hidden shrink-0 bg-primary/10 text-primary flex items-center justify-center border border-border/60">
                                    {n.avatar ? <img src={n.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Bell className="w-3 h-3" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs text-foreground leading-snug">
                                        {n.message}{n.detail && <span className="font-semibold"> · {n.detail}</span>}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{ago(n.ts)}</p>
                                </div>
                                <button
                                    onClick={() => markNotificationRead(n.id)}
                                    aria-label="Dismiss"
                                    className="p-1 -m-1 rounded text-muted-foreground/50 hover:text-foreground shrink-0"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Route backbone: start → destination + any waypoints the route passes through
                (distinct from the itinerary items below — hence "Via"/"Direct", not "stops"). */}
            {start && destination && (() => {
                const routeWaypoints = waypoints.filter(w => w?.name?.trim());
                return (
                    <div className="bg-secondary/30 border border-border rounded-2xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Route</div>
                        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                            <span className="truncate">{shortPlace(start)}</span>
                            <span className="text-muted-foreground shrink-0">→</span>
                            <span className="truncate">{shortPlace(destination)}</span>
                        </div>
                        {routeWaypoints.length > 0 ? (
                            <p className="text-xs text-muted-foreground mt-1.5 leading-snug flex items-start gap-1.5">
                                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                                <span><span className="font-semibold text-foreground/70">Via </span>{routeWaypoints.map(w => shortPlace(w.name)).join(' → ')}</span>
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-1.5">Direct route</p>
                        )}
                    </div>
                );
            })()}

            {/* Group vote: fastest vs scenic. Shows once the trip has more than one member. */}
            {isGroup && (() => {
                const total = routeVotes.fastest + routeVotes.scenic;
                return (
                    <div className="bg-secondary/30 border border-border rounded-2xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Users className="w-3 h-3" /> Group vote · Route style
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {(['fastest', 'scenic'] as const).map(choice => {
                                const count = routeVotes[choice];
                                const mine = routeVotes.mine === choice;
                                const pct = total ? Math.round((count / total) * 100) : 0;
                                const Icon = choice === 'fastest' ? Zap : Camera;
                                const voters = routeVotes.votes.filter(v => v.choice === choice);
                                return (
                                    <button
                                        key={choice}
                                        onClick={() => voteRoute(choice)}
                                        className={`relative overflow-hidden text-left px-3 py-2 rounded-xl border transition-all ${mine ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
                                    >
                                        <div className="absolute inset-y-0 left-0 bg-primary/10 transition-all" style={{ width: `${pct}%` }} />
                                        <div className="relative flex items-center justify-between">
                                            <span className="text-xs font-bold capitalize flex items-center gap-1.5">
                                                <Icon className={`w-3.5 h-3.5 ${choice === 'fastest' ? 'text-primary' : 'text-purple-500'}`} />
                                                {choice}
                                            </span>
                                            <span className="text-xs font-bold text-muted-foreground">{count}</span>
                                        </div>
                                        {/* Who voted for this option */}
                                        {showVoteResults && voters.length > 0 && (
                                            <div className="relative flex -space-x-1.5 mt-2">
                                                {voters.map(v => <MemberDot key={v.userId} member={memberById(v.userId)} size={18} />)}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-muted-foreground">Tap to vote — the organizer applies the winner from the search bar.</p>
                            {total > 0 && (
                                <button onClick={() => setShowVoteResults(v => !v)} className="text-[11px] font-bold text-primary hover:underline shrink-0 ml-2">
                                    {showVoteResults ? 'Hide results' : 'View results'}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}

            {ordered.length > 0 && (
                <div className="flex flex-col gap-2">
                    {ordered.map((it) => {
                        const meta = KIND_META[it.kind] || KIND_META.stop;
                        const Icon = meta.icon;
                        return (
                            <div key={it.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-start gap-3">
                                <div className={`p-2 rounded-xl bg-secondary shrink-0 ${meta.color}`}><Icon className="w-4 h-4" /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{meta.label}</span>
                                        {it.location && <span className="text-[10px] text-muted-foreground">· {it.location}</span>}
                                        {/* Who added this stop (group trips) */}
                                        {isGroup && it.user_id && (
                                            <span className="ml-auto flex items-center gap-1 shrink-0">
                                                <MemberDot member={memberById(it.user_id)} size={16} title={`Added by ${memberById(it.user_id)?.name || 'a teammate'}`} />
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-bold text-foreground leading-snug mt-0.5">{it.title}</p>
                                    {it.detail && <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{it.detail}</p>}

                                    {editingNotes === it.id ? (
                                        <textarea
                                            autoFocus
                                            defaultValue={it.notes || ''}
                                            onBlur={(e) => { updateNotes(it.id, e.target.value); setEditingNotes(null); }}
                                            placeholder="Add a note…"
                                            rows={2}
                                            className="mt-2 w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary/50 resize-none"
                                        />
                                    ) : it.notes ? (
                                        <p onClick={() => setEditingNotes(it.id)} className="mt-2 text-xs text-foreground/80 bg-secondary/50 rounded-lg px-2 py-1.5 cursor-text whitespace-pre-wrap">{it.notes}</p>
                                    ) : (
                                        <button onClick={() => setEditingNotes(it.id)} className="mt-1.5 text-[11px] font-semibold text-primary hover:underline">+ Add note</button>
                                    )}

                                    {it.external_url && (
                                        <a href={it.external_url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                                            Open <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                                {/* Group like / dislike on this stop */}
                                {isGroup && (() => {
                                    const v = itemVotes[it.id];
                                    return (
                                        <div className="flex flex-col gap-1 shrink-0">
                                            <button
                                                onClick={() => voteItem(it.id, 1)}
                                                aria-label="Like"
                                                className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border text-xs font-bold transition-colors ${v?.mine === 1 ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30'}`}
                                            >
                                                <ThumbsUp className={`w-3.5 h-3.5 ${v?.mine === 1 ? 'fill-primary/20' : ''}`} />
                                                {v?.up || 0}
                                            </button>
                                            <button
                                                onClick={() => voteItem(it.id, -1)}
                                                aria-label="Dislike"
                                                className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border text-xs font-bold transition-colors ${v?.mine === -1 ? 'border-red-400/40 bg-red-500/10 text-red-500' : 'border-border text-muted-foreground hover:text-foreground hover:border-red-300'}`}
                                            >
                                                <ThumbsDown className={`w-3.5 h-3.5 ${v?.mine === -1 ? 'fill-red-500/20' : ''}`} />
                                                {v?.down || 0}
                                            </button>
                                        </div>
                                    );
                                })()}
                                <button onClick={() => removeItem(it.id)} aria-label="Remove" className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quick note */}
            <div className="flex items-center gap-2">
                <input
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
                    placeholder="Add a note to your plan…"
                    className="flex-1 text-sm bg-secondary/40 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/50"
                />
                <button onClick={addNote} disabled={!noteText.trim() || busy} aria-label="Add note" className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
