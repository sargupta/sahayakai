import 'server-only';
import { SAFETY_CONFIG } from './safety';

/**
 * Server-side rate limiter using Firestore.
 * THROWS error if limit exceeded to abort server action.
 * ONLY import this file in Server Components or Server Actions.
 */
export async function checkServerRateLimit(userId: string): Promise<void> {
    const { getDb } = await import('./firebase-admin');
    const db = await getDb();

    const limitRef = db.collection('rate_limits').doc(userId);
    const now = Date.now();
    const windowStart = now - SAFETY_CONFIG.WINDOW_MS;

    try {
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
        if (error.message.includes("Rate limit")) throw error;
        // Fail open if DB error (don't block user due to infrastructure)
        console.error("Rate limit check failed:", error);
    }
}
