"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { getProfileData, updateProfileAction } from '@/app/actions/profile';

type CommunityIntroState = 'none' | 'ready' | 'visited';

interface UseCommunityIntroReturn {
    /** Whether to show the community nudge banner */
    showNudge: boolean;
    /** Current intro state */
    introState: CommunityIntroState;
    /** Dismiss the nudge (does NOT advance state — just hides for this session) */
    dismissNudge: () => void;
    /** Mark as visited — hides nudge permanently */
    markVisited: () => void;
    /** Increment generation count — triggers 'ready' state after 3rd generation */
    trackGeneration: () => void;
}

/**
 * Hook for progressive community introduction.
 * Reads communityIntroState ONCE at session start (piggybacks on auth context).
 * Tracks AI generation count client-side, triggers nudge after 3rd generation.
 */
export function useCommunityIntro(): UseCommunityIntroReturn {
    const { user } = useAuth();
    const [introState, setIntroState] = useState<CommunityIntroState>('visited'); // default: no nudge
    const [dismissed, setDismissed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const introStateRef = useRef<CommunityIntroState>('visited');

    // Keep ref in sync with state
    useEffect(() => {
        introStateRef.current = introState;
    }, [introState]);

    // Load communityIntroState once when user is available
    useEffect(() => {
        if (!user || loaded) return;

        getProfileData(user.uid).then(({ profile }) => {
            if (!profile) return;
            // Existing users without the field → treat as 'visited' (no nudge)
            const state = (profile.communityIntroState ?? 'visited') as CommunityIntroState;
            setIntroState(state);
            introStateRef.current = state;
            setLoaded(true);
        }).catch(() => {
            setLoaded(true);
        });
    }, [user, loaded]);

    const dismissNudge = useCallback(() => {
        setDismissed(true);
    }, []);

    const markVisited = useCallback(() => {
        setIntroState('visited');
        introStateRef.current = 'visited';
        setDismissed(true);
        if (user) {
            updateProfileAction(user.uid, { communityIntroState: 'visited' }).catch(() => {});
        }
    }, [user]);

    const trackGeneration = useCallback(() => {
        if (!user || !loaded) return;
        if (introStateRef.current !== 'none') return;
        if (typeof window === 'undefined') return;

        // Use sessionStorage to track count within this session
        const key = `sahayak_gen_count_${user.uid}`;
        const current = parseInt(sessionStorage.getItem(key) || '0', 10);
        const next = current + 1;
        sessionStorage.setItem(key, String(next));

        if (next >= 3) {
            setIntroState('ready');
            introStateRef.current = 'ready';
            updateProfileAction(user.uid, {
                communityIntroState: 'ready',
                aiGenerationCount: next,
            }).catch(() => {});
        }
    }, [user, loaded]);

    const showNudge = introState === 'ready' && !dismissed;

    return { showNudge, introState, dismissNudge, markVisited, trackGeneration };
}
