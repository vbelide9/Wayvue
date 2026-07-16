// Collaborative trip playlist. Search Spotify's catalog and add songs to the trip's shared
// playlist — any trip member can add/remove (RLS). Playback: best-effort 30s preview
// (when Spotify provides one) + "Open in Spotify" for the full track.
import { useEffect, useRef, useState } from 'react';
import { Music, Search, Plus, Trash2, Play, Pause, ExternalLink, Loader2, X } from 'lucide-react';
import { useTripPlan } from '@/lib/TripPlanContext';
import { useGroupTrip } from '@/lib/GroupTripContext';
import {
    searchSpotify, listTracks, addTrack, removeTrack, totalDuration,
    type SpotifyTrack, type TripTrack,
} from '@/lib/tripTracks';
import type { TripMember } from '@/lib/groupTrips';

function AddedByDot({ member }: { member?: TripMember }) {
    if (!member) return null;
    const initials = member.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'T';
    return (
        <div title={`Added by ${member.name}`} className="w-5 h-5 rounded-full overflow-hidden bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center border border-card ring-1 ring-border/60 shrink-0">
            {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </div>
    );
}

export function PlaylistTab() {
    const { enabled, signedIn, tripId } = useTripPlan();
    const { isGroup, memberById } = useGroupTrip();
    const [tracks, setTracks] = useState<TripTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SpotifyTrack[]>([]);
    const [searching, setSearching] = useState(false);
    const [configured, setConfigured] = useState(true);
    const [playing, setPlaying] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Load the playlist.
    useEffect(() => {
        if (!tripId) { setTracks([]); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        listTracks(tripId).then(t => { if (!cancelled) setTracks(t); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [tripId]);

    // Probe whether Spotify is configured on the server.
    useEffect(() => {
        fetch('/api/spotify/search?q=').then(r => r.json()).then(d => setConfigured(!!d.configured)).catch(() => setConfigured(false));
    }, []);

    // Debounced catalog search.
    useEffect(() => {
        const q = query.trim();
        if (!q) { setResults([]); setSearching(false); return; }
        setSearching(true);
        const t = setTimeout(() => {
            searchSpotify(q).then(r => { setResults(r.tracks); setConfigured(r.configured); }).finally(() => setSearching(false));
        }, 350);
        return () => clearTimeout(t);
    }, [query]);

    // One preview at a time.
    const togglePreview = (id: string, url: string | null) => {
        if (!url) return;
        const a = audioRef.current || (audioRef.current = new Audio());
        if (playing === id) { a.pause(); setPlaying(null); return; }
        a.src = url; a.play().catch(() => {}); setPlaying(id);
        a.onended = () => setPlaying(null);
    };
    useEffect(() => () => { audioRef.current?.pause(); }, []);

    const onAdd = async (t: SpotifyTrack) => {
        if (!tripId || tracks.some(x => x.spotify_id === t.spotifyId)) return;
        try {
            const created = await addTrack(tripId, t);
            if (created) setTracks(prev => [...prev, created]);
        } catch (e) { console.error('[playlist] add failed:', e); }
    };

    const onRemove = async (id: string) => {
        setTracks(prev => prev.filter(t => t.id !== id));
        try { await removeTrack(id); } catch (e) { console.error('[playlist] remove failed:', e); }
    };

    if (!enabled) return <div className="p-6 text-center text-sm text-muted-foreground">Community features aren’t configured.</div>;
    if (!signedIn || !tripId) {
        return (
            <div className="p-8 text-center">
                <Music className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-bold text-foreground">Build a trip playlist</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Tap <span className="font-semibold">Save</span> in the top bar to save this trip, then add songs{isGroup ? ' — everyone on the trip can add' : ''}.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><Music className="w-5 h-5 text-primary" /> Trip Playlist</h2>
                <p className="text-xs text-muted-foreground">
                    {tracks.length === 0 ? 'Search Spotify and add songs for the drive.' : `${tracks.length} song${tracks.length > 1 ? 's' : ''} · ${totalDuration(tracks)}${isGroup ? ' · everyone can add' : ''}`}
                </p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search songs or artists…"
                    className="w-full h-11 pl-10 pr-9 text-sm bg-card border border-border rounded-full outline-none focus:border-primary/50"
                />
                {query && <button onClick={() => setQuery('')} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
            </div>

            {!configured && (
                <div className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded-xl p-3">
                    Music search isn’t set up yet (add <span className="font-mono">SPOTIFY_CLIENT_ID</span> / <span className="font-mono">SPOTIFY_CLIENT_SECRET</span> on the server).
                </div>
            )}

            {/* Search results */}
            {query.trim() && (
                <div className="bg-card border border-border rounded-2xl divide-y divide-border/60 overflow-hidden">
                    {searching ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : results.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No songs found.</p>
                    ) : results.map(t => {
                        const added = tracks.some(x => x.spotify_id === t.spotifyId);
                        return (
                            <div key={t.spotifyId} className="flex items-center gap-3 p-2.5">
                                <TrackArt url={t.imageUrl} playing={playing === t.spotifyId} hasPreview={!!t.previewUrl} onToggle={() => togglePreview(t.spotifyId, t.previewUrl)} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{t.artists}</p>
                                </div>
                                <button
                                    onClick={() => onAdd(t)}
                                    disabled={added}
                                    className={`h-8 px-3 rounded-full text-xs font-bold shrink-0 flex items-center gap-1 ${added ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                                >
                                    {added ? 'Added' : <><Plus className="w-3.5 h-3.5" /> Add</>}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* The playlist */}
            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : tracks.length > 0 && (
                <div className="flex flex-col gap-2">
                    {tracks.map(t => (
                        <div key={t.id} className="bg-card border border-border rounded-2xl p-2.5 flex items-center gap-3">
                            <TrackArt url={t.image_url} playing={playing === t.id} hasPreview={!!t.preview_url} onToggle={() => togglePreview(t.id, t.preview_url)} />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{t.artists}</p>
                            </div>
                            {isGroup && <AddedByDot member={memberById(t.added_by)} />}
                            {t.external_url && (
                                <a href={t.external_url} target="_blank" rel="noopener noreferrer" title="Open in Spotify" className="p-1.5 rounded-full text-muted-foreground hover:text-[#1DB954]">
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                            <button onClick={() => onRemove(t.id)} aria-label="Remove" className="p-1.5 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Album art with a preview play/pause overlay (only interactive when a preview exists).
function TrackArt({ url, playing, hasPreview, onToggle }: { url: string | null; playing: boolean; hasPreview: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle} disabled={!hasPreview} className="relative w-11 h-11 rounded-lg overflow-hidden bg-secondary shrink-0 group/art disabled:cursor-default">
            {url ? <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Music className="w-5 h-5 text-muted-foreground m-auto" />}
            {hasPreview && (
                <span className={`absolute inset-0 flex items-center justify-center bg-black/40 text-white transition-opacity ${playing ? 'opacity-100' : 'opacity-0 group-hover/art:opacity-100'}`}>
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </span>
            )}
        </button>
    );
}
