/**
 * F14-002 regression test — `peekImageRateLimit` reads the counter
 * without incrementing. Used by visual-aid + avatar Q4C observation
 * blocks to skip the second `$0.04` image-gen when the user is at cap.
 */

jest.mock('../../lib/firebase-admin', () => ({
    getDb: jest.fn(),
}));

import { peekImageRateLimit, IMAGE_RATE_LIMIT_MAX_PER_DAY } from '../../lib/server-safety';
import { getDb } from '../../lib/firebase-admin';

function mockFirestore(currentCount: number | null, sameDay = true) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const setCalls: any[] = [];
    return {
        setCalls,
        db: {
            collection: () => ({
                doc: () => ({
                    async get() {
                        if (currentCount === null) {
                            return { exists: false, data: () => undefined };
                        }
                        return {
                            exists: true,
                            data: () => ({
                                date: sameDay ? today : '2000-01-01',
                                count: currentCount,
                            }),
                        };
                    },
                    async set(data: any) {
                        setCalls.push(data);
                    },
                }),
            }),
        },
    };
}

describe('peekImageRateLimit (F14-002)', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns true when no doc exists (fresh user)', async () => {
        const { db } = mockFirestore(null);
        (getDb as jest.Mock).mockResolvedValue(db);
        expect(await peekImageRateLimit('user-fresh')).toBe(true);
    });

    it('returns true when count is below the cap', async () => {
        const { db } = mockFirestore(IMAGE_RATE_LIMIT_MAX_PER_DAY - 1);
        (getDb as jest.Mock).mockResolvedValue(db);
        expect(await peekImageRateLimit('user-room')).toBe(true);
    });

    it('returns false when count is at the cap', async () => {
        const { db } = mockFirestore(IMAGE_RATE_LIMIT_MAX_PER_DAY);
        (getDb as jest.Mock).mockResolvedValue(db);
        expect(await peekImageRateLimit('user-cap')).toBe(false);
    });

    it('returns false when count is above the cap', async () => {
        const { db } = mockFirestore(IMAGE_RATE_LIMIT_MAX_PER_DAY + 5);
        (getDb as jest.Mock).mockResolvedValue(db);
        expect(await peekImageRateLimit('user-over')).toBe(false);
    });

    it('does NOT increment the counter (read-only)', async () => {
        const fx = mockFirestore(5);
        (getDb as jest.Mock).mockResolvedValue(fx.db);
        await peekImageRateLimit('user-peek');
        expect(fx.setCalls).toHaveLength(0);
    });

    it('resets when the stored date is a previous day', async () => {
        const { db } = mockFirestore(IMAGE_RATE_LIMIT_MAX_PER_DAY, false);
        (getDb as jest.Mock).mockResolvedValue(db);
        // Stale count from yesterday should be treated as 0 → budget true.
        expect(await peekImageRateLimit('user-stale')).toBe(true);
    });

    it('fails OPEN on infrastructure errors', async () => {
        (getDb as jest.Mock).mockRejectedValue(new Error('boom'));
        expect(await peekImageRateLimit('user-down')).toBe(true);
    });
});
