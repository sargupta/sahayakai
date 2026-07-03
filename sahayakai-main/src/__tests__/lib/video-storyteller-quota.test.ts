/**
 * Video Storyteller daily quota — server-side enforcement on the most
 * expensive flow (Gemini categorization + YouTube fan-out).
 *
 *  - free tier: 3/day, paid tiers: 30/day (DAILY_FEATURE_QUOTAS)
 *  - 429 contract identical to the plan-guard gated tools
 *  - unauthenticated → 401 before any quota/AI work
 *  - failed dispatch rolls the reserved unit back
 */

// The project's jsdom test env doesn't preserve NextResponse.json bodies
// through `await res.json()` — mirror assessment-scanner.test.ts and mock it.
jest.mock('next/server', () => ({
    NextResponse: {
        json: (data: unknown, init?: { status?: number }) => ({
            status: init?.status ?? 200,
            ok: (init?.status ?? 200) < 400,
            json: async () => data,
            text: async () => JSON.stringify(data),
            headers: new Map(),
        }),
    },
}));

// ── In-memory Firestore fake (users + daily_user_usage) ────────────────────

let store: Record<string, any> = {};

function applyMerge(path: string, data: Record<string, any>) {
    const target = { ...(store[path] ?? {}) };
    for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && '__inc' in v) {
            target[k] = (target[k] ?? 0) + (v as any).__inc;
        } else {
            target[k] = v;
        }
    }
    store[path] = target;
}

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        increment: (n: number) => ({ __inc: n }),
        serverTimestamp: () => '__ts__',
    },
}));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (col: string) => ({
            doc: (id: string) => {
                const path = `${col}/${id}`;
                return {
                    path,
                    get: async () => ({ exists: path in store, data: () => store[path] }),
                    set: async (data: any, _opts?: any) => applyMerge(path, data),
                };
            },
        }),
        runTransaction: async (fn: (tx: any) => Promise<any>) =>
            fn({
                get: async (ref: any) => ref.get(),
                set: (ref: any, data: any, _opts?: any) => applyMerge(ref.path, data),
            }),
    }),
}));

const dispatchMock = jest.fn();
jest.mock('@/lib/sidecar/video-storyteller-dispatch', () => ({
    dispatchVideoStoryteller: (...args: any[]) => dispatchMock(...args),
}));

jest.mock('@/lib/ai-error-response', () => ({
    logAIError: jest.fn(),
}));

import { POST } from '@/app/api/ai/video-storyteller/route';
import { DAILY_FEATURE_QUOTAS, reserveDailyQuota, rollbackDailyQuota } from '@/lib/usage-tracker';

function makeReq(userId: string | null, body: Record<string, unknown> = {}) {
    return {
        headers: {
            get: (name: string) => (name.toLowerCase() === 'x-user-id' ? userId : null),
        },
        json: async () => body,
    } as unknown as Request;
}

function todayUTC(): string {
    return new Date().toISOString().split('T')[0];
}

const OK_RESULT = {
    categories: { pedagogy: [], storytelling: [], govtUpdates: [], courses: [], topRecommended: [] },
    personalizedMessage: 'hi',
    categorizedVideos: {},
    fromCache: false,
    latencyScore: 1,
};

beforeEach(() => {
    store = {};
    dispatchMock.mockReset().mockResolvedValue(OK_RESULT);
    store['users/free_user'] = { planType: 'free' };
    store['users/premium_user'] = { planType: 'premium' };
});

describe('POST /api/ai/video-storyteller — daily quota gate', () => {
    test('unauthenticated → 401, no quota consumed, no AI dispatched', async () => {
        const res = await POST(makeReq(null));
        expect(res.status).toBe(401);
        expect(dispatchMock).not.toHaveBeenCalled();
        expect(store[`daily_user_usage/free_user_${todayUTC()}`]).toBeUndefined();
    });

    test('free tier: 3 calls succeed, 4th → 429 with the standard gated-tool contract', async () => {
        expect(DAILY_FEATURE_QUOTAS.video_storyteller.free).toBe(3);

        for (let i = 0; i < 3; i++) {
            const res = await POST(makeReq('free_user'));
            expect(res.status).toBe(200);
        }
        expect(dispatchMock).toHaveBeenCalledTimes(3);

        const res = await POST(makeReq('free_user'));
        expect(res.status).toBe(429);
        const body = await res.json();
        // Contract must match plan-guard's 429 so useLimitGuard/UpgradePrompt work.
        expect(body).toMatchObject({
            error: 'DAILY_LIMIT_REACHED',
            used: 3,
            limit: 3,
            feature: 'video-storyteller',
            currentPlan: 'free',
        });
        expect(typeof body.message).toBe('string');
        // Blocked call never reached the expensive AI path.
        expect(dispatchMock).toHaveBeenCalledTimes(3);
    });

    test('paid tier: limit is 30/day; at the cap → 429 with currentPlan pro', async () => {
        expect(DAILY_FEATURE_QUOTAS.video_storyteller.pro).toBe(30);

        // Seed the counter at the cap
        store[`daily_user_usage/premium_user_${todayUTC()}`] = { video_storyteller: 30 };

        const res = await POST(makeReq('premium_user'));
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body).toMatchObject({ error: 'DAILY_LIMIT_REACHED', used: 30, limit: 30, currentPlan: 'pro' });
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    test('paid tier under the cap passes', async () => {
        store[`daily_user_usage/premium_user_${todayUTC()}`] = { video_storyteller: 29 };
        const res = await POST(makeReq('premium_user'));
        expect(res.status).toBe(200);
    });

    test('failed dispatch rolls the reserved unit back (failure ≠ consumed quota)', async () => {
        dispatchMock.mockRejectedValueOnce(new Error('sidecar down'));

        const res = await POST(makeReq('free_user'));
        expect(res.status).toBe(500);

        // Unit returned — counter back at 0, next call passes.
        expect(store[`daily_user_usage/free_user_${todayUTC()}`]?.video_storyteller).toBe(0);
        const retry = await POST(makeReq('free_user'));
        expect(retry.status).toBe(200);
    });
});

describe('reserveDailyQuota / rollbackDailyQuota (usage-tracker)', () => {
    test('atomic check-and-reserve increments until the cap, then refuses', async () => {
        for (let i = 1; i <= 3; i++) {
            const r = await reserveDailyQuota('free_user', 'video_storyteller');
            expect(r).toMatchObject({ ok: true, used: i, limit: 3, plan: 'free' });
        }
        const blocked = await reserveDailyQuota('free_user', 'video_storyteller');
        expect(blocked).toMatchObject({ ok: false, used: 3, limit: 3 });
    });

    test('unknown/missing user profile defaults to the free (smallest) cap', async () => {
        const r = await reserveDailyQuota('ghost_user', 'video_storyteller');
        expect(r).toMatchObject({ ok: true, limit: 3, plan: 'free' });
    });

    test('rollback returns a unit', async () => {
        await reserveDailyQuota('free_user', 'video_storyteller');
        await rollbackDailyQuota('free_user', 'video_storyteller');
        const doc = store[`daily_user_usage/free_user_${todayUTC()}`];
        expect(doc.video_storyteller).toBe(0);
    });
});
