import 'server-only';
import { SAFETY_CONFIG } from './safety';

const IMAGE_RATE_LIMIT = {
    MAX_PER_DAY: 10,
};

/** Public — readers (e.g. Q4C peek gate) need the cap to compare against. */
export const IMAGE_RATE_LIMIT_MAX_PER_DAY = IMAGE_RATE_LIMIT.MAX_PER_DAY;

/**
 * Non-throwing, non-incrementing read of the current day's image counter.
 * Returns `true` when there is at least one image of budget remaining
 * for the user, `false` when the user is at or above the cap. Fails OPEN
 * (returns `true`) on infrastructure errors so the read path can never
 * suppress a legitimate user-facing image, only the OPTIONAL Q4C
 * background observation call.
 *
 * F14-002 (2026-06-06): the Q4C canary-observation block in
 * `visual-aid-dispatch.ts` and `avatar-generator-dispatch.ts` fires a
 * second `$0.04` image-gen in the background after the user-served call.
 * That second call previously double-decremented the daily image
 * counter when `generateVisualAid` / `generateAvatar` ran (each calls
 * `checkImageRateLimit` internally). At canary@10 a user requesting 5
 * images would consume 10 quota slots and rack up $0.40 of compute.
 * The dispatcher now `peek`s before firing the Q4C call and skips it
 * when the user is at the cap; the served primary call is unaffected.
 */
export async function peekImageRateLimit(userId: string): Promise<boolean> {
    try {
        const { getDb } = await import('./firebase-admin');
        const db = await getDb();
        const limitRef = db.collection('rate_limits').doc(`${userId}_image`);
        const today = getTodayIST();
        const doc = await limitRef.get();
        if (!doc.exists) return true;
        const data = doc.data();
        const count = data?.date === today ? (data?.count ?? 0) : 0;
        return count < IMAGE_RATE_LIMIT.MAX_PER_DAY;
    } catch (error: any) {
        // Fail open: never break the user path because of a peek.
        console.error('[Image Rate Limit Peek] failing open:', error?.message);
        return true;
    }
}

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
