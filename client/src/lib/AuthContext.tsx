// Auth state for Wayvue's community features, backed by Supabase Auth (Google OAuth).
//
// Degrades gracefully: when Supabase isn't configured (`enabled === false`), there is
// no user and sign-in is a no-op, so any consumer can render normally.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseEnabled } from './supabase';
import { flushPendingRating } from './pendingRating';

export interface Profile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
}

interface AuthValue {
    user: User | null;
    /** Public identity (name + avatar); null when signed out or Supabase disabled. */
    profile: Profile | null;
    /** True until the initial session lookup resolves (false immediately if disabled). */
    loading: boolean;
    /** Whether Supabase is configured at all. */
    enabled: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    updateDisplayName: (name: string) => Promise<void>;
    /** Upload a profile picture to Wayvue storage and set it as the avatar. */
    uploadAvatar: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(isSupabaseEnabled);

    useEffect(() => {
        if (!supabase) return;

        supabase.auth.getSession().then(({ data }) => {
            setUser(data.session?.user ?? null);
            setLoading(false);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => sub.subscription.unsubscribe();
    }, []);

    // Once signed in, apply any rating the user clicked before being redirected to
    // Google (the OAuth reload would otherwise drop it). Idempotent + self-clearing.
    useEffect(() => {
        if (user) flushPendingRating(user.id);
    }, [user]);

    // Ensure a public profile exists (provisioned once from the Google profile), then
    // load it. Insert-if-missing so a user-edited name isn't overwritten on next login.
    useEffect(() => {
        if (!supabase || !user) { setProfile(null); return; }
        let cancelled = false;
        (async () => {
            const meta: any = user.user_metadata || {};
            const { data: existing } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url')
                .eq('id', user.id)
                .maybeSingle();
            if (cancelled) return;
            if (existing) {
                setProfile(existing as Profile);
                return;
            }
            const seeded: Profile = {
                id: user.id,
                display_name: meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Traveler'),
                avatar_url: meta.avatar_url || meta.picture || null,
            };
            await supabase.from('profiles').insert(seeded);
            if (!cancelled) setProfile(seeded);
        })();
        return () => { cancelled = true; };
    }, [user]);

    const signInWithGoogle = async () => {
        if (!supabase) return;
        // Mark that we're leaving for an auth redirect so the app can rebuild the trip
        // the user was on when it reloads (see the restore effect in App.tsx).
        try { sessionStorage.setItem('wayvue.authRedirect', '1'); } catch { /* ignore */ }
        // Google → Supabase → back to the app; detectSessionInUrl then picks up the
        // session from the returned URL. redirectTo must be an allowed URL in
        // Supabase → Authentication → URL Configuration.
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
        });
    };

    const signOut = async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setProfile(null);
    };

    const updateDisplayName = async (name: string) => {
        if (!supabase || !user) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        await supabase.from('profiles').update({ display_name: trimmed }).eq('id', user.id);
        setProfile(p => (p ? { ...p, display_name: trimmed } : p));
    };

    const uploadAvatar = async (file: File) => {
        if (!supabase || !user) return;
        if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
        if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB.');

        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        // One file per user, overwritten on re-upload; RLS requires the <uid> folder.
        const path = `${user.id}/avatar.${ext}`;
        const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
        if (upErr) throw upErr;

        // Cache-bust since we overwrite the same path.
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        const url = `${data.publicUrl}?v=${Date.now()}`;
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
        setProfile(p => (p ? { ...p, avatar_url: url } : p));
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, enabled: isSupabaseEnabled, signInWithGoogle, signOut, updateDisplayName, uploadAvatar }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}
