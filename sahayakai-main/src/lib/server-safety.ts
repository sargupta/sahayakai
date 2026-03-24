import 'server-only';
import { SAFETY_CONFIG } from './safety';

const IMAGE_RATE_LIMIT = {
    MAX_PER_DAY: 10,
};

/** Get today's date string in IST (UTC+5:30) — resets at midnight India time. */
function getTodayIST(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

/**
 * Separate rate limiter for image generation (Visual Aid + Avatar).
 * Uses calendar-day reset (midnight IST) instead of a sliding 24h window,
 * so users always start fresh each day. Stores a simple { date, count }
 * instead of an ever-growing timestamp array.
 */
export async function checkImageRateLimit(userId: string): Promise<void> {
    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();

        const limitRef = db.collection('rate_limits').doc(`${userId}_image`);
        const today = getTodayIST();

        const doc = await limitRef.get();
        let count = 0;

        if (doc.exists) {
            const data = doc.data();
            // Reset count if it's a new day; otherwise use existing count
            count = data?.date === today ? (data?.count ?? 0) : 0;
        }

        if (count >= IMAGE_RATE_LIMIT.MAX_PER_DAY) {
            throw new Error(`Daily image limit reached. You can generate ${IMAGE_RATE_LIMIT.MAX_PER_DAY} images per day.`);
        }

        await limitRef.set({ date: today, count: count + 1 });

    } catch (error: any) {
        if (error.message?.includes('Daily image limit reached')) throw error;
        // Fail open on infrastructure errors
        console.error('[Image Rate Limit] Check failed (failing open):', error.message);
    }
}

/**
 * Server-side rate limiter using Firestore.
 * THROWS error if limit exceeded to abort server action.
 * ONLY import this file in Server Components or Server Actions.
 */
export async function checkServerRateLimit(userId: string): Promise<void> {
    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();

        const limitRef = db.collection('rate_limits').doc(userId);
        const now = Date.now();
        const windowStart = now - SAFETY_CONFIG.WINDOW_MS;

        const doc = await limitRef.get();
        let requests: number[] = [];

        if (doc.exists) {
            const data = doc.data();
            // Filter old timestamps
            requests = (data?.requests || []).filter((time: number) => time > windowStart);
        }

        if (requests.length >= SAFETY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
            const oldest = Math.min(...requests);
            const waitMin = Math.ceil((SAFETY_CONFIG.WINDOW_MS - (now - oldest)) / 60000);
            throw new Error(`Rate limit exceeded. Please wait ${waitMin} minutes.`);
        }

        // Add new request
        requests.push(now);
        await limitRef.set({ requests }, { merge: true });

    } catch (error: any) {
        // Re-throw if it's a legitimate rate limit error
        if (error.message?.includes("Rate limit exceeded")) throw error;

        // Fail open if anything else fails (init error, permission error, etc.)
        console.error("[Rate Limit] Check failed (failing open):", error.message);
    }
}
