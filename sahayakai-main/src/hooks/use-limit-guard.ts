'use client';

import { useState } from 'react';

interface LimitState {
    /** Whether the user has hit a usage limit */
    limitReached: boolean;
    /** Whether the user needs to upgrade their plan */
    upgradeRequired: boolean;
    /** Whether the AI service is temporarily busy (quota exhausted upstream) */
    serviceBusy: boolean;
    /** Seconds before it's worth retrying (from Retry-After header) */
    retryAfterSeconds: number | null;
    /** Error message from the API */
    message: string | null;
    /** Feature name (e.g., 'lesson-plan') */
    feature: string | null;
    /** How many they've used */
    used: number | null;
    /** Their limit */
    limit: number | null;
}

const INITIAL_STATE: LimitState = {
    limitReached: false,
    upgradeRequired: false,
    serviceBusy: false,
    retryAfterSeconds: null,
    message: null,
    feature: null,
    used: null,
    limit: null,
};

/**
 * Hook for feature pages to handle plan-gated API responses.
 *
 * Usage:
 *   const { checkResponse, limitState, clearLimit } = useLimitGuard();
 *
 *   const res = await fetch('/api/ai/lesson-plan', ...);
 *   if (!res.ok) {
 *     if (checkResponse(res.status, errorBody)) return; // limit hit, UI handled
 *     // else: handle other errors normally
 *   }
 *
 * Then in JSX:
 *   {limitState.limitReached && <UpgradePrompt feature={...} used={...} limit={...} />}
 */
export function useLimitGuard() {
    const [limitState, setLimitState] = useState<LimitState>(INITIAL_STATE);

    /**
     * Check if an API error is a plan/usage limit.
     * Returns true if it was a limit error (UI should show UpgradePrompt).
     * Returns false if it was a different error.
     */
    const checkResponse = (status: number, body: Record<string, unknown>): boolean => {
        if (status === 403 && body.error === 'PLAN_UPGRADE_REQUIRED') {
            setLimitState({
                ...INITIAL_STATE,
                upgradeRequired: true,
                message: (body.message as string) || 'This feature requires a paid plan.',
                feature: (body.feature as string) || null,
            });
            return true;
        }

        if (status === 429 && (body.error === 'USAGE_LIMIT_REACHED' || body.error === 'DAILY_LIMIT_REACHED')) {
            setLimitState({
                ...INITIAL_STATE,
                limitReached: true,
                message: (body.message as string) || 'You have reached your usage limit.',
                feature: (body.feature as string) || null,
                used: (body.used as number) ?? null,
                limit: (body.limit as number) ?? null,
            });
            return true;
        }

        // AI upstream quota exhausted — this is transient, not a user's own limit.
        // Client should show "try again in a minute" instead of an upgrade prompt.
        if (status === 503 && body.error === 'AI_SERVICE_BUSY') {
            setLimitState({
                ...INITIAL_STATE,
                serviceBusy: true,
                message: (body.message as string) || 'AI service is busy. Please try again in a minute.',
                feature: (body.feature as string) || null,
                retryAfterSeconds: (body.retryAfterSeconds as number) ?? 60,
            });
            return true;
        }

        return false;
    };

    const clearLimit = () => setLimitState(INITIAL_STATE);

    return { limitState, checkResponse, clearLimit };
}
