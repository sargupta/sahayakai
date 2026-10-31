/**
 * `saveToLibrary` with a stable id: the explicit Save for an instant answer /
 * teacher-training advice / onboarding lesson plan must update the one row
 * the generation is filed under — never add a second copy.
 */

const mockFileSave = jest.fn(async () => undefined);
const mockFile = jest.fn((_path: string) => ({ save: mockFileSave }));
jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: async () => ({ bucket: () => ({ file: mockFile, name: 'b' }) }),
}));

const mockSaveContent = jest.fn(async () => undefined);
const mockGetContent = jest.fn();
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        saveContent: (...a: unknown[]) => mockSaveContent(...a),
        getContent: (...a: unknown[]) => mockGetContent(...a),
    },
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/aggregator', () => ({ aggregateUserMetrics: jest.fn(async () => undefined) }));
jest.mock('@/lib/teacher-activity-tracker', () => ({ trackTeacherContent: jest.fn() }));
jest.mock('@/lib/auth-utils', () => ({ validateAdmin: jest.fn() }));

import { saveToLibrary } from '@/server/content';

const STABLE_ID = '6f1c2d3e-4b5a-4c6d-8e7f-0123456789ab';
const lastDoc = () => mockSaveContent.mock.calls.at(-1)?.[1] as unknown as Record<string, unknown>;

beforeEach(() => jest.clearAllMocks());

describe('saveToLibrary — stable id', () => {
    it('updates the existing row in place: same id, original createdAt and blob path', async () => {
        const createdAt = { seconds: 1700000000, nanoseconds: 0 };
        mockGetContent.mockResolvedValue({ id: STABLE_ID, createdAt, storagePath: 'users/u1/instant-answers/orig.json' });

        const res = await saveToLibrary('u1', 'instant-answer', 'What is gravity?', { answer: 'A force.' }, STABLE_ID);

        expect(res).toEqual({ success: true, id: STABLE_ID });
        expect(lastDoc().id).toBe(STABLE_ID);
        expect(lastDoc().createdAt).toBe(createdAt);
        expect(lastDoc().storagePath).toBe('users/u1/instant-answers/orig.json');
        expect(mockFile).toHaveBeenCalledWith('users/u1/instant-answers/orig.json');
        expect(lastDoc().status).toBe('ready');
    });

    it('repeated Saves with the same id always target one row', async () => {
        mockGetContent.mockResolvedValue(null);

        await saveToLibrary('u1', 'instant-answer', 'Q', { answer: 'A' }, STABLE_ID);
        await saveToLibrary('u1', 'instant-answer', 'Q', { answer: 'A' }, STABLE_ID);

        const ids = mockSaveContent.mock.calls.map((c) => (c[1] as unknown as { id: string }).id);
        expect(new Set(ids)).toEqual(new Set([STABLE_ID]));
    });

    it('creates the row (with createdAt) when the id is new', async () => {
        mockGetContent.mockResolvedValue(null);

        await saveToLibrary('u1', 'teacher-training', 'Advice', { advice: [] }, STABLE_ID);

        expect(lastDoc().id).toBe(STABLE_ID);
        expect(lastDoc().createdAt).toBeTruthy();
    });

    it('legacy callers without an id still get a fresh row', async () => {
        const res = await saveToLibrary('u1', 'instant-answer', 'Q', { answer: 'A' });

        expect(res.success).toBe(true);
        expect(res.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(mockGetContent).not.toHaveBeenCalled();
    });
});
