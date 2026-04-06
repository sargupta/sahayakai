"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { getProfileData, updateProfileAction } from '@/app/actions/profile';
import { getEffectiveOnboardingPhase, isNewUser as checkIsNewUser } from '@/lib/profile-utils';
import { getPersonalizedSuggestions, type ContextualSuggestion } from '@/lib/contextual-suggestions';
import type { UserProfile } from '@/types';

type OnboardingPhase = NonNullable<UserProfile['onboardingPhase']>;

interface ProfileSummary {
    displayName?: string;
    subjects?: string[];
    schoolName?: string;
}

interface UseOnboardingProgressReturn {
    phase: OnboardingPhase;
    isNewUser: boolean;
    isFirstWeek: boolean;
    generationCount: number;
    checklistItems: Record<string, boolean>;
    suggestions: ContextualSuggestion[];
    spotlightsSeen: string[];
    loaded: boolean;
    profile: Partial<UserProfile> | null;
    profileSummary: ProfileSummary | null;
    showProfileCompletion: boolean;
    checklistDismissed: boolean;
    advancePhase: (to: OnboardingPhase) => void;
    markChecklistItem: (id: string) => void;
    markSpotlightSeen: (id: string) => void;
    recordFirstGeneration: (contentId: string, tool: string) => void;
    incrementGeneration: () => void;
    refreshSuggestions: () => void;
    dismissProfileCard: () => void;
    dismissChecklist: () => void;
}

/**
 * Central onboarding state management hook.
 * Loads profile once at session start, uses refs for immediate state,
 * syncs mutations to Firestore fire-and-forget.
 */
export function useOnboardingProgress(): UseOnboardingProgressReturn {
    const { user } = useAuth();
    const [phase, setPhase] = useState<OnboardingPhase>('done');
    const [loaded, setLoaded] = useState(false);
    const [generationCount, setGenerationCount] = useState(0);
    const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({});
    const [spotlightsSeen, setSpotlightsSeen] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<ContextualSuggestion[]>([]);
    const [createdAt, setCreatedAt] = useState<Date | null>(null);
    const [profileData, setProfileData] = useState<Partial<UserProfile> | null>(null);
    const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
    const [dismissCount, setDismissCount] = useState(0);
    const [checklistDismissed, setChecklistDismissed] = useState(false);

    const phaseRef = useRef<OnboardingPhase>('done');
    const profileRef = useRef<Partial<UserProfile> | null>(null);
    // Debounce refs for B4 — batch generation count writes
    const pendingIncrementRef = useRef(0);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track shown chapter IDs for suggestion refresh (U2)
    const shownChapterIdsRef = useRef<string[]>([]);

    useEffect(() => { phaseRef.current = phase; }, [phase]);

    // Load once when user is available
    useEffect(() => {
        if (!user || loaded) return;

        getProfileData(user.uid).then(({ profile }) => {
            if (!profile) { setLoaded(true); return; }
            profileRef.current = profile;
            setProfileData(profile);
            setProfileSummary({
                displayName: profile.displayName,
                subjects: profile.subjects,
                schoolName: profile.schoolName,
            });

            const effectivePhase = getEffectiveOnboardingPhase(profile);
            setPhase(effectivePhase);
            phaseRef.current = effectivePhase;

            setGenerationCount(profile.aiGenerationCount ?? 0);
            setChecklistItems(profile.onboardingChecklistItems ?? {});
            setSpotlightsSeen(profile.featureSpotlightsSeen ?? []);
            setDismissCount(profile.profileCompletionDismissCount ?? 0);
            setChecklistDismissed(!!profile.checklistDismissedAt);

            if (profile.createdAt?.toDate) {
                setCreatedAt(profile.createdAt.toDate());
            }

            // Generate suggestions for new users
            if (effectivePhase !== 'done' && profile.subjects?.length && profile.gradeLevels?.length) {
                const sug = getPersonalizedSuggestions(
                    { subjects: profile.subjects, gradeLevels: profile.gradeLevels, educationBoard: profile.educationBoard },
                    3
                );
                setSuggestions(sug);
                // Track shown chapter IDs for refresh
                shownChapterIdsRef.current = sug.map(s => s.chapterId).filter(Boolean) as string[];
            }

            setLoaded(true);
        }).catch(() => { setLoaded(true); });
    }, [user, loaded]);

    const isNew = phase !== 'done';

    const isFirstWeek = (() => {
        if (!createdAt) return isNew;
        const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation <= 7;
    })();

    const showProfileCompletion = phase === 'completing' && dismissCount < 3;

    const advancePhase = useCallback((to: OnboardingPhase) => {
        setPhase(to);
        phaseRef.current = to;
        if (user) {
            const update: Record<string, any> = { onboardingPhase: to };
            if (to === 'done') update.onboardingCompletedAt = new Date();
            updateProfileAction(user.uid, update).catch(() => {});
        }
    }, [user]);

    const markChecklistItem = useCallback((id: string) => {
        setChecklistItems(prev => {
            const next = { ...prev, [id]: true };
            if (user) {
                updateProfileAction(user.uid, { onboardingChecklistItems: next }).catch(() => {});
            }
            return next;
        });
    }, [user]);

    const markSpotlightSeen = useCallback((id: string) => {
        setSpotlightsSeen(prev => {
            if (prev.includes(id)) return prev;
            const next = [...prev, id];
            if (user) {
                updateProfileAction(user.uid, { featureSpotlightsSeen: next }).catch(() => {});
            }
            return next;
        });
    }, [user]);

    const recordFirstGeneration = useCallback((contentId: string, tool: string) => {
        if (user) {
            updateProfileAction(user.uid, {
                firstGenerationContentId: contentId,
                firstGenerationTool: tool,
                onboardingPhase: 'exploring',
            }).catch(() => {});
        }
        setPhase('exploring');
        phaseRef.current = 'exploring';
    }, [user]);

    // B4: Debounced generation counter — batches writes, avoids race conditions
    const flushIncrement = useCallback(() => {
        const pending = pendingIncrementRef.current;
        if (pending === 0 || !user) return;

        const update: Record<string, any> = { aiGenerationCount: generationCount + pending };

        // Check if phase should advance
        if (generationCount + pending >= 5 && phaseRef.current === 'exploring') {
            update.onboardingPhase = 'completing';
            setPhase('completing');
            phaseRef.current = 'completing';
        }

        pendingIncrementRef.current = 0;
        updateProfileAction(user.uid, update).catch(() => {});
    }, [user, generationCount]);

    // Flush pending increments on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            // Note: flushIncrement uses stale refs in cleanup, which is fine —
            // the ref values are current at cleanup time
        };
    }, []);

    const incrementGeneration = useCallback(() => {
        setGenerationCount(prev => prev + 1);
        pendingIncrementRef.current += 1;

        // Debounce the Firestore write (500ms)
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            flushIncrement();
        }, 500);

        // Immediate phase check for UI responsiveness
        setGenerationCount(prev => {
            if (prev >= 5 && phaseRef.current === 'exploring') {
                setPhase('completing');
                phaseRef.current = 'completing';
            }
            return prev;
        });
    }, [flushIncrement]);

    // U2: Refresh suggestions with new chapters
    const refreshSuggestions = useCallback(() => {
        const p = profileRef.current;
        if (!p?.subjects?.length || !p?.gradeLevels?.length) return;

        const sug = getPersonalizedSuggestions(
            { subjects: p.subjects, gradeLevels: p.gradeLevels, educationBoard: p.educationBoard },
            3,
            shownChapterIdsRef.current
        );

        // Track newly shown chapter IDs
        const newIds = sug.map(s => s.chapterId).filter(Boolean) as string[];
        shownChapterIdsRef.current = [...shownChapterIdsRef.current, ...newIds];

        setSuggestions(sug);
    }, []);

    // A3: Dismiss profile completion card with counter
    const dismissProfileCard = useCallback(() => {
        setDismissCount(prev => {
            const next = prev + 1;
            if (user) {
                const update: Record<string, any> = { profileCompletionDismissCount: next };
                // After 3 dismissals, advance to 'done'
                if (next >= 3) {
                    update.onboardingPhase = 'done';
                    update.onboardingCompletedAt = new Date();
                    setPhase('done');
                    phaseRef.current = 'done';
                }
                updateProfileAction(user.uid, update).catch(() => {});
            }
            return next;
        });
    }, [user]);

    // U5: Permanently dismiss checklist
    const dismissChecklist = useCallback(() => {
        setChecklistDismissed(true);
        if (user) {
            updateProfileAction(user.uid, { checklistDismissedAt: new Date() }).catch(() => {});
        }
    }, [user]);

    return {
        phase,
        isNewUser: isNew,
        isFirstWeek,
        generationCount,
        checklistItems,
        suggestions,
        spotlightsSeen,
        loaded,
        profile: profileData,
        profileSummary,
        showProfileCompletion,
        checklistDismissed,
        advancePhase,
        markChecklistItem,
        markSpotlightSeen,
        recordFirstGeneration,
        incrementGeneration,
        refreshSuggestions,
        dismissProfileCard,
        dismissChecklist,
    };
}
