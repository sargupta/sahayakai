/** @jest-environment node */
/**
 * The Riya route shell: flag → 401 → 400 → 403 → Riya flag (404), in that order, and the
 * webhook route's own flag and size checks. The service behind it is covered by
 * riya-service.test.ts.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/server/sampark/auth', () => ({ requireOrgAdmin: jest.fn(async (orgId: string, uid: string) => orgId === 'hillview-demo' && uid === 'admin-uid') }));

import type { NextRequest } from 'next/server';

import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { POST as webhookPOST } from '@/app/api/webhooks/elevenlabs-riya/route';

// The jest.setup Request polyfill drops headers, so routes get a minimal stand-in with real header lookup.
const fakeRequest = (headers: Record<string, string>, body = '') =>
    ({ headers: new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])), text: async () => body }) as unknown as NextRequest;
const req = (uid?: string) => fakeRequest(uid ? { 'x-user-id': uid } : {});
const status = async (g: Awaited<ReturnType<typeof guardRiyaRoute>>) => ('response' in g ? g.response.status : 200);

const saved = { ...process.env };
afterEach(() => {
    process.env = { ...saved };
});

describe('guardRiyaRoute', () => {
    it('404 when Sampark is off — before anything else', async () => {
        process.env.SAMPARK_ENABLED = 'false';
        process.env.SAMPARK_ELEVENLABS_ENABLED = 'true';
        expect(await status(await guardRiyaRoute(req('admin-uid'), 'hillview-demo'))).toBe(404);
    });
    it('401 without a verified user, 400 for a bad org id, 403 for a non-admin', async () => {
        process.env.SAMPARK_ENABLED = 'true';
        process.env.SAMPARK_ELEVENLABS_ENABLED = 'true';
        expect(await status(await guardRiyaRoute(req(), 'hillview-demo'))).toBe(401);
        expect(await status(await guardRiyaRoute(req('admin-uid'), '../etc'))).toBe(400);
        expect(await status(await guardRiyaRoute(req('teacher-uid'), 'hillview-demo'))).toBe(403);
        expect(await status(await guardRiyaRoute(req('admin-uid'), 'other-school'))).toBe(403);
    });
    it('404 for an admin when Riya is off; allowed when on', async () => {
        process.env.SAMPARK_ENABLED = 'true';
        process.env.SAMPARK_ELEVENLABS_ENABLED = 'false';
        expect(await status(await guardRiyaRoute(req('admin-uid'), 'hillview-demo'))).toBe(404);
        process.env.SAMPARK_ELEVENLABS_ENABLED = 'true';
        expect(await guardRiyaRoute(req('admin-uid'), 'hillview-demo')).toEqual({ uid: 'admin-uid', orgId: 'hillview-demo' });
    });
});

describe('POST /api/webhooks/elevenlabs-riya', () => {
    const post = (body: string, headers: Record<string, string> = {}) =>
        webhookPOST(fakeRequest(headers, body));

    it('404 while either flag is off', async () => {
        process.env.SAMPARK_ENABLED = 'true';
        process.env.SAMPARK_ELEVENLABS_ENABLED = 'false';
        expect((await post('{}')).status).toBe(404);
    });
    it('413 for an oversize body, before any parsing or database access', async () => {
        process.env.SAMPARK_ENABLED = 'true';
        process.env.SAMPARK_ELEVENLABS_ENABLED = 'true';
        expect((await post('x'.repeat(600 * 1024))).status).toBe(413);
    });
});
