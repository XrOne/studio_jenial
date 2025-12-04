import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isBetaTester: boolean;
    isAdmin: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isBetaTester, setIsBetaTester] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (!supabase) {
            console.error('Supabase client not initialized. Missing environment variables?');
            setLoading(false);
            return;
        }

        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                checkBetaStatus(session.user.email);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
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

    const checkBetaStatus = async (email: string | undefined) => {
        if (!email || !supabase) return;

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
                // You can replace this with your actual admin email
                if (email === 'ch.marrauddesgrottes@gmail.com' || email.includes('admin')) {
                    setIsAdmin(true);
                }
            } else {
                setIsBetaTester(false);
            }
        } catch (error) {
            console.error('Error checking beta status:', error);
            setIsBetaTester(false);
        } finally {
            setLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        if (!supabase) {
            alert('Authentication service not configured. Please check environment variables.');
            return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'https://www.googleapis.com/auth/cloud-platform',
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setIsBetaTester(false);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, isBetaTester, isAdmin, signInWithGoogle, signOut }}>
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
