'use client';

/**
 * Client-side wrapper for AI API calls that handles subscription errors gracefully.
 *
 * Usage:
 *   const { data, error, upgradeRequired, limitReached } = await aiFetch('/api/ai/lesson-plan', body, token);
 */

export interface AiFetchResult<T = any> {
    data: T | null;
    error: string | null;
    /** User needs to upgrade their plan */
    upgradeRequired: boolean;
    /** User hit their usage limit for this feature */
    limitReached: boolean;
    /** Details from the error response */
    details: {
        feature?: string;
        requiredPlan?: string;
        currentPlan?: string;
        used?: number;
        limit?: number;
    } | null;
}

export async function aiFetch<T = any>(
    url: string,
    body: Record<string, any>,
    token: string
): Promise<AiFetchResult<T>> {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        if (res.ok) {
            const data = await res.json();
            return { data, error: null, upgradeRequired: false, limitReached: false, details: null };
        }

        const errorBody = await res.json().catch(() => ({ error: 'Unknown error' }));

        if (res.status === 403 && errorBody.error === 'PLAN_UPGRADE_REQUIRED') {
            return {
                data: null,
                error: errorBody.message || 'This feature requires a paid plan.',
                upgradeRequired: true,
                limitReached: false,
                details: {
                    feature: errorBody.feature,
                    requiredPlan: errorBody.requiredPlan,
                    currentPlan: errorBody.currentPlan,
                },
            };
        }

        if (res.status === 429 && (errorBody.error === 'USAGE_LIMIT_REACHED' || errorBody.error === 'DAILY_LIMIT_REACHED')) {
            return {
                data: null,
                error: errorBody.message || 'You have reached your usage limit.',
                upgradeRequired: false,
                limitReached: true,
                details: {
                    feature: errorBody.feature,
                    used: errorBody.used,
                    limit: errorBody.limit,
                    currentPlan: errorBody.currentPlan,
                },
            };
        }

        return {
            data: null,
            error: errorBody.error || `Request failed (${res.status})`,
            upgradeRequired: false,
            limitReached: false,
            details: null,
        };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : 'Network error',
            upgradeRequired: false,
            limitReached: false,
            details: null,
        };
    }
}
