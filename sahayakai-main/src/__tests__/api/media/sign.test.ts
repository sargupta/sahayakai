/**
 * Contract tests for POST /api/media/sign — the H8 access-checked media
 * proxy (docs/security/BUG_AUDIT_2026-07-02.md). Private voice-DM storage
 * paths must only be signable by conversation participants; community-shared
 * prefixes stay auth-wide by intent; everything else is default-denied.
 */

// ── Mock: firebase-admin (in-memory Firestore + spied Storage) ──────────────

const store: Record<string, Record<string, any>> = {};

function getCol(path: string) {
    if (!store[path]) store[path] = {};
    return store[path];
}

function makeMockDb() {
    const collection = (colName: string) => ({
        doc: (id: string) => ({
            id,
            get: jest.fn(async () => {
                const data = getCol(colName)[id];
                return { exists: !!data, data: () => data, id };
            }),
        }),
    });
    return { collection };
}

const mockDb = makeMockDb();
const mockGetSignedUrl = jest.fn(async (_opts: { version: string; action: string; expires: number }) =>
    ['https://storage.googleapis.com/signed/abc?X-Goog-Signature=sig']);
const mockFile = jest.fn((path: string) => ({ path, getSignedUrl: mockGetSignedUrl }));
const mockBucket = jest.fn(() => ({ file: mockFile }));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: () => Promise.resolve(mockDb),
    getStorageInstance: () => Promise.resolve({ bucket: mockBucket }),
}));

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'SERVER_TS',
        increment: (n: number) => ({ __increment: n }),
        arrayUnion: (...vals: any[]) => ({ __arrayUnion: vals }),
    },
}));

// Transitive imports of @/server/messages (route reuses its participant helper).
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { getUser: jest.fn(), getUsers: jest.fn(), serialize: jest.fn((d: any) => d) },
}));
jest.mock('@/lib/notifications/create', () => ({
    createTypedNotification: jest.fn(async () => {}),
}));
jest.mock('@/lib/fcm-server', () => ({
    sendPushToUser: jest.fn(async () => {}),
}));
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ── Import route handler under test ─────────────────────────────────────────

import { POST as signPOST } from '@/app/api/media/sign/route';

// ── Helpers (same plain-mock-request convention as the other api suites) ────

function post(body: unknown, uid?: string | null): Request {
    const headers = new Map<string, string>();
    if (uid) headers.set('x-user-id', uid);
    return {
        url: 'http://localhost:3000/api/media/sign',
        method: 'POST',
        json: async () => body,
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Request;
}

import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');

async function json(_res: Response): Promise<any> {
    const calls = jsonSpy.mock.calls;
    return calls[calls.length - 1][0];
}

// ── Tests ───────────────────────────────────────────────────────────────────

const DM_PATH = 'voice-messages/user-a/conv-1/1719900000000.webm';

describe('POST /api/media/sign (H8 media proxy)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(store).forEach((k) => delete store[k]);
        // conv-1: user-a ↔ user-b. user-c is an outsider.
        getCol('conversations')['conv-1'] = {
            type: 'direct',
            participantIds: ['user-a', 'user-b'],
        };
    });

    it('401 when unauthenticated (no x-user-id header)', async () => {
        const res = await signPOST(post({ path: DM_PATH }, null));
        expect(res.status).toBe(401);
        expect((await json(res)).error).toMatch(/Unauthorized/);
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('signs a voice DM for the uploader (owner)', async () => {
        const res = await signPOST(post({ path: DM_PATH }, 'user-a'));
        expect(res.status).toBe(200);
        expect((await json(res)).url).toContain('X-Goog-Signature');
        expect(mockFile).toHaveBeenCalledWith(DM_PATH);
    });

    it('signs a voice DM for the other conversation participant', async () => {
        const res = await signPOST(post({ path: DM_PATH }, 'user-b'));
        expect(res.status).toBe(200);
        expect((await json(res)).url).toBeDefined();
    });

    it('403 for an authenticated NON-participant', async () => {
        const res = await signPOST(post({ path: DM_PATH }, 'user-c'));
        expect(res.status).toBe(403);
        expect((await json(res)).error).toMatch(/Forbidden/);
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('403 when the conversation does not exist (no id-existence oracle)', async () => {
        const res = await signPOST(post({ path: 'voice-messages/user-a/ghost-conv/1.webm' }, 'user-b'));
        expect(res.status).toBe(403);
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('legacy 2-segment voice path: owner only', async () => {
        const legacy = 'voice-messages/user-a/1719900000000.webm';
        const owner = await signPOST(post({ path: legacy }, 'user-a'));
        expect(owner.status).toBe(200);
        const stranger = await signPOST(post({ path: legacy }, 'user-c'));
        expect(stranger.status).toBe(403);
    });

    describe('path traversal / malformed paths rejected before any signing', () => {
        it.each([
            ['dot-dot segment', 'voice-messages/user-a/conv-1/../../../secrets.json'],
            ['leading slash', '/voice-messages/user-a/conv-1/x.webm'],
            ['backslash', 'voice-messages\\user-a\\conv-1\\x.webm'],
            ['percent-encoded traversal', 'voice-messages/user-a/conv-1/%2e%2e/x.webm'],
            ['empty segment', 'voice-messages//conv-1/x.webm'],
            ['bare dot segment', 'voice-messages/./conv-1/x.webm'],
        ])('%s', async (_label, path) => {
            const res = await signPOST(post({ path }, 'user-a'));
            expect(res.status).toBe(400);
            expect(mockGetSignedUrl).not.toHaveBeenCalled();
        });

        it('400 on missing/invalid body', async () => {
            expect((await signPOST(post({}, 'user-a'))).status).toBe(400);
            expect((await signPOST(post({ path: 42 }, 'user-a'))).status).toBe(400);
            expect((await signPOST(post({ path: '' }, 'user-a'))).status).toBe(400);
        });
    });

    it('403 for non-allowlisted prefixes (default-deny)', async () => {
        for (const path of ['content/some-user/file.pdf', 'random.txt', 'voice-messages/only-two']) {
            const res = await signPOST(post({ path }, 'user-a'));
            expect([400, 403]).toContain(res.status);
        }
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('community-shared prefixes sign for ANY authenticated user (by intent)', async () => {
        for (const path of [
            'community-voice/user-z/1719900000000.webm',
            'users/user-z/uploads/uuid_pic.png',
            'profile-photos/user-z/avatar.png',
            'uploads/user-z/pic.png',
        ]) {
            const res = await signPOST(post({ path }, 'user-c'));
            expect(res.status).toBe(200);
        }
    });

    it('mints a V4 read URL with a ~10-minute TTL', async () => {
        const before = Date.now();
        await signPOST(post({ path: DM_PATH }, 'user-a'));
        expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
        const arg = mockGetSignedUrl.mock.calls[0][0] as any;
        expect(arg.version).toBe('v4');
        expect(arg.action).toBe('read');
        expect(arg.expires).toBeGreaterThanOrEqual(before + 9 * 60 * 1000);
        expect(arg.expires).toBeLessThanOrEqual(Date.now() + 11 * 60 * 1000);
    });
});
