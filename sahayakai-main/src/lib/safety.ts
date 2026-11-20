/**
 * Generations per teacher per window (browser AND server). 15 unless a local demo raises it with
 * NEXT_PUBLIC_SAHAYAK_RATE_LIMIT_PER_WINDOW (development only — a live demo clicks through many
 * on-screen templates in a few minutes, and even instant cached answers counted towards it).
 */
export function maxRequestsPerWindow(env: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SAHAYAK_RATE_LIMIT_PER_WINDOW: process.env.NEXT_PUBLIC_SAHAYAK_RATE_LIMIT_PER_WINDOW,
}): number {
    const n = Number(env.NEXT_PUBLIC_SAHAYAK_RATE_LIMIT_PER_WINDOW);
    return env.NODE_ENV === 'development' && Number.isInteger(n) && n > 0 ? n : 15;
}

export const SAFETY_CONFIG = {
    MAX_REQUESTS_PER_WINDOW: maxRequestsPerWindow(),
    WINDOW_MS: 10 * 60 * 1000, // 10 Minutes
    COOLDOWN_STORAGE_KEY: 'sahayak_rate_limit'
};

/**
 * Simple client-side rate limiter using Token Bucket logic
 */
export function checkRateLimit(): { allowed: boolean; waitTime?: number } {
    if (typeof window === 'undefined') return { allowed: true };

    try {
        const raw = localStorage.getItem(SAFETY_CONFIG.COOLDOWN_STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : { requests: [] };
        const now = Date.now();

        // Filter out old timestamps
        const recentRequests = data.requests.filter((time: number) => now - time < SAFETY_CONFIG.WINDOW_MS);

        if (recentRequests.length >= SAFETY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
            const oldestRequest = Math.min(...recentRequests);
            const waitTime = SAFETY_CONFIG.WINDOW_MS - (now - oldestRequest);
            return { allowed: false, waitTime };
        }

        // Add new request
        recentRequests.push(now);
        localStorage.setItem(SAFETY_CONFIG.COOLDOWN_STORAGE_KEY, JSON.stringify({ requests: recentRequests }));

        return { allowed: true };

    } catch (e) {
        // Fallback to allow if storage fails
        console.error("Rate limiter error", e);
        return { allowed: true };
    }
}

/**
 * Basic safety pre-scan for topics
 */
export function validateTopicSafety(topic: string): { safe: boolean; reason?: string } {
    const unsafePatterns = [
        // ... existing patterns ...
        /bomb/i, /explosive/i, /terror/i, /suicide/i, /kill/i,
        /porn/i, /sex/i, /nude/i, /gambl/i,
        /cheat exam/i, /hack/i, /ignore previous/i, /override system/i, /you are not/i
    ];

    for (const pattern of unsafePatterns) {
        if (pattern.test(topic)) {
            return { safe: false, reason: "Content Policy Violation" };
        }
    }
    return { safe: true };
}

// Server-side logic moved to src/lib/server-safety.ts to avoid client bundle errors.
