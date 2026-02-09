"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { initAnalytics, trackSessionStart, trackSessionEnd, flushAnalytics } from '@/lib/analytics-events';

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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // Handle logout (was logged in, now logged out)
            if (user && !currentUser) {
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

                // Track session start
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
