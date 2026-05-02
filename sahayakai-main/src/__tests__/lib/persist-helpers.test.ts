/**
 * Tests for the Phase K persist helper.
 *
 * Verifies the canary/full sidecar path mirrors the Genkit flow's
 * Storage + Firestore writes, and that any failure is fail-soft so the
 * user response is never dropped on the floor.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSave = jest.fn(async () => undefined);
const mockBucket = jest.fn(() => ({ file: jest.fn(() => ({ save: mockSave })) }));
const mockGetStorage = jest.fn(async () => ({ bucket: mockBucket }));

jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: (...args: unknown[]) => mockGetStorage(...args),
}));

const mockSaveContent = jest.fn(async () => undefined);
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        saveContent: (...args: unknown[]) => mockSaveContent(...args),
    },
}));

jest.mock('firebase-admin/firestore', () => ({
    Timestamp: {
        fromDate: (d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
    },
}));

import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';

beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockSaveContent.mockResolvedValue(undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

const BASE_INPUT = {
    uid: 'teacher-uid-1',
    collection: 'quizzes',
    contentType: 'quiz' as const,
    title: 'Photosynthesis',
    output: { foo: 'bar' },
    metadata: {
        gradeLevel: 'Class 5',
        subject: 'Science',
        topic: 'Photosynthesis',
        language: 'English',
    },
};

describe('persistSidecarJSON', () => {
    it('writes both Storage and Firestore on success', async () => {
        const result = await persistSidecarJSON(BASE_INPUT);

        expect(result).not.toBeNull();
        expect(result?.contentId).toEqual(expect.any(String));
        expect(result?.storagePath).toMatch(
            /^users\/teacher-uid-1\/quizzes\/\d{8}_\d{6}_photosynthesis\.json$/,
        );

        expect(mockGetStorage).toHaveBeenCalledTimes(1);
        expect(mockSave).toHaveBeenCalledTimes(1);
        const [savedBody, saveOpts] = mockSave.mock.calls[0] as unknown as [
            string,
            { resumable: boolean; metadata: { contentType: string } },
        ];
        expect(savedBody).toContain('"foo": "bar"');
        expect(saveOpts.resumable).toBe(false);
        expect(saveOpts.metadata.contentType).toBe('application/json');

        expect(mockSaveContent).toHaveBeenCalledTimes(1);
        const [uid, contentDoc] = mockSaveContent.mock.calls[0] as unknown as [
            string,
            Record<string, unknown>,
        ];
        expect(uid).toBe('teacher-uid-1');
        expect(contentDoc.type).toBe('quiz');
        expect(contentDoc.title).toBe('Photosynthesis');
        expect(contentDoc.gradeLevel).toBe('Class 5');
        expect(contentDoc.subject).toBe('Science');
        expect(contentDoc.topic).toBe('Photosynthesis');
        expect(contentDoc.language).toBe('English');
        expect(contentDoc.isPublic).toBe(false);
        expect(contentDoc.isDraft).toBe(false);
        expect(contentDoc.storagePath).toBe(result?.storagePath);
        expect(contentDoc.id).toBe(result?.contentId);
        expect(contentDoc.data).toEqual({ foo: 'bar' });
    });

    it('returns null on Storage error (fail-soft)', async () => {
        mockSave.mockRejectedValueOnce(new Error('storage 503'));

        const result = await persistSidecarJSON(BASE_INPUT);

        expect(result).toBeNull();
        // Firestore write must not have happened — Storage failed first
        expect(mockSaveContent).not.toHaveBeenCalled();
    });

    it('returns null on Firestore error (fail-soft)', async () => {
        mockSaveContent.mockRejectedValueOnce(new Error('firestore unavailable'));

        const result = await persistSidecarJSON(BASE_INPUT);

        expect(result).toBeNull();
        // Storage write happened before Firestore failed
        expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('writes to the collection-specific Storage subdir', async () => {
        const result = await persistSidecarJSON({
            ...BASE_INPUT,
            collection: 'exam-papers',
            contentType: 'exam-paper' as const,
        });

        expect(result?.storagePath).toMatch(
            /^users\/teacher-uid-1\/exam-papers\//,
        );
    });

    it('slugifies titles with non-alphanumeric chars', async () => {
        const result = await persistSidecarJSON({
            ...BASE_INPUT,
            title: 'Math: Quadratic Eqs & Triangles??',
        });

        expect(result?.storagePath).toMatch(
            /math-quadratic-eqs-triangles\.json$/,
        );
    });

    it('caps the slug at 50 chars to keep storage paths bounded', async () => {
        const long = 'a'.repeat(80);
        const result = await persistSidecarJSON({ ...BASE_INPUT, title: long });
        // Storage path: users/{uid}/{collection}/{ts}_{slug}.json — slug
        // segment is the run of `a`s; should be exactly 50 chars long.
        const match = result?.storagePath?.match(/_([a-z0-9-]+)\.json$/);
        expect(match).toBeTruthy();
        expect(match![1].length).toBe(50);
    });

    it('falls back to "untitled" when title slug is empty', async () => {
        const result = await persistSidecarJSON({
            ...BASE_INPUT,
            title: '!!!!',
        });

        expect(result?.storagePath).toMatch(/untitled\.json$/);
    });
});
