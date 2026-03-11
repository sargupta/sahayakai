"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, onIdTokenChanged, User } from 'firebase/auth';
import { initAnalytics, trackSessionStart, trackSessionEnd, flushAnalytics } from '@/lib/analytics-events';
import { syncUserAction } from '@/app/actions/auth';
import { startTeacherSession, endTeacherSession } from '@/lib/teacher-activity-tracker';

// Keep the auth-token cookie in sync with Firebase's token lifecycle.
// onIdTokenChanged fires on login AND on automatic token refresh (~every 55 min),
// so the cookie stays fresh. Middleware reads this cookie to inject x-user-id
// into server actions, which don't carry an Authorization header.
function syncAuthCookie(token: string | null) {
    if (typeof document === 'undefined') return;
    if (token) {
        const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
        document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Strict${secure}`;
    } else {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
}

type AuthContextType = {
    user: User | null;
    loading: boolean;
    isAuthModalOpen: boolean;
    openAuthModal: () => void;
    closeAuthModal: () => void;
    requireAuth: () => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    // Sync Firebase ID token → auth-token cookie on every token refresh
    useEffect(() => {
        const unsubToken = onIdTokenChanged(auth, async (currentUser) => {
            if (currentUser) {
                const token = await currentUser.getIdToken();
                syncAuthCookie(token);
            } else {
                syncAuthCookie(null);
            }
        });
        return () => unsubToken();
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // Handle logout (was logged in, now logged out)
            if (user && !currentUser) {
                // FIX (Bug #1): End teacher activity tracking session
                endTeacherSession();
                trackSessionEnd({
                    duration_minutes: 0, // Will be calculated by tracker
                    pages_visited: [],
                    features_used: [],
                    content_created_count: 0,
                });
                flushAnalytics();
            }

            setUser(currentUser);
            setLoading(false);

            // Handle login (wasn't logged in, now logged in)
            if (currentUser && !user) {
                // Initialize analytics with user ID
                initAnalytics(currentUser.uid);

                // Sync user profile to Firestore (Create/Update)
                syncUserAction({
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL
                }).catch(err => console.error("Profile sync failed:", err));

                // FIX (Bug #1): Start teacher activity tracker with real userId
                // This initializes the singleton so trackTeacherContent() starts firing events
                startTeacherSession(currentUser.uid, {
                    preferred_language: 'en',
                });

                // Track session start (for legacy analytics events system)
                trackSessionStart({
                    device_type: getDeviceType(),
                    preferred_language: 'en', // Will be updated from user profile
                });

                // Close modal automatically if user logs in
                setIsAuthModalOpen(false);
            }
        });

        return () => {
            unsubscribe();
            // Flush analytics on unmount
            flushAnalytics();
        };
    }, [user]);


    const openAuthModal = () => setIsAuthModalOpen(true);
    const closeAuthModal = () => setIsAuthModalOpen(false);

    const requireAuth = (): boolean => {
        // [DEVELOPMENT BYPASS] Skip auth modal on localhost
        if (process.env.NODE_ENV === 'development') return true;

        if (!user) {
            openAuthModal();
            return false;
        }
        return true;
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthModalOpen,
            openAuthModal,
            closeAuthModal,
            requireAuth
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// Helper function to detect device type
function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    if (typeof window === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
