import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, authService } from '../services/supabase';
import { api } from '../services/api';
import { getExpoPushToken } from '../lib/appNotifications';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Check initial session
        checkSession();

        // Listen for auth changes
        const { data: { subscription } } = authService.onAuthStateChange(
            async (event, session) => {
                console.log('[AUTH] State changed:', event);
                setSession(session);
                setUser(session?.user ?? null);
                setIsAuthenticated(!!session?.user);
            }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    const checkSession = async () => {
        try {
            const { session, error } = await authService.getSession();
            if (error) {
                console.error('[AUTH] Session check error:', error);
            }
            setSession(session);
            setUser(session?.user ?? null);
            setIsAuthenticated(!!session?.user);
        } catch (error) {
            console.error('[AUTH] Session check failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendOtp = async (phone) => {
        try {
            const { data, error } = await authService.sendOtp(phone);
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('[AUTH] Send OTP error:', error);
            return { success: false, error: error.message };
        }
    };

    const verifyOtp = async (phone, token) => {
        try {
            const { data, error } = await authService.verifyOtp(phone, token);
            if (error) throw error;
            // Persisted session in AsyncStorage is source of truth (fixes payment / API token race)
            const { session: persisted } = await authService.getSession();
            const session = persisted ?? data?.session ?? null;
            const user = session?.user ?? data?.user ?? null;
            setSession(session);
            setUser(user);
            setIsAuthenticated(!!user);
            return { success: true, data: { ...data, session, user } };
        } catch (error) {
            console.error('[AUTH] Verify OTP error:', error);
            return { success: false, error: error.message };
        }
    };

    const refreshSession = useCallback(async () => {
        const { session, error } = await authService.refreshSessionTokens();
        if (error) {
            console.error('[AUTH] refreshSession:', error);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
        return session;
    }, []);

    const signInWithGoogle = async () => {
        try {
            const { data, error } = await authService.signInWithGoogle();
            if (error) {
                if (error.silent || error.message === 'CANCELLED') return { success: false, error: null };
                throw error;
            }
            return { success: true, data };
        } catch (error) {
            console.error('[AUTH] Google sign-in error:', error);
            return { success: false, error: error.message };
        }
    };

    const signOut = async () => {
        try {
            const accessToken = session?.access_token || null;
            if (accessToken) {
                try {
                    const pushToken = await getExpoPushToken();
                    if (pushToken) {
                        await api.unregisterPushToken(pushToken, accessToken);
                    }
                } catch {
                    /* non-fatal */
                }
            }
            const { error } = await authService.signOut();
            if (error) {
                console.warn('[AUTH] Sign out:', error.message || error);
            }
        } catch (error) {
            console.warn('[AUTH] Sign out:', error?.message || error);
        } finally {
            setUser(null);
            setSession(null);
            setIsAuthenticated(false);
        }
        return { success: true };
    };

    const value = {
        user,
        session,
        loading,
        isAuthenticated,
        sendOtp,
        verifyOtp,
        signInWithGoogle,
        signOut,
        checkSession,
        refreshSession,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;

