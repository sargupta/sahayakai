/**
 * Unit coverage for src/server/moderation.ts branch paths — trust & safety
 * module gated at 80% per-path coverage (jest.config.ts). Focuses on the
 * validation, fail-open/fail-closed, and rate-limit branches the route-level
 * tests don't reach.
 */

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const getUsersMock = jest.fn();
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { getUsers: (...args: any[]) => getUsersMock(...args) },
}));

const getDbMock = jest.fn();
jest.mock('@/lib/firebase-admin', () => ({
    getDb: (...args: any[]) => getDbMock(...args),
}));

import {
    blockUser,
    unblockUser,
    listBlocks,
    isBlockedEitherWay,
    getBlockedUidSet,
    reportContent,
    REPORTS_PER_DAY,
    REPORT_FREETEXT_MAX,
} from '@/server/moderation';

// ── Fake Firestore ───────────────────────────────────────────────────────────

function makeDb(overrides: {
    blocksDocs?: Array<{ id: string; data: Record<string, any> }>;
    blockGetExists?: (owner: string, target: string) => boolean;
    rateLimitDoc?: { exists: boolean; data?: Record<string, any> };
    onBlockSet?: jest.Mock;
    onBlockDelete?: jest.Mock;
    onRateLimitSet?: jest.Mock;
    onReportAdd?: jest.Mock;
} = {}) {
    const {
        blocksDocs = [],
        blockGetExists = () => false,
        rateLimitDoc = { exists: false },
        onBlockSet = jest.fn(),
        onBlockDelete = jest.fn(),
        onRateLimitSet = jest.fn(),
        onReportAdd = jest.fn(async () => ({ id: 'report_1' })),
    } = overrides;

    return {
        collection: (col: string) => {
            if (col === 'users') {
                return {
                    doc: (owner: string) => ({
                        collection: () => ({
                            doc: (target: string) => ({
                                set: onBlockSet,
                                delete: onBlockDelete,
                                get: async () => ({ exists: blockGetExists(owner, target) }),
                            }),
                            limit: () => ({
                                get: async () => ({
                                    docs: blocksDocs.map((d) => ({
                                        id: d.id,
                                        data: () => d.data,
                                    })),
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (col === 'rate_limits') {
                return {
                    doc: () => ({
                        get: async () => ({
                            exists: rateLimitDoc.exists,
                            data: () => rateLimitDoc.data,
                        }),
                        set: onRateLimitSet,
                    }),
                };
            }
            if (col === 'reports') {
                return { add: onReportAdd };
            }
            throw new Error(`unexpected collection ${col}`);
        },
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    getDbMock.mockResolvedValue(makeDb());
    getUsersMock.mockResolvedValue([]);
});

// ── blockUser / unblockUser ──────────────────────────────────────────────────

describe('blockUser', () => {
    it('rejects empty / oversized / non-string uids', async () => {
        await expect(blockUser('me', '')).rejects.toThrow('Invalid user id');
        await expect(blockUser('me', '   ')).rejects.toThrow('Invalid user id');
        await expect(blockUser('me', 'x'.repeat(129))).rejects.toThrow('Invalid user id');
        await expect(blockUser('me', 42 as unknown as string)).rejects.toThrow('Invalid user id');
    });

    it('rejects self-block', async () => {
        await expect(blockUser('me', 'me')).rejects.toThrow('Cannot block yourself');
    });

    it('writes an idempotent block doc for a valid target', async () => {
        const onBlockSet = jest.fn();
        getDbMock.mockResolvedValue(makeDb({ onBlockSet }));
        await blockUser('me', 'other');
        expect(onBlockSet).toHaveBeenCalledWith(
            expect.objectContaining({ blockedUid: 'other', createdAt: expect.any(String) }),
        );
    });

    it('propagates infrastructure errors (fail closed)', async () => {
        getDbMock.mockRejectedValue(new Error('firestore down'));
        await expect(blockUser('me', 'other')).rejects.toThrow('firestore down');
    });
});

describe('unblockUser', () => {
    it('rejects invalid uids', async () => {
        await expect(unblockUser('me', '')).rejects.toThrow('Invalid user id');
        await expect(unblockUser('me', 'x'.repeat(129))).rejects.toThrow('Invalid user id');
    });

    it('deletes the block doc', async () => {
        const onBlockDelete = jest.fn();
        getDbMock.mockResolvedValue(makeDb({ onBlockDelete }));
        await unblockUser('me', 'other');
        expect(onBlockDelete).toHaveBeenCalled();
    });

    it('propagates infrastructure errors (fail closed)', async () => {
        getDbMock.mockRejectedValue(new Error('firestore down'));
        await expect(unblockUser('me', 'other')).rejects.toThrow('firestore down');
    });
});

// ── listBlocks ───────────────────────────────────────────────────────────────

describe('listBlocks', () => {
    it('returns [] when nothing is blocked', async () => {
        getDbMock.mockResolvedValue(makeDb({ blocksDocs: [] }));
        await expect(listBlocks('me')).resolves.toEqual([]);
        expect(getUsersMock).not.toHaveBeenCalled();
    });

    it('hydrates display names and falls back to "Teacher" for missing profiles', async () => {
        getDbMock.mockResolvedValue(makeDb({
            blocksDocs: [
                { id: 'u1', data: { blockedUid: 'u1', createdAt: '2026-01-01T00:00:00Z' } },
                { id: 'u2', data: {} }, // doc without fields → falls back to id / null
            ],
        }));
        getUsersMock.mockResolvedValue([
            { uid: 'u1', displayName: 'Asha', photoURL: 'https://p/u1.jpg' },
        ]);

        const rows = await listBlocks('me');
        expect(rows).toEqual([
            { blockedUid: 'u1', createdAt: '2026-01-01T00:00:00Z', displayName: 'Asha', photoURL: 'https://p/u1.jpg' },
            { blockedUid: 'u2', createdAt: null, displayName: 'Teacher', photoURL: null },
        ]);
    });

    it('batches profile hydration in groups of 10', async () => {
        const blocksDocs = Array.from({ length: 25 }, (_, i) => ({
            id: `u${i}`,
            data: { blockedUid: `u${i}`, createdAt: null },
        }));
        getDbMock.mockResolvedValue(makeDb({ blocksDocs }));
        getUsersMock.mockResolvedValue([]);

        const rows = await listBlocks('me');
        expect(rows).toHaveLength(25);
        expect(getUsersMock).toHaveBeenCalledTimes(3); // 10 + 10 + 5
    });

    it('propagates infrastructure errors (fail closed)', async () => {
        getDbMock.mockRejectedValue(new Error('firestore down'));
        await expect(listBlocks('me')).rejects.toThrow('firestore down');
    });
});

// ── enforcement helpers ──────────────────────────────────────────────────────

describe('isBlockedEitherWay', () => {
    it('is true when A blocked B', async () => {
        getDbMock.mockResolvedValue(makeDb({
            blockGetExists: (owner, target) => owner === 'a' && target === 'b',
        }));
        await expect(isBlockedEitherWay('a', 'b')).resolves.toBe(true);
    });

    it('is true when B blocked A (direction-neutral)', async () => {
        getDbMock.mockResolvedValue(makeDb({
            blockGetExists: (owner, target) => owner === 'b' && target === 'a',
        }));
        await expect(isBlockedEitherWay('a', 'b')).resolves.toBe(true);
    });

    it('is false when neither blocked the other', async () => {
        await expect(isBlockedEitherWay('a', 'b')).resolves.toBe(false);
    });
});

describe('getBlockedUidSet', () => {
    it('returns the set of blocked uids', async () => {
        getDbMock.mockResolvedValue(makeDb({
            blocksDocs: [
                { id: 'u1', data: {} },
                { id: 'u2', data: {} },
            ],
        }));
        await expect(getBlockedUidSet('me')).resolves.toEqual(new Set(['u1', 'u2']));
    });

    it('fails OPEN (empty set) on infrastructure errors — feed must not blank', async () => {
        getDbMock.mockRejectedValue(new Error('firestore down'));
        await expect(getBlockedUidSet('me')).resolves.toEqual(new Set());
    });
});

// ── reportContent ────────────────────────────────────────────────────────────

describe('reportContent', () => {
    const valid = { targetType: 'post' as const, targetId: 'post_1', reason: 'spam' as const };

    it('rejects invalid target types, ids, and reasons', async () => {
        await expect(reportContent('me', { ...valid, targetType: 'nope' as any }))
            .rejects.toThrow('Invalid report target');
        await expect(reportContent('me', { ...valid, targetId: '' }))
            .rejects.toThrow('Invalid report target');
        await expect(reportContent('me', { ...valid, targetId: 'x'.repeat(257) }))
            .rejects.toThrow('Invalid report target');
        await expect(reportContent('me', { ...valid, reason: 'nope' as any }))
            .rejects.toThrow('Invalid report reason');
    });

    it('rejects non-string or oversized freeText', async () => {
        await expect(reportContent('me', { ...valid, freeText: 42 as unknown as string }))
            .rejects.toThrow('Invalid report details');
        await expect(reportContent('me', { ...valid, freeText: 'x'.repeat(REPORT_FREETEXT_MAX + 1) }))
            .rejects.toThrow('Report details too long');
    });

    it('creates the report and returns its id', async () => {
        const onReportAdd = jest.fn(async () => ({ id: 'report_42' }));
        getDbMock.mockResolvedValue(makeDb({ onReportAdd }));

        const result = await reportContent('me', { ...valid, freeText: '  details  ' });
        expect(result).toEqual({ reportId: 'report_42' });
        expect(onReportAdd).toHaveBeenCalledWith(expect.objectContaining({
            reporterId: 'me',
            targetType: 'post',
            targetId: 'post_1',
            reason: 'spam',
            freeText: 'details',
            status: 'open',
        }));
    });

    it('enforces the daily report cap', async () => {
        getDbMock.mockResolvedValue(makeDb({
            rateLimitDoc: {
                exists: true,
                data: {
                    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
                    count: REPORTS_PER_DAY,
                },
            },
        }));
        await expect(reportContent('me', valid)).rejects.toThrow('Rate limit exceeded');
    });

    it('resets the counter on a new IST day', async () => {
        const onRateLimitSet = jest.fn();
        const onReportAdd = jest.fn(async () => ({ id: 'report_9' }));
        getDbMock.mockResolvedValue(makeDb({
            rateLimitDoc: { exists: true, data: { date: '2020-01-01', count: REPORTS_PER_DAY } },
            onRateLimitSet,
            onReportAdd,
        }));
        await expect(reportContent('me', valid)).resolves.toEqual({ reportId: 'report_9' });
        expect(onRateLimitSet).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
    });

    it('fails OPEN when the rate-limit store errors — abuse reporting must not be silenced', async () => {
        const onReportAdd = jest.fn(async () => ({ id: 'report_7' }));
        const db = makeDb({ onReportAdd });
        const origCollection = db.collection.bind(db);
        db.collection = ((col: string) => {
            if (col === 'rate_limits') throw new Error('rate limit store down');
            return origCollection(col);
        }) as typeof db.collection;
        getDbMock.mockResolvedValue(db);

        await expect(reportContent('me', valid)).resolves.toEqual({ reportId: 'report_7' });
    });
});
