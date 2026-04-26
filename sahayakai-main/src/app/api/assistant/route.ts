import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { withPlanCheck } from '@/lib/plan-guard';
import { dispatchVidya } from '@/lib/sidecar/vidya-dispatch';

// ── L1: In-process intent cache (per server instance, sub-millisecond) ────────
// Keyed on: normalised_message + "::" + screen_path
// Applied only to fresh single-turn queries (empty chat history).
//
// Phase 5 §5.7 wire-up: the cache stays in the route (above the dispatcher)
// so a hit short-circuits BOTH the Genkit and sidecar paths. This keeps
// the legacy cache contract identical while letting the dispatcher choose
// which orchestrator brain runs on a miss.
interface CacheEntry { data: unknown; ts: number }
const intentCache = new Map<string, CacheEntry>();
const L1_TTL_MS = 60 * 60 * 1000; // 1 hour

function normalisedCacheKey(message: string, path: string): string {
    const clean = message.toLowerCase().trim().replace(/\s+/g, ' ');
    return `${path}::${clean}`;
}

/** MD5 hash of the cache key — used as the Firestore document ID. */
function hashKey(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex');
}

function getCachedIntent(key: string): unknown | null {
    const entry = intentCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > L1_TTL_MS) {
        intentCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCachedIntent(key: string, data: unknown): void {
    // LRU-lite: evict the oldest entry when we hit 1 000 items
    if (intentCache.size >= 1000) {
        const firstKey = intentCache.keys().next().value;
        if (firstKey) intentCache.delete(firstKey);
    }
    intentCache.set(key, { data, ts: Date.now() });
}
// ─────────────────────────────────────────────────────────────────────────────

// ── L2: Firestore shared cache (cross-instance, 24-hour TTL) ─────────────────
const L2_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VIDYA_CACHE_COLLECTION = 'vidya_intent_cache';

async function getFirestoreCache(hash: string): Promise<unknown | null> {
    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const { FieldValue } = await import('firebase-admin/firestore');
        const db = await getDb();
        const doc = await db.collection(VIDYA_CACHE_COLLECTION).doc(hash).get();
        if (!doc.exists) return null;

        const data = doc.data()!;
        if (data.expiresAt < Date.now()) {
            db.collection(VIDYA_CACHE_COLLECTION).doc(hash).delete().catch(console.warn);
            return null;
        }

        db.collection(VIDYA_CACHE_COLLECTION).doc(hash).update({
            hitCount: FieldValue.increment(1),
            expiresAt: Date.now() + L2_TTL_MS,
        }).catch(console.warn);

        return data.response ?? null;
    } catch {
        return null; // cache errors must never break the main flow
    }
}

interface CachedAction { params?: { gradeLevel?: string; subject?: string; language?: string } }
async function setFirestoreCache(
    hash: string,
    key: string,
    response: unknown,
    action: CachedAction | null,
): Promise<void> {
    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        await db.collection(VIDYA_CACHE_COLLECTION).doc(hash).set({
            hash,
            key,
            response,
            gradeLevel: action?.params?.gradeLevel ?? null,
            subject: action?.params?.subject ?? null,
            language: action?.params?.language ?? null,
            hitCount: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + L2_TTL_MS,
        });
    } catch {
        // Non-critical — swallow silently
    }
}
// ─────────────────────────────────────────────────────────────────────────────

async function _handler(req: Request) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized: Missing User Identity' },
                { status: 401 },
            );
        }

        const body = await req.json();
        const {
            message,
            chatHistory = [],
            currentScreenContext = null,
            teacherProfile = null,
            detectedLanguage = null,
        } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Cache applies only to fresh single-turn queries (no prior conversation).
        // Multi-turn context is too personalised to be safely shared across users.
        const isFreshQuery = chatHistory.length === 0;
        const cacheKey = normalisedCacheKey(message, currentScreenContext?.path || '');
        const cacheHash = hashKey(cacheKey);

        if (isFreshQuery) {
            const l1Hit = getCachedIntent(cacheKey);
            if (l1Hit) return NextResponse.json(l1Hit);

            const l2Hit = await getFirestoreCache(cacheHash);
            if (l2Hit) {
                setCachedIntent(cacheKey, l2Hit); // warm L1
                return NextResponse.json(l2Hit);
            }
        }

        // Phase 5 §5.7 wire-up: dispatcher chooses Genkit vs sidecar
        // based on the `vidyaSidecarMode` Firestore flag (default off).
        // The dispatcher returns the same `{response, action}` shape the
        // legacy route returned, plus optional sidecar telemetry that
        // we strip before caching/responding to keep the wire shape
        // backward-compatible.
        const dispatched = await dispatchVidya({
            uid: userId,
            request: {
                message,
                chatHistory,
                currentScreenContext,
                teacherProfile,
                detectedLanguage,
            },
        });

        const wireResponse = {
            response: dispatched.response,
            action: dispatched.action,
        };

        if (isFreshQuery) {
            setCachedIntent(cacheKey, wireResponse);
            // Async, non-blocking — never awaited.
            void setFirestoreCache(
                cacheHash,
                cacheKey,
                wireResponse,
                dispatched.action as CachedAction | null,
            );
        }

        return NextResponse.json(wireResponse);

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error('[Assistant API] Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const POST = withPlanCheck('assistant')(_handler);
