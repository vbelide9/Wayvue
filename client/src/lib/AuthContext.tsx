// Auth state for Wayvue's community features, backed by Supabase Auth (Google OAuth).
//
// Degrades gracefully: when Supabase isn't configured (`enabled === false`), there is
// no user and sign-in is a no-op, so any consumer can render normally.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseEnabled } from './supabase';
import { flushPendingRating } from './pendingRating';

interface AuthValue {
    user: User | null;
    /** True until the initial session lookup resolves (false immediately if disabled). */
    loading: boolean;
    /** Whether Supabase is configured at all. */
    enabled: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
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
    };

    return (
        <AuthContext.Provider value={{ user, loading, enabled: isSupabaseEnabled, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}
