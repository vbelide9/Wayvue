// Compose a feed post: a tip, a photo, or a shared trip / favorite stop. Supports prefill
// (e.g. opened from a stop's "Share" action) so entry points are thin wrappers over this.
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X, Route, MapPin, Loader2, Send, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { createPost, uploadPostPhoto, searchUsers, type FeedPost, type PostAuthor } from '@/lib/feed';
import { listTrips, type SavedTrip } from '@/lib/trips';
import { shortPlace } from '@/lib/placeFormat';
import { Avatar } from './PostCard';

export interface ComposerPrefill {
    body?: string;
    placeKey?: string;
    placeName?: string;
    tripId?: string;
}

export function PostComposer({ onPosted, prefill }: { onPosted: (p: FeedPost) => void; prefill?: ComposerPrefill }) {
    const { enabled, user, profile, signInWithGoogle } = useAuth();
    const [body, setBody] = useState(prefill?.body || '');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tripId, setTripId] = useState<string | null>(prefill?.tripId || null);
    const [placeKey] = useState<string | null>(prefill?.placeKey || null);
    const [placeName] = useState<string | null>(prefill?.placeName || null);
    const [trips, setTrips] = useState<SavedTrip[]>([]);
    const [tripPicker, setTripPicker] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const taRef = useRef<HTMLTextAreaElement>(null);

    // @-mention picker: the query is the @token immediately left of the caret.
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionResults, setMentionResults] = useState<PostAuthor[]>([]);
    const [mentions, setMentions] = useState<PostAuthor[]>([]);   // people picked so far

    useEffect(() => { if (user) listTrips().then(setTrips).catch(() => {}); }, [user]);

    // Debounced search for the active @mention token.
    useEffect(() => {
        if (mentionQuery === null || mentionQuery.length < 1) { setMentionResults([]); return; }
        const t = setTimeout(() => { searchUsers(mentionQuery).then(setMentionResults).catch(() => setMentionResults([])); }, 250);
        return () => clearTimeout(t);
    }, [mentionQuery]);

    // Detect an @token ending at the caret so we know when to show the picker.
    const onBodyChange = (value: string) => {
        setBody(value);
        const caret = taRef.current?.selectionStart ?? value.length;
        const m = /(?:^|\s)@(\w{0,20})$/.exec(value.slice(0, caret));
        setMentionQuery(m ? m[1] : null);
    };

    const pickMention = (a: PostAuthor) => {
        const ta = taRef.current;
        const caret = ta?.selectionStart ?? body.length;
        const before = body.slice(0, caret).replace(/(^|\s)@(\w{0,20})$/, `$1@${a.name} `);
        const next = before + body.slice(caret);
        setBody(next);
        setMentions(prev => prev.some(p => p.userId === a.userId) ? prev : [...prev, a]);
        setMentionQuery(null); setMentionResults([]);
        setTimeout(() => ta?.focus(), 0);
    };

    if (!enabled) return null;

    const onPickPhoto = async (file?: File) => {
        if (!file) return;
        setError(null); setUploading(true);
        try { setImageUrl(await uploadPostPhoto(file)); }
        catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
        finally { setUploading(false); }
    };

    const submit = async () => {
        if (!user) { await signInWithGoogle(); return; }
        if (!body.trim() && !imageUrl && !placeKey && !tripId) return;
        setPosting(true); setError(null);
        try {
            const kind = imageUrl ? 'photo' : placeKey ? 'stop' : tripId ? 'trip' : 'tip';
            // Only keep mentions whose "@Name" survived in the final text.
            const mentionUserIds = mentions.filter(m => body.includes(`@${m.name}`)).map(m => m.userId);
            const created = await createPost({ kind, body, imageUrl, tripId, placeKey, placeName, mentionUserIds });
            if (created) {
                onPosted(created);
                setBody(''); setImageUrl(null); setTripId(prefill?.tripId || null); setMentions([]);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not post');
        } finally { setPosting(false); }
    };

    const chosenTrip = trips.find(t => t.id === tripId);

    return (
        <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 text-primary text-xs font-bold flex items-center justify-center border border-border/60 shrink-0">
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{(profile?.display_name || 'You')[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="relative">
                        <textarea
                            ref={taRef}
                            value={body}
                            onChange={e => onBodyChange(e.target.value)}
                            onFocus={() => { if (!user) signInWithGoogle(); }}
                            placeholder="Share a tip, a photo, or a favorite stop… use #tags and @mentions"
                            rows={2}
                            maxLength={2000}
                            className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground/70"
                        />
                        {mentionQuery !== null && mentionResults.length > 0 && (
                            <div className="absolute left-0 top-full z-30 mt-1 w-64 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-xl">
                                {mentionResults.map(a => (
                                    <button key={a.userId} onClick={() => pickMention(a)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary">
                                        <Avatar author={a} size={26} />
                                        <span className="text-sm font-medium text-foreground truncate">{a.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stop chip (from a share action) */}
                    {placeName && (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 mb-2">
                            <MapPin className="w-3.5 h-3.5" /> {placeName}
                        </div>
                    )}

                    {/* Chosen trip chip */}
                    {chosenTrip && (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 mb-2">
                            <Route className="w-3.5 h-3.5" /> {shortPlace(chosenTrip.start_label)} → {shortPlace(chosenTrip.destination_label)}
                            <button onClick={() => setTripId(null)} className="ml-1"><X className="w-3 h-3" /></button>
                        </div>
                    )}

                    {/* Photo preview */}
                    {imageUrl && (
                        <div className="relative mb-2 w-fit">
                            <img src={imageUrl} alt="" className="max-h-48 rounded-xl border border-border" />
                            <button onClick={() => setImageUrl(null)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    )}

                    {error && <p className="text-[11px] font-medium text-red-500 mb-2">{error}</p>}

                    <div className="flex items-center gap-1">
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onPickPhoto(e.target.files?.[0])} />
                        <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Add photo" className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary disabled:opacity-50">
                            {uploading ? <Loader2 className="w-4.5 h-4.5 animate-spin" style={{ width: 18, height: 18 }} /> : <ImagePlus style={{ width: 18, height: 18 }} />}
                        </button>

                        {/* Attach a saved trip */}
                        <div className="relative">
                            <button onClick={() => setTripPicker(v => !v)} title="Attach a trip" className="flex items-center gap-1 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary">
                                <Route style={{ width: 18, height: 18 }} /> <ChevronDown className="w-3 h-3" />
                            </button>
                            {tripPicker && (
                                <div className="absolute left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-20">
                                    {trips.length === 0 ? (
                                        <p className="text-xs text-muted-foreground p-3">No saved trips yet.</p>
                                    ) : trips.map(t => (
                                        <button key={t.id} onClick={() => { setTripId(t.id); setTripPicker(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary truncate">
                                            {shortPlace(t.start_label)} → {shortPlace(t.destination_label)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={submit}
                            disabled={posting || uploading}
                            className="ml-auto flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 shadow-orange-glow"
                        >
                            {posting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {!user ? 'Sign in to post' : <><Send className="w-4 h-4" /> Post</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
