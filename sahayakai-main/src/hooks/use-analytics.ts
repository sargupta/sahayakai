/**
 * React Hook: useAnalytics
 * 
 * Unified analytics hook for tracking teacher engagement and social impact
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { usePathname } from 'next/navigation';
import {
    initAnalytics,
    trackPageVisit,
    trackContentCreated,
    trackFeatureUse,
    trackChallenge,
    flushAnalytics,
    type ContentCreatedEvent,
    type ChallengeDetectedEvent,
} from '@/lib/analytics-events';
import { trackInteraction, type UserInteractionMetric } from '@/lib/performance-monitor';

export function useAnalytics() {
    const [user, setUser] = useState<User | null>(null);
    const pathname = usePathname();
    const previousPath = useRef<string>('');
    const initialized = useRef(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    // Initialize analytics on mount with user context
    useEffect(() => {
        if (user && !initialized.current) {
            initAnalytics(user.uid);
            initialized.current = true;
        }
    }, [user]);

    // Track page visits
    useEffect(() => {
        if (pathname && pathname !== previousPath.current) {
            trackPageVisit(pathname, previousPath.current || undefined);
            previousPath.current = pathname;
        }
    }, [pathname]);

    // Flush analytics on unmount
    useEffect(() => {
        return () => {
            flushAnalytics();
        };
    }, []);

    /**
     * Track content creation
     */
    const trackContent = useCallback((data: Omit<ContentCreatedEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>) => {
        trackContentCreated(data);
    }, []);

    /**
     * Track feature usage
     */
    const trackFeature = useCallback((feature: string, isFirstUse: boolean = false, daysSinceSignup?: number) => {
        trackFeatureUse(feature, isFirstUse, daysSinceSignup);
    }, []);

    /**
     * Track challenges/friction points
     */
    const trackFriction = useCallback((
        challengeType: ChallengeDetectedEvent['challenge_type'],
        severity: 'low' | 'medium' | 'high' = 'medium',
        details?: Record<string, any>
    ) => {
        trackChallenge(challengeType, severity, details);
    }, []);

    return {
        trackContent,
        trackFeature,
        trackFriction,
        trackInteraction,
    };
}

/**
 * Higher-order component to auto-track content generation
 */
export function withContentTracking<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    getMetadata: (args: Parameters<T>, result?: any, error?: any) => Omit<ContentCreatedEvent, 'event_type' | 'timestamp' | 'user_id' | 'session_id'>
): T {
    return (async (...args: Parameters<T>) => {
        const start = Date.now();

        try {
            const result = await fn(...args);
            const duration = (Date.now() - start) / 1000; // seconds

            const metadata = getMetadata(args, result);

            trackContentCreated({
                ...metadata,
                generation_time_sec: duration,
                success: true,
            });

            return result;
        } catch (error) {
            const duration = (Date.now() - start) / 1000;
            const metadata = getMetadata(args, undefined, error);

            trackContentCreated({
                ...metadata,
                generation_time_sec: duration,
                success: false,
            });

            throw error;
        }
    }) as T;
}
