// Account control for the header: signed-out → "Sign in"; signed-in → avatar menu
// with the user's name, an inline "edit name", and sign out. Renders nothing when
// Supabase isn't configured.
import { useState, useRef, useEffect } from 'react';
import { LogOut, Check, X, Pencil, LogIn, Camera, Loader2, Bookmark, Smile, Users, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useSavedTrips } from '@/lib/SavedTripsContext';
import { useFeed } from '@/lib/FeedContext';
import { PRESET_AVATARS } from '@/lib/presetAvatars';

export function AccountMenu() {
    const { enabled, user, profile, signInWithGoogle, signOut, updateDisplayName, uploadAvatar, setAvatar, setPrivacy } = useAuth();
    const { open: openSavedTrips } = useSavedTrips();
    const { openFeed } = useFeed();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showAvatars, setShowAvatars] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setEditing(false); }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    if (!enabled) return null;

    if (!user) {
        return (
            <button
                onClick={() => signInWithGoogle()}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-bold bg-secondary/50 border border-border/50 text-foreground hover:bg-secondary hover:border-primary/40 transition-colors shrink-0"
            >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign in</span>
            </button>
        );
    }

    const name = profile?.display_name || 'Traveler';
    const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'T';

    const saveName = async () => {
        await updateDisplayName(nameInput);
        setEditing(false);
    };

    const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file
        if (!file) return;
        setUploadError(null);
        setUploading(true);
        try {
            await uploadAvatar(file);
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="relative shrink-0" ref={ref}>
            <button
                onClick={() => setOpen(v => !v)}
                aria-label="Account menu"
                className="w-9 h-9 rounded-full overflow-hidden border border-border/60 hover:border-primary/40 transition-colors flex items-center justify-center bg-primary/10 text-primary text-xs font-bold shrink-0"
            >
                {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    : <span>{initials}</span>}
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-border shadow-2xl rounded-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                    <div className="p-4 border-b border-border bg-secondary/40 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => !uploading && fileRef.current?.click()}
                            title="Change photo"
                            aria-label="Change profile photo"
                            className="group/av relative w-10 h-10 rounded-full overflow-hidden border border-border/60 flex items-center justify-center bg-primary/10 text-primary text-sm font-bold shrink-0"
                        >
                            {profile?.avatar_url
                                ? <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                : <span>{initials}</span>}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover/av:opacity-100 transition-opacity">
                                {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                            </span>
                        </button>
                        <div className="min-w-0">
                            {editing ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        autoFocus
                                        value={nameInput}
                                        onChange={e => setNameInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
                                        className="w-full text-sm font-bold bg-background border border-border rounded-md px-2 py-1 outline-none focus:border-primary/50"
                                        placeholder="Your name"
                                    />
                                    <button onClick={saveName} aria-label="Save name" className="p-1 text-emerald-600 hover:bg-secondary rounded"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditing(false)} aria-label="Cancel" className="p-1 text-muted-foreground hover:bg-secondary rounded"><X className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-bold text-foreground truncate">{name}</p>
                                    <button onClick={() => { setNameInput(name); setEditing(true); }} aria-label="Edit name" className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"><Pencil className="w-3 h-3" /></button>
                                </div>
                            )}
                            {user.email && <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>}
                        </div>
                    </div>
                    <button
                        onClick={() => { setOpen(false); openSavedTrips(); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                    >
                        <Bookmark className="w-4 h-4 text-muted-foreground" /> My Trips
                    </button>
                    <button
                        onClick={() => { setOpen(false); openFeed(); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors border-t border-border"
                    >
                        <Users className="w-4 h-4 text-muted-foreground" /> Community
                    </button>
                    {/* Private account: private → only followers see your posts. */}
                    <button
                        onClick={() => setPrivacy(!profile?.is_private).catch(() => {})}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors border-t border-border"
                    >
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1 text-left">Private account</span>
                        <span className={`relative w-9 h-5 rounded-full transition-colors ${profile?.is_private ? 'bg-primary' : 'bg-border'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${profile?.is_private ? 'left-[18px]' : 'left-0.5'}`} />
                        </span>
                    </button>
                    {profile?.is_private && (
                        <p className="px-4 pb-2 -mt-1 text-[11px] text-muted-foreground">Only your followers can see your posts.</p>
                    )}
                    <button
                        onClick={() => !uploading && fileRef.current?.click()}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-60 border-t border-border"
                        disabled={uploading}
                    >
                        {uploading ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
                        {profile?.avatar_url ? 'Change photo' : 'Upload photo'}
                    </button>
                    {uploadError && (
                        <p className="px-4 pb-2 -mt-1 text-[11px] text-destructive">{uploadError}</p>
                    )}
                    <button
                        onClick={() => setShowAvatars(v => !v)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors border-t border-border"
                    >
                        <Smile className="w-4 h-4 text-muted-foreground" /> Choose an avatar
                    </button>
                    {showAvatars && (
                        <div className="px-4 py-3 grid grid-cols-4 gap-2 border-t border-border">
                            {PRESET_AVATARS.map(a => {
                                const selected = profile?.avatar_url === a.url;
                                return (
                                    <button
                                        key={a.id}
                                        onClick={() => { setAvatar(a.url); }}
                                        aria-label={`Use ${a.id} avatar`}
                                        className={`aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105 ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
                                    >
                                        <img src={a.url} alt="" className="w-full h-full" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <button
                        onClick={() => { setOpen(false); signOut(); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors border-t border-border"
                    >
                        <LogOut className="w-4 h-4 text-muted-foreground" /> Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
