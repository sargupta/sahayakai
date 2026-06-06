/**
 * @jest-environment node
 *
 * Tests for POST /api/jobs/storage-cleanup (F12-P0-01 fix).
 *
 * Verifies:
 * - Unauthenticated request → 401
 * - CRON_SECRET bearer + non-allowed path → 403
 * - CRON_SECRET bearer + allowed (uid-scoped) path with matching uid → 200
 * - Path traversal rejected
 * - OIDC verification path enforced when no CRON_SECRET
 */

import { NextResponse } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
    OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: (...args: any[]) => mockVerifyIdToken(...args),
    })),
}));

const mockDelete = jest.fn();
jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: jest.fn(async () => ({
        bucket: () => ({ file: () => ({ delete: mockDelete }) }),
    })),
    getDb: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const jsonSpy = jest.spyOn(NextResponse, 'json');

function makeReq(body: any, headers: Record<string, string> = {}) {
    // The jest.setup polyfill replaces global Request with a stub that drops
    // headers. We build a minimal duck-typed request the handler can consume:
    // it reads `.url`, `.headers.get(name)`, and `.json()` only.
    const lowerHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) lowerHeaders[k.toLowerCase()] = v;
    return {
        url: 'https://example.test/api/jobs/storage-cleanup',
        method: 'POST',
        headers: { get: (k: string) => lowerHeaders[k.toLowerCase()] ?? null },
        json: async () => body,
    } as any as Request;
}

function lastJson(): { body: any; status: number } {
    const calls = jsonSpy.mock.calls;
    const last = calls[calls.length - 1];
    return { body: last[0], status: (last[1] as any)?.status ?? 200 };
}

describe('POST /api/jobs/storage-cleanup', () => {
    let POST: (req: Request) => Promise<Response>;
    const ORIGINAL_ENV = { ...process.env };

    beforeAll(async () => {
        process.env.CRON_SECRET = 'test-secret';
        const mod = await import('@/app/api/jobs/storage-cleanup/route');
        POST = mod.POST;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockDelete.mockResolvedValue(undefined);
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('rejects unauthenticated POST with 401', async () => {
        await POST(makeReq({ storagePath: 'temp/foo.jpg' }));
        const { status } = lastJson();
        expect(status).toBe(401);
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('rejects CRON_SECRET caller + non-allowed prefix with 403', async () => {
        await POST(makeReq(
            { storagePath: 'users/victim/avatar.jpg', userId: 'victim' },
            { Authorization: 'Bearer test-secret' },
        ));
        const { status, body } = lastJson();
        expect(status).toBe(403);
        expect(body.reason).toBe('prefix_not_allowed');
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('rejects path traversal', async () => {
        await POST(makeReq(
            { storagePath: 'temp/../users/victim/avatar.jpg', userId: 'victim' },
            { Authorization: 'Bearer test-secret' },
        ));
        const { status, body } = lastJson();
        expect(status).toBe(403);
        expect(body.reason).toBe('path_traversal');
    });

    it('rejects uid-mismatch on uid-scoped prefix', async () => {
        await POST(makeReq(
            { storagePath: 'lessons/victim/x.json', userId: 'attacker' },
            { Authorization: 'Bearer test-secret' },
        ));
        const { status, body } = lastJson();
        expect(status).toBe(403);
        expect(body.reason).toBe('uid_mismatch');
    });

    it('accepts CRON_SECRET + allowed temp/ path → 200 and deletes', async () => {
        await POST(makeReq(
            { storagePath: 'temp/job-123.txt', userId: 'someone', contentId: 'c1' },
            { Authorization: 'Bearer test-secret' },
        ));
        const { status, body } = lastJson();
        expect(status).toBe(200);
        expect(body.ok).toBe(true);
        expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('accepts CRON_SECRET + uid-scoped path with matching userId', async () => {
        await POST(makeReq(
            { storagePath: 'voice-messages/uidA/msg.webm', userId: 'uidA' },
            { Authorization: 'Bearer test-secret' },
        ));
        const { status } = lastJson();
        expect(status).toBe(200);
        expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('OIDC failure → 401 when no CRON_SECRET match', async () => {
        mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid token'));
        await POST(makeReq(
            { storagePath: 'temp/foo.txt' },
            { Authorization: 'Bearer fake-oidc' },
        ));
        const { status } = lastJson();
        expect(status).toBe(401);
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('OIDC success but non-allowed path → 403', async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            getPayload: () => ({
                iss: 'https://accounts.google.com',
                email: 'pubsub@example.iam.gserviceaccount.com',
                sub: '123',
            }),
        });
        await POST(makeReq(
            { storagePath: 'random/path.txt', userId: 'u' },
            { Authorization: 'Bearer good-oidc' },
        ));
        const { status, body } = lastJson();
        expect(status).toBe(403);
        expect(body.reason).toBe('prefix_not_allowed');
    });

    it('OIDC success + allowed path → 200', async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
            getPayload: () => ({
                iss: 'https://accounts.google.com',
                email: 'pubsub@example.iam.gserviceaccount.com',
                sub: '123',
            }),
        });
        await POST(makeReq(
            { storagePath: 'temp/cleanup.txt' },
            { Authorization: 'Bearer good-oidc' },
        ));
        const { status } = lastJson();
        expect(status).toBe(200);
        expect(mockDelete).toHaveBeenCalledTimes(1);
    });
});
