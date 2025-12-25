import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

// ============================================================================
// OFFLINE BYPASS MODE
// When Supabase is unreachable, we create a mock user to allow local development
// ============================================================================
const OFFLINE_MODE_KEY = 'studio_jenial_offline_mode';
const OFFLINE_USER_KEY = 'studio_jenial_offline_user';

const createOfflineUser = (): User => ({
    id: 'offline-user-' + Date.now(),
    email: 'offline@local.dev',
    app_metadata: {},
    user_metadata: { full_name: 'Offline User', avatar_url: '' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
} as User);

const createOfflineSession = (user: User): Session => ({
    access_token: 'offline-token-' + Date.now(),
    refresh_token: 'offline-refresh',
    expires_in: 3600 * 24 * 365,
    expires_at: Date.now() / 1000 + 3600 * 24 * 365,
    token_type: 'bearer',
    user,
} as Session);

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isBetaTester: boolean;
    isAdmin: boolean;
    isOfflineMode: boolean;
    providerToken: string | null;
    signInWithGoogle: () => Promise<void>;
    signInOffline: () => void;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isBetaTester, setIsBetaTester] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    useEffect(() => {
        // Check if we're in offline mode from previous session
        const wasOffline = localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
        if (wasOffline) {
            const savedUser = localStorage.getItem(OFFLINE_USER_KEY);
            if (savedUser) {
                try {
                    const offlineUser = JSON.parse(savedUser) as User;
                    setUser(offlineUser);
                    setSession(createOfflineSession(offlineUser));
                    setIsOfflineMode(true);
                    setIsBetaTester(true); // Grant access in offline mode
                    setLoading(false);
                    console.log('🔌 OFFLINE MODE: Restored from localStorage');
                    return;
                } catch (e) {
                    console.error('Failed to restore offline session:', e);
                }
            }
        }

        if (!supabase) {
            console.error('Supabase client not initialized. Activating offline fallback...');
            activateOfflineMode();
            return;
        }

        // Try to get session from Supabase with timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase timeout')), 5000)
        );

        Promise.race([sessionPromise, timeoutPromise])
            .then((result: any) => {
                const session = result?.data?.session;
                setSession(session);
                console.log('Auth Session Update:', {
                    hasSession: !!session,
                    hasProviderToken: !!session?.provider_token,
                    providerTokenLength: session?.provider_token?.length
                });
                setUser(session?.user ?? null);
                if (session?.user) {
                    checkBetaStatus(session.user.email);
                } else {
                    setLoading(false);
                }
            })
            .catch((error) => {
                console.warn('⚠️ Supabase unreachable:', error.message);
                console.log('🔌 Activating OFFLINE MODE...');
                activateOfflineMode();
            });

        // Listen for auth changes (only if supabase is available)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isOfflineMode) return; // Ignore if in offline mode

            setSession(session);
            console.log('Auth Session Update:', {
                hasSession: !!session,
                hasProviderToken: !!session?.provider_token,
                providerTokenLength: session?.provider_token?.length
            });
            setUser(session?.user ?? null);
            if (session?.user) {
                checkBetaStatus(session.user.email);
            } else {
                setIsBetaTester(false);
                setIsAdmin(false);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const activateOfflineMode = () => {
        const offlineUser = createOfflineUser();
        const offlineSession = createOfflineSession(offlineUser);

        setUser(offlineUser);
        setSession(offlineSession);
        setIsOfflineMode(true);
        setIsBetaTester(true); // Grant beta access in offline mode
        setIsAdmin(true); // Grant admin for local dev
        setLoading(false);

        // Persist offline state
        localStorage.setItem(OFFLINE_MODE_KEY, 'true');
        localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(offlineUser));

        console.log('✅ OFFLINE MODE ACTIVATED - Full access granted for local development');
    };

    const checkBetaStatus = async (email: string | undefined) => {
        if (!email || !supabase) {
            setIsBetaTester(true); // Default to true when can't verify
            setLoading(false);
            return;
        }

        try {
            // Check if user is in beta_testers table
            const { data, error } = await supabase
                .from('beta_testers')
                .select('email')
                .eq('email', email)
                .single();

            if (data) {
                setIsBetaTester(true);
                // Hardcoded admin check for now (or add role column later)
                if (email === 'ch.marrauddesgrottes@gmail.com' || email.includes('admin')) {
                    setIsAdmin(true);
                }
            } else {
                setIsBetaTester(false);
            }
        } catch (error) {
            console.error('Error checking beta status:', error);
            setIsBetaTester(true); // Default to true on error
        } finally {
            setLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        if (!supabase) {
            console.warn('Supabase unavailable, using offline mode');
            activateOfflineMode();
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: 'https://www.googleapis.com/auth/cloud-platform',
                    redirectTo: window.location.origin,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error('Google sign-in failed, activating offline mode:', error);
            activateOfflineMode();
        }
    };

    const signInOffline = () => {
        activateOfflineMode();
    };

    const signOut = async () => {
        if (!isOfflineMode && supabase) {
            try {
                await supabase.auth.signOut();
            } catch (e) {
                console.warn('Sign out from Supabase failed:', e);
            }
        }

        // Clear offline state
        localStorage.removeItem(OFFLINE_MODE_KEY);
        localStorage.removeItem(OFFLINE_USER_KEY);

        setUser(null);
        setSession(null);
        setIsBetaTester(false);
        setIsOfflineMode(false);
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            loading,
            isBetaTester,
            isAdmin,
            isOfflineMode,
            providerToken: session?.provider_token ?? null,
            signInWithGoogle,
            signInOffline,
            signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
