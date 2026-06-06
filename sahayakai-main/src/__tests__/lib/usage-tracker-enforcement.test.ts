/**
 * F14-003 regression test — `checkUsage` reads the per-user counter
 * and throws `PlanLimitExceededError` past the cap.
 */

jest.mock('../../lib/firebase-admin', () => ({
    getDb: jest.fn(),
}));

import { checkUsage, PlanLimitExceededError, DAILY_USAGE_CAPS } from '../../lib/usage-tracker';
import { getDb } from '../../lib/firebase-admin';

function makeFakeDb(initialUsage: Record<string, any>, userPlan: string = 'free') {
    const store = new Map<string, any>();
    if (initialUsage && Object.keys(initialUsage).length > 0) {
        store.set('daily_user_usage/__seed', initialUsage);
    }
    return {
        collection: (name: string) => ({
            doc: (id: string) => ({
                async get() {
                    if (name === 'users') {
                        return { exists: true, data: () => ({ plan: userPlan }) };
                    }
                    // daily_user_usage
                    return {
                        exists: !!initialUsage,
                        data: () => initialUsage,
                    };
                },
            }),
        }),
    };
}

describe('checkUsage enforcement (F14-003)', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('passes when usage is under the cap', async () => {
        (getDb as jest.Mock).mockResolvedValue(
            makeFakeDb({ gemini_tokens: 1_000 }, 'free'),
        );
        await expect(checkUsage('u1', 'gemini_tokens')).resolves.toBeUndefined();
    });

    it('throws PlanLimitExceededError when at or above the cap', async () => {
        const cap = DAILY_USAGE_CAPS.free.image_generation;
        (getDb as jest.Mock).mockResolvedValue(
            makeFakeDb({ image_generation: cap }, 'free'),
        );
        await expect(checkUsage('u2', 'image_generation')).rejects.toBeInstanceOf(
            PlanLimitExceededError,
        );
    });

    it('returns 429-friendly fields on the error', async () => {
        const cap = DAILY_USAGE_CAPS.free.grounding_calls;
        (getDb as jest.Mock).mockResolvedValue(
            makeFakeDb({ grounding_calls: cap + 3 }, 'free'),
        );
        try {
            await checkUsage('u3', 'grounding_calls');
            throw new Error('should have thrown');
        } catch (e: any) {
            expect(e).toBeInstanceOf(PlanLimitExceededError);
            expect(e.type).toBe('grounding_calls');
            expect(e.used).toBe(cap + 3);
            expect(e.limit).toBe(cap);
        }
    });

    it('honours pro-plan higher caps', async () => {
        const freeCap = DAILY_USAGE_CAPS.free.image_generation;
        const proCap = DAILY_USAGE_CAPS.pro.image_generation;
        expect(proCap).toBeGreaterThan(freeCap);
        // At the free cap, a pro user should still pass.
        (getDb as jest.Mock).mockResolvedValue(
            makeFakeDb({ image_generation: freeCap }, 'pro'),
        );
        await expect(checkUsage('u4', 'image_generation')).resolves.toBeUndefined();
    });

    it('no-ops on anonymous users', async () => {
        await expect(checkUsage('', 'gemini_tokens')).resolves.toBeUndefined();
        await expect(checkUsage('anonymous_user', 'gemini_tokens')).resolves.toBeUndefined();
    });

    it('fails OPEN on infrastructure errors', async () => {
        (getDb as jest.Mock).mockRejectedValue(new Error('Firestore down'));
        // Should NOT throw — fail open keeps the product up; cost guarded
        // by other gates (rate limit, vendor quota).
        await expect(checkUsage('u5', 'gemini_tokens')).resolves.toBeUndefined();
    });
});
