/**
 * The real dependencies of the Sampark Calling API routes: the API-key check and the Firestore
 * store behind the API's own rate limiter. Kept apart from api-v1.ts so that module stays
 * testable with fakes and never opens a database itself.
 *
 * Both live in the app's DEFAULT database on purpose, like the keys themselves
 * (`mcp_api_keys`, read by src/lib/mcp/auth.ts): they are platform credentials and their
 * metering, not Sampark data. Declared in the Sampark database gate
 * (gate-sampark-stores-use-the-sampark-database.test.ts) with the one collection opened here.
 */

import { getDb } from '@/lib/firebase-admin';
import { authenticateMcpRequest, type McpAuthDb } from '@/lib/mcp/auth';
import { enforceApiRateLimit, SAMPARK_API_SCOPE, type ApiV1Deps, type RateLimitStore } from '@/server/sampark/api-v1';

const firestoreStore: RateLimitStore = {
    async transact(bucket, update) {
        const db = await getDb();
        const ref = db.collection('rate_limits').doc(bucket);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const stored: unknown = snap.exists ? snap.data()?.requests : [];
            tx.set(ref, { requests: update(Array.isArray(stored) ? (stored as number[]) : []) }, { merge: true });
        });
    },
};

export const apiV1Deps: ApiV1Deps = {
    authenticate: (headers) => authenticateMcpRequest(headers, SAMPARK_API_SCOPE, { getDb: getDb as unknown as () => Promise<McpAuthDb> }),
    rateLimit: (keyId, kind) => enforceApiRateLimit(firestoreStore, keyId, kind, Date.now()),
};
