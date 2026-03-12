import 'server-only';
import { SAFETY_CONFIG } from './safety';

const IMAGE_RATE_LIMIT = {
    MAX_PER_DAY: 5,
    WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Separate rate limiter for image generation (Visual Aid + Avatar).
 * Tighter cap (5/day) because each image costs ~$0.04 — 10x more than text.
 */
export async function checkImageRateLimit(userId: string): Promise<void> {
    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();

        const limitRef = db.collection('rate_limits').doc(`${userId}_image`);
        const now = Date.now();
        const windowStart = now - IMAGE_RATE_LIMIT.WINDOW_MS;

        const doc = await limitRef.get();
        let requests: number[] = [];

        if (doc.exists) {
            const data = doc.data();
            requests = (data?.requests || []).filter((time: number) => time > windowStart);
        }

        if (requests.length >= IMAGE_RATE_LIMIT.MAX_PER_DAY) {
            throw new Error(`Daily image limit reached. You can generate ${IMAGE_RATE_LIMIT.MAX_PER_DAY} images per day.`);
        }

        requests.push(now);
        await limitRef.set({ requests }, { merge: true });

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
