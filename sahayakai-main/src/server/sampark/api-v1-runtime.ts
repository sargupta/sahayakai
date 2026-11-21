/**
 * The real dependencies of the Sampark Calling API routes: the database for key lookup and
 * the Firestore store behind the API's own rate limiter. Kept apart from api-v1.ts so that
 * module stays testable with fakes.
 *
 * The limiter's buckets live in the app's default database beside the keys they meter
 * (`mcp_api_keys`): they are platform bookkeeping, not Sampark data.
 */

import { getDb } from '@/lib/firebase-admin';
import type { McpAuthDb } from '@/lib/mcp/auth';
import { enforceApiRateLimit, type ApiV1Deps, type RateLimitStore } from '@/server/sampark/api-v1';

const RATE_LIMIT_COLLECTION = 'rate_limits';

const firestoreStore: RateLimitStore = {
    async transact(bucket, update) {
        const db = await getDb();
        const ref = db.collection(RATE_LIMIT_COLLECTION).doc(bucket);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const stored: unknown = snap.exists ? snap.data()?.requests : [];
            tx.set(ref, { requests: update(Array.isArray(stored) ? (stored as number[]) : []) }, { merge: true });
        });
    },
};

export const apiV1Deps: ApiV1Deps = {
    getDb: getDb as unknown as () => Promise<McpAuthDb>,
    rateLimit: (keyId, kind) => enforceApiRateLimit(firestoreStore, keyId, kind, Date.now()),
};
